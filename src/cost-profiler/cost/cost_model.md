# Soroban Cost Model & Metering

> How Soroban meters computational and storage resources, how that becomes a fee, and which of those numbers the profiler actually reports.

::: info Where these numbers come from
This page distinguishes three kinds of figure, and marks them:
* **From the runtime source** — counts and formulas read out of `soroban-env-host` 28.0.2 and `stellar-xdr` 28.0.0, the versions the profiler builds against.
* **From this org's repo** — the per-transaction caps in `soroban-budget-assert/tier-a-limits.env`, which declare their own provenance.
* **Not sourced here** — fee denominations and ledger-entry counts. For what a transaction will actually cost you, query the network's own settings rather than a documentation page.
:::

---

## The fee architecture

Unlike Ethereum, which bundles computation, memory, and storage into a single gas metric, Soroban uses a **multidimensional fee model**. A transaction fee has two components:

```text
total fee = inclusion fee + resource fee
```

1. **Inclusion fee** — bids for validator priority in the transaction queue (the standard Stellar transaction fee).
2. **Resource fee** — reimburses validators for the hardware consumed executing and storing the contract.

---

## The two budget dimensions

Inside the host, the budget tracks **two** dimensions, each with its own limit and running count (`soroban-env-host::budget::BudgetDimension`):

| Dimension | Unit | What the profiler reads |
| :--- | :--- | :--- |
| CPU | Metered instructions | `get_cpu_insns_consumed()` |
| Memory | Bytes | `get_mem_bytes_consumed()` |

Two details of that struct are worth knowing when reading a profile:

* Each dimension keeps a **`net_count`** (running net sum, lowered by `refund` for transient allocations such as a torn-down VM's linear memory) and a **`peak_count`** (high-water mark, advanced by `charge` and never lowered). `get_mem_bytes_consumed()` reports the peak; the CPU dimension is never refunded.
* Each dimension also carries a **shadow limit** for work not exposed to the user — diagnostic logging, preflight work. Exceeding it does not affect fees or the invocation outcome; it exists for DoS prevention.

---

## Per-transaction network caps

`soroban-budget-assert`'s `tier-a-limits.env` carries these as the denominator for percentage-based assertions (`pct = 25, of = env_file = "tier-a-limits.env", env = "NETWORK__CPU"`):

| Resource | Value in the repo | Unit |
| :--- | :--- | :--- |
| CPU instructions | `100000000` | 100 million metered instructions |
| Memory | `41943040` | 40 MiB |
| Ledger read bytes | `200000` | ~200 KB |
| Ledger write bytes | `132096` | ~129 KiB |

::: warning These are Protocol 23 figures
The file's own header says it: *"Limits are set by validator consensus and may change across protocol versions. Source: Stellar Lab Network Limits page and Protocol 23 configuration. Re-derive when the target protocol changes."* Tier 3's host implements **Protocol 28**. Read the four numbers above as a worked example of the shape of the limits, and get the live values from the network you are targeting (`soroban` CLI network settings / the Stellar Documentation hub's protocol chapter) before you rely on one.

Two other figures older Tollcraft docs quoted — a 40-entry read and 25-entry write cap — have **no source in any Tollcraft repository**, so they are not repeated here. Ledger-entry counts are network settings; query them.
:::

Ledger *rent* is a separate, refundable-deposit mechanism priced per byte-times-ledger of entry lifetime; it is not one of the two budget dimensions above and no Tollcraft tool computes it.

---

## How a cost type becomes a number

The host does not count raw WASM opcodes. It meters **86 `ContractCostType` categories** (`stellar-xdr` 28.0.0 — `WasmInsnExec = 0`, `MemAlloc = 1`, `MemCpy = 2`, `MemCmp = 3`, `DispatchHostFunction = 4`, `VisitObject = 5`, `ValSer = 6`, `ValDeser = 7`, …).

Each maps an input to a cost through a linear model (`soroban-env-host::budget::HostCostModel`), quoted from its own doc comment:

```text
f(x) = I * (a + b · x)
```

* `I` — a scale factor: the number of iterations the linear model inside the parentheses repeats.
* `a` — fixed overhead, `b` — the marginal coefficient. Both are extracted from an **on-chain cost schedule**, so technically not fixed at all.
* `x` — the runtime input: event count, buffer length, hashing rounds. `None` when the cost is input-independent.
* The `b` term is scaled by `COST_MODEL_LIN_TERM_SCALE_BITS = 7` during parameter fitting to retain significant digits, so the result is shifted back by the same factor.

::: info Three properties stated in the source
* The **same** `CostType`, applied to different parameters and variables, computes memory as well as CPU.
* The types were chosen so that (1) their runtime cost characteristics are describable by a linear model and (2) together they cover the vast majority of `env` operations.
* The parameters are **calibrated empirically** — the crate's own benchmarks are the reference. Which means the authoritative cost of `VerifyEd25519Sig` is the schedule the network is running, not a constant a documentation page can keep current.
:::

The categories storage operations dominate — `WasmInsnExec`, `DispatchHostFunction`, `MemAlloc`/`MemCpy`, `VisitObject`, `ComputeSha256Hash`, `VerifyEd25519Sig` — are real `ContractCostType` variants. Their individual instruction counts are **not** reproduced here, for the reason above: they are schedule values, they differ by protocol, and no Tollcraft repository measures them.

---

## Storage: the heavyweight

```rust
env.storage().instance().set(&key, &user_data);
```

compounds several meters:

1. A ledger entry write (counted against the network's entry-write cap).
2. Ledger write bytes, from the XDR-serialized size of `user_data`.
3. Serialization CPU, metered under the value-serialization cost types.
4. `DispatchHostFunction` overhead for the crossing itself.

Executing it in a loop of `N` iterations multiplies all four by `N`. That is the pattern `SOROBAN_STORAGE_IN_LOOP` — the cost linter's single Deny-level lint — exists to stop at compile time.

---

## Non-refundable vs refundable

* **Non-refundable** — resources permanently consumed during execution: CPU, entry reads, entry writes. Even a transaction that panics leaves this portion with the validators.
* **Refundable** — pre-authorized deposits for the maximum possible event emission, return-value size, and rent extension. The network refunds the unused portion on completion.

---

## What `soroban-cost-profiler` measures

::: danger Not the fee
Read the profiler's numbers as *where the host charged*, never as *what you will pay*. The engine gives the tracer a call hook and no instruction hook, so WASM-side cost is **one synthetic unit per call boundary** and the only network-derived figures in a trace are the CPU and memory deltas read from the budget around a host call.
:::

What each axis of `--metric` reports, measured on this repository's own fixture:

| `--metric` | Column it reads | Where the number comes from |
| :--- | :--- | :--- |
| `cpu` | `exclusive_cpu` | Synthetic units per WASM boundary + budget CPU deltas around host calls |
| `memory` | `exclusive_mem` | Budget memory deltas around host calls (peak, not net) |
| `hostcalls` | `exclusive_hostcalls` | Count of `HostCall` events — the cleanest signal the tool produces |

Measured together on `memory_heavy_loop` at 100 iterations: `host[0]` = **125022** cpu, **50080** memory, **102** host calls — the 102 being exactly `vec_new` + 100 × `vec_push_back` + `vec_len`. A pure-compute export that calls no host function produces `wasm[0] 0` on all three axes, and that zero is a property of the engine, not of the contract.

What the profiler therefore cannot give you:

* **Per-cost-type attribution.** The tracer reads the two aggregate counters, not `get_cost_tracker(cost_type)`, so a trace cannot say "this was `VmMemRead`". See [Spike 01](../reference/spike_budget_api.md).
* **A line number.** Every event arrives at `pc = 0`, so frames read `wasm[0]` and `host[0]`. Source mapping is built and tested underneath; the trace never feeds it an address.
* **A fee.** For the instructions the network will charge, use Tier 2 — `soroban-budget-assert` runs your contract under the real cost model and asserts against it.
