# Soroban Cost Model & Metering

> An in-depth breakdown of how Soroban meters computational and storage resources, and how these translate into transaction fees.

---

## The Fee Architecture of Soroban

Unlike Ethereum, which bundles computation, memory, and storage into a single unified gas metric, Soroban employs a **multidimensional fee model**. 

A Soroban transaction fee consists of two distinct components:

$$\text{Total Fee} = \text{Inclusion Fee} + \text{Resource Fee}$$

1. **Inclusion Fee:** Bids for validator priority in the transaction queue (standard Stellar transaction fee).
2. **Resource Fee:** Directly reimburses validators for the physical hardware resources consumed by executing and storing your smart contract.

---

## Metered Resource Dimensions

The resource fee is calculated across five independent dimensions:

| Resource Dimension | Unit of Measurement | Hard Cap (Per Tx) | Fee Structure |
| :--- | :--- | :--- | :--- |
| **CPU Instructions** | Executed instruction count | 100,000,000 instructions | Non-refundable fee per million instructions |
| **Memory (RAM)** | Bytes allocated / resident | 40 MB | Enforced limit (not billed directly in fee) |
| **Ledger Entry Reads** | Key-value pairs accessed | 40 entries | Non-refundable fee per entry read |
| **Ledger Entry Writes** | Key-value pairs mutated | 25 entries | Non-refundable fee per entry written |
| **Ledger Read Bytes** | Serialized payload bytes | ~200 KB | Non-refundable fee per KB read |
| **Ledger Write Bytes** | Serialized payload bytes | ~100 KB | Non-refundable fee per KB written |
| **Ledger Space Rent** | Byte $\times$ Ledgers duration | N/A | Dynamic refundable fee based on entry TTL |

::: info
Hard caps are set by network consensus and published on the [Stellar Dashboard](https://dashboard.stellar.org). If a contract exceeds any single hard cap during execution, the transaction immediately traps and fails.
:::

---

## Deep Dive: CPU Instruction Costs

In Soroban, CPU instructions are not measured merely by counting raw WASM opcodes. The host environment tracks over 85 calibrated **`ContractCostType`** categories.

Every cost type uses a linear or polynomial calibration curve of the form:

$$\text{Cost} = a + b \times x$$

where:
* $a$ is the fixed dispatch / initialization overhead.
* $b$ is the marginal cost factor.
* $x$ is the dynamic input size (such as the number of bytes copied, elements compared, or hashing rounds).

### Dominant Cost Types

| Cost Type | Operations Represented | Calibration Impact |
| :--- | :--- | :--- |
| `WasmInsnExec` | Baseline WASM instruction execution | Constant low cost per instruction (~1-4 instructions) |
| `DispatchHostFunction` | Crossing from WASM guest into the host VM | Fixed overhead per host invocation (~800-1,200 CPU instructions) |
| `MemAlloc` / `MemCpy` | Allocating or duplicating byte buffers in guest or host | Scales linearly with buffer length |
| `VisitObject` | Reading or dereferencing host-managed objects | Fixed lookup cost in the host object table |
| `ComputeSha256Hash` | Cryptographic SHA-256 calculation | High fixed cost + per-chunk CPU cost (~3,000+ CPU instructions) |
| `VerifyEd25519Sig` | Ed25519 signature verification | Extremely heavy fixed CPU burn (~300,000+ CPU instructions) |

---

## Storage Costs: The Heavyweight Expense

Storage operations consistently dominate both CPU consumption and raw transaction fees. When your contract executes:

```rust
env.storage().instance().set(&key, &user_data);
```

The runtime incurs multiple compounding costs:
1. **Ledger Entry Write:** Consumes 1 unit of the 25-entry write limit.
2. **Ledger Write Bytes:** Consumes write byte quota based on the XDR-serialized representation of `user_data`.
3. **Serialization CPU:** Billed under CPU instructions for translating Rust structures into Stellar XDR.
4. **Host Dispatch Overhead:** Billed under `DispatchHostFunction`.

Executing this operation in a loop of $N$ iterations multiplies all four cost components by $N$.

---

## Non-Refundable vs. Refundable Fees

* **Non-Refundable Fees:** Charges for resources permanently consumed during transaction execution, including all CPU instructions, entry reads, and entry writes. Even if the transaction panics, validators retain this portion of the fee.
* **Refundable Fees:** Pre-authorized deposits for maximum possible event emission, return value size, and rent extension. The network refunds the unused portion automatically upon completion.

---

## What `soroban-cost-profiler` Measures

`soroban-cost-profiler` tracks the exact instruction-level execution trace:
* **CPU Instructions:** Attributed to every WASM function and line number.
* **Host Function Invocations:** Grouped and attributed to the calling line in your contract.
* **Memory Allocation Deltas:** Tracing byte buffer growth across function invocations.

This allows developers to inspect the exact monetary fee impact of their code before deploying to mainnet.

