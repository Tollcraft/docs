# Host Function Cost Attribution

> How `soroban-cost-profiler` solves the "Black Box" problem of native Soroban host calls.

---

## The Host Function Black Box

In Soroban, smart contracts execute as guest WebAssembly (WASM) code running inside the host environment (`soroban-env-host`).

The majority of expensive operations—cryptographic signature checks, SHA-256 hashing, ledger entry reads, ledger writes, and PRNG operations—do not run inside the WASM bytecode. Instead, they execute in native Rust inside the host when the guest invokes a host function (e.g., `vec_new`, `map_get`, `put_contract_data`).

Because host functions run outside the WASM virtual machine:
1. WASM instruction counters cannot see internal host operations.
2. Standard DWARF debug tables contain zero line information for host library code.
3. The public Soroban Host `Budget` API only exposes `get_cost_tracker()`, which returns **cumulative totals** across the entire transaction run rather than per-call-site metrics.

---

## Boundary Snapshot Technique

To attribute host costs back to the exact Rust line in your contract without forking or altering `rs-soroban-env`, `soroban-cost-profiler` utilizes **Boundary Snapshotting**.

```
WASM Guest Execution                      Soroban Host Environment
─────────────────────                      ────────────────────────
line 42: env.crypto().sha256(&data)
      │
      ├─► [1. Snapshot Host Tracker] ───► CPU: 1,450,000 | Mem: 32,000
      │
      ├─► HostCall: compute_sha256
      │         │
      │         ▼ (Host executes native C/Rust SHA-256)
      │
      ├─► HostReturn
      │
      └─► [2. Snapshot Host Tracker] ───► CPU: 1,453,200 | Mem: 32,128
                │
                ▼
      Delta Calculation:
      CPU Cost: +3,200 instructions
      Memory Delta: +128 bytes
      Attributed to line 42 (`my_contract.rs:42`)
```

### How the Algorithm Works

1. **Host Call Detection:** When the WASM tracer encounters a call opcode targeting an imported host function (module `env`), it records a `HostCall` boundary event.
2. **Pre-Invocation Snapshot:** The profiler records the current cumulative CPU instructions, storage byte counts, and memory allocations reported by `soroban_env_host::budget::Budget::get_cost_tracker()`.
3. **Host Execution:** The host function executes natively.
4. **Post-Invocation Snapshot:** Upon return to the WASM caller, the profiler takes a second snapshot of the host tracker.
5. **Delta Attribution:** The delta is attributed directly to the active `SourceFrame` (the contract caller line) as an exclusive host expense.

---

## What Can and Cannot Be Attributed

| Metric | Attribution Resolution | Accuracy |
| :--- | :--- | :--- |
| **WASM Instruction Count** | Per-instruction / Per-line | Exact (100%) |
| **Host Function CPU Cost** | Per-call-site block | High (diffed per invocation) |
| **Host Sub-Operation Breakdown** | Aggregated to host call boundary | Coarse (cannot see sub-steps inside host function) |
| **Storage Entry Access Count** | Per-call-site | Exact (0 or 1 per call) |
| **Storage Payload Bytes** | Per-call-site | Exact (diffed per mutation) |

This boundary snapshot mechanism ensures that developers get actionable, call-site-specific visibility without relying on unstable, internal upstream APIs.

