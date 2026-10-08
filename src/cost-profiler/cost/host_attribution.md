# Host Function Cost Attribution

> How `soroban-cost-profiler` handles the "black box" problem of native Soroban host calls — and how much of the box it can actually see.

---

## The black box

Soroban contracts execute as guest WASM inside `soroban-env-host`. Most of the expensive work — signature verification, SHA-256, ledger reads and writes — does not run in the guest's bytecode at all. It runs natively in the host when the guest calls an imported host function (`vec_new`, `map_get`, `put_contract_data`, `compute_hash_sha256`, …), the same way a program calls `malloc`.

Three consequences make that a black box for a profiler:

1. A WASM instruction counter cannot see operations that never executed in the WASM stream.
2. The contract's DWARF tables carry **zero** line information for host library code — the host is not compiled into the artifact.
3. The public budget API reports **cumulative totals**, so a read after the fact says what the whole run cost and not what one call cost.

Point 3 is what [Spike 01](../reference/spike_budget_api.md) investigated, and the design below is its answer.

---

## Boundary snapshotting

To attribute host cost to a call site **without forking `rs-soroban-env`**, the profiler brackets every host transition with two budget reads and charges the difference to a frame opened for the call:

```text
WASM guest                            Soroban host
──────────                            ────────────
Call (pc = 0)
  │
  ├─► HostCall                         record_host_call:
  │      snapshot cpu  = 1,450,000     budget.get_cpu_insns_consumed()
  │      snapshot mem  =     32,000    budget.get_mem_bytes_consumed()
  │      (the event itself carries 0 cost)
  │
  │      host runs natively…
  │
  ├─► HostReturn                       record_host_return:
  │      current cpu   = 1,453,200     delta cpu = 3,200
  │      current mem   =     32,128     delta mem = 128
  │      charged to the host[0] frame that the HostCall opened
  │
  ▼
Return (pc = 0)
```

In code, the reads are the two aggregate counters rather than the per-cost-type tracker:

```rust
let budget = host.as_budget();
self.host_snapshot_cpu = budget.get_cpu_insns_consumed().unwrap_or(0);
self.host_snapshot_mem = budget.get_mem_bytes_consumed().unwrap_or(0);
```

Two details that decide correctness:

* **The entry event carries zero.** The budget is cumulative, so the cost of a host call is only knowable on return, as a delta from the entry snapshot. Skip the entry snapshot and every host call since the start of the run is attributed to whichever function returns last.
* **Reads are `unwrap_or(0)`.** A host that cannot report its budget should degrade into an uncosted trace, not abort the run being profiled.

`unwrap_or` is also why the numbers are a lower bound: a failed read is a zero, not an error.

---

## What this attributes, and what it does not

| Quantity | Resolution today | Why |
| :--- | :--- | :--- |
| **Host CPU cost** | Per host frame, budget-measured | The only accurate numbers in a trace. |
| **Host memory cost** | Per host frame, budget-measured | Peak count of the memory dimension, summed per frame — see [Exclusive vs. Inclusive](./exclusive_vs_inclusive.md). |
| **Host call count** | Exact, per frame | `exclusive_hostcalls = 1` on each `HostCall`; `--metric hostcalls` reads it. |
| **Which host function ran** | **Not recorded** | The event says execution crossed into the host and names no function, so the frame label is `host[<pc>]`. |
| **Which contract line triggered it** | **Not recorded** | `wasmi` 2.0's call hook is handed the hook *variant* and nothing else, so every event is `pc = 0`. |
| **Host sub-operations** | **Not visible** | One total per boundary. The per-`CostType` tracker is not read. |
| **WASM instructions between boundaries** | **Not measured** | One synthetic unit per boundary; there is no instruction hook. |

::: danger Correct the older version of this page
Earlier Tollcraft documentation claimed "WASM instruction count — per-instruction / per-line, Exact (100%)" and that deltas were "attributed directly to the active `SourceFrame` (the contract caller line)". Neither is true of the current engine: the attribution target is a `host[0]` frame, not a line, and WASM-side counts are boundary counts. The mechanism is exactly as described above; it is the *resolution* that was oversold.
:::

---

## Measured, on this repository's own fixture

`memory_heavy_loop` at 100 iterations, from `fixtures/build.sh`'s artifact:

```text
wasm[0];host[0] 125022      # --metric cpu
wasm[0];host[0]  50080      # --metric memory
wasm[0];host[0]    102      # --metric hostcalls
```

The 102 is exactly `vec_new` + 100 × `vec_push_back` + `vec_len` — the vector API's host calls, one per round of the loop plus the two setup/teardown calls. That reconciliation is the point: a host-call count this tool reports can be checked against the source by hand, which makes it the most trustworthy axis on the flag.

A pure-compute export that calls no host function produces `wasm[0] 0` on all three metrics — the zeros are a property of the contract, not of the tool.

---

## Host bindings: what makes any of this possible

Before `src/host.rs`, the profiler linked against an empty `wasmi::Linker`, so instantiation failed on the first import and **no contract that touched an SDK data structure could be traced at all**.

The bindings are generated, not hand-written. `soroban_env_host::call_macro_with_all_host_functions` hands over the whole host interface as an x-macro — every function's WASM import name, its typed argument list, and the `Host` method implementing it — and the module turns each entry into one `wasmi::Linker::func_new` registration:

```text
contract word (i64)        typed argument        host method
     --[ HostArg::from_word ]->  VecObject   --> Host::vec_len
     <-[ HostRet::write ]-----   U32Val      <--
```

199 registrations, from the same table the production host builds its linker from, calling into the same `Host` the ledger state was built around. **The profiler traces the real implementation, not a model of it** — which is why a host-call count from this tool means what it says.

::: warning Two things the bindings do not cover
* **Contract-to-contract `call`.** Production hands its dispatch a live engine caller so a contract can re-enter wasm; these `Env` methods run with none, so those two functions return a host error instead of recursing. See [Cross-Contract Calls](../guides/cross_contract.md).
* **Contract-scoped reads.** A key built from the current contract ID — `get_contract_data` and siblings, `require_auth` — stops on the empty contract frame before reaching `--state`.
:::

---

## Unmatched pairs and traps

The pair is what makes the number mean anything, so a trace that ends between them is handled explicitly: an unmatched `Return` (whose `Call` was already drained by `flush_trace`) is ignored rather than panicking, and frames still open when the stream ends are folded up the stack and kept. The cost of a host call that never returned is simply never charged — which is why a trapped run's artifact says "its costs are incomplete because the call never returned".
