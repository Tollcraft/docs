# Spike 01: Budget API Limitations

> Technical research on `soroban-env-host` budget metering capabilities and call-site attribution.

---

## Research Objective

Investigate whether the public `soroban-env-host` API allows intercepting per-call-site host costs without maintaining a fork of `rs-soroban-env`. If not, determine how to accurately extract resource metrics using only public interfaces.

---

## Key Findings

### 1. Cumulative Rollups Only
The public `soroban_sdk::testutils::budget::Budget` interface exposes `get_cost_tracker(cost_type)`. This tracker provides a **cumulative sum** of iterations and derived CPU/memory consumption per `ContractCostType`, aggregated across the entire transaction lifecycle.

* It is a read-after-the-fact rollup.
* It reports total costs (e.g., *"this transaction spent 450,000 instructions on `VmMemRead`"*).
* It does **not** provide per-invocation or per-line granularity natively.

### 2. Lack of Public Interception Hooks
While internal metering hooks (such as `invocation_metering`) exist inside `rs-soroban-env`, they are internal and unstable. The host's `charge()` function does not expose a hookable callback mechanism to correlate live host operations with our `ExecutionTracer` call stack.

---

## Architectural Decision

We determined that maintaining a custom fork of `rs-soroban-env` is unacceptable due to upstream maintenance overhead and security implications.

Instead, `soroban-cost-profiler` uses **Cumulative Boundary Diffing**:
1. At each `HostCall` boundary event, the profiler captures a snapshot of the public `Budget::get_cost_tracker()` state.
2. The host function completes natively.
3. At the corresponding `HostReturn` event, the profiler captures a second snapshot.
4. The difference between the two snapshots represents the exact resource block consumed by that host call, which is then mapped to the caller's source line.

---

## Verification & Outcomes

* Eliminates the need for any upstream forks.
* Accurately attributes host costs (storage operations, cryptography, data structures) to the specific line in contract code that triggered them.
* Isolates the profiler from upstream implementation changes in `rs-soroban-env`.

