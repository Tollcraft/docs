# Spike 01: Budget API Limitations

> The Phase 2 research question, its findings, and what actually shipped against them.

This is a record of a spike, kept because its conclusions still shape the architecture. The "Findings" and "Decision" sections are what was established in Phase 2; the **"What shipped against it"** section is measured against the current build and is where the plan and the engine part company.

---

## Research Objective

Investigate whether `soroban-env-host` allows intercepting per-call-site host costs without maintaining a fork of `rs-soroban-env`. If not, determine how to accurately extract resource metrics using only public interfaces.

---

## Key Findings

### 1. Cumulative rollups only, no call-site granularity
The public `soroban_sdk::testutils::budget::Budget` interface exposes `get_cost_tracker(cost_type)`. This gives a **cumulative** tracker of iterations and derived CPU/memory consumption *per `ContractCostType`*, aggregated across the whole execution.

* It is a read-after-the-fact rollup.
* It says *"this transaction spent X total on `VmMemRead`"*, and does **not** say *"this specific call inside `transfer()` spent Y"*.

### 2. No public interception hooks
Internal metering hooks such as `invocation_metering` exist inside `rs-soroban-env` but are internal and unstable. The host's `charge()` function exposes no hookable callback that live host operations can be correlated against the tracer's call stack.

---

## Architectural Decision

Maintaining a custom fork of `rs-soroban-env` was rejected: severe upstream maintenance burden, plus the security implications of running a private fork of the runtime being measured.

Instead, the profiler scoped down to **cumulative boundary diffing**:

1. At each `HostCall` boundary, snapshot the public budget state.
2. Let the host function complete natively.
3. At the matching `HostReturn`, snapshot again.
4. Charge the difference to that host call.

This yields an accurate *block* of cost per host call even though it cannot break the block down into the sub-operations inside the host.

::: info The rule this established
`AGENTS.md`'s "rely on public host APIs only" rule comes from this spike, and it is why `soroban-env-host`'s `testutils` feature stays off in the profiler's own build — that feature is what pulls `arbitrary` into the dependency tree.
:::

---

## What shipped against it

Measured on the current build rather than assumed.

**The mechanism landed, and it is the accurate half of a profile.** `record_host_call` snapshots and `record_host_return` diffs, with `unwrap_or(0)` so a host that cannot report its budget degrades into an uncosted trace instead of aborting the run. The host calls that cross do get real numbers: `memory_heavy_loop` at 100 iterations measures `host[0] 125022` in CPU, `50080` in memory, and `102` host calls — the 102 being exactly `vec_new` + 100 × `vec_push_back` + `vec_len`.

**The API turned out to be a different one.** The implementation does not read the per-`CostType` tracker. It reads the two aggregate counters through `soroban_env_host::budget::AsBudget`:

```rust
let budget = host.as_budget();
self.host_snapshot_cpu = budget.get_cpu_insns_consumed().unwrap_or(0);
self.host_snapshot_mem = budget.get_mem_bytes_consumed().unwrap_or(0);
```

The consequence is that the diff is a single total per boundary, not a per-`CostType` breakdown, so the "what spent it — `VmMemRead` or `CryptoVerifySig`?" question this spike framed is **not** what the artifact answers. It answers "how much did the host charge while this frame was open".

**Attribution is to a call-site frame, not to a source line.** The original expectation was that the diffed block maps to "the specific line in contract code that triggered it". It does not, for two independent reasons, neither of them the budget API:

* `wasmi` 2.0's call hook is handed the hook *variant* and nothing else — no callee, no offset — so every event is recorded at `pc = 0`.
* Host frames are labelled `host[<pc>]` because the event says execution crossed into the host but names no host function. The call site is the best label available, and today every one of them is `host[0]`.

So the spike's own framing was right about the host and wrong about where the ceiling sits: **the budget API is not what limits call-site granularity — the WASM engine's missing instruction hook is.** Even a per-`CostType`, per-operation budget API would arrive at a trace that cannot say which line ran. See [Known Risks](./risks.md) for the two consequences that follow, and [Architecture](./architecture.md) for where the tracer records these snapshots.
