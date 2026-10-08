# Exclusive vs. Inclusive Costs

> How the profiler attributes cost across a call hierarchy, and which half of that hierarchy exists today.

---

## The two readings

Every frame in a profile carries both:

1. **Exclusive (self) cost** — consumed by the frame's own work, excluding anything it called.
2. **Inclusive (total) cost** — the frame's own work *plus* every descendant it caused to run.

The distinction is the difference between "this function is slow" and "this function is a doorway to something slow", and only one of the two is a fix target.

```text
transfer_tokens()                 inclusive 450,000 · exclusive 15,000
├── verify_signature()            inclusive 310,000 · exclusive 310,000   ← leaf: the work is here
└── update_balance()              inclusive 125,000 · exclusive  25,000
    └── host[0] (storage write)   inclusive 100,000 · exclusive 100,000
```

::: info This tree is a teaching shape, not a transcript
Nothing `soroban-cost-profiler` writes looks like this yet. The engine reports one boundary pair for the host-initiated call, so a real run folds into `wasm[0]` with at most one `host[0]` child. The fold is written and tested against exactly this deeper shape so it is ready when the engine reports inner calls — see [Current fidelity](#current-fidelity-what-a-real-trace-folds-into).
:::

---

## The structures

```rust
pub struct CallStackNode {
    pub frame: SourceFrame,
    pub exclusive_cpu: u64,
    pub inclusive_cpu: u64,
    pub exclusive_mem: u64,
    pub inclusive_mem: u64,
    pub exclusive_hostcalls: u64,
    pub inclusive_hostcalls: u64,
    pub children: HashMap<String, CallStackNode>,
}
```

`children` is keyed by function name, which is why `SourceFrame::function_name` normalizes rustc's closure segments — two spellings of one function would split its cost across two frames.

---

## Aggregation rules

`ProfileAggregator::aggregate` folds the flat event stream with an open-frame stack. Per event kind:

| Event | What the fold does |
| :--- | :--- |
| `Call` | Charges the event's own delta to the **caller** — cost recorded between two events accrued before the callee ran — then pushes a frame for the callee. The stream's first `Call` has no caller, so its delta becomes the entry cost of the frame it opens. |
| `Step` | Charges the **innermost open frame**. That is the definition of exclusive cost. If steps arrive with no frame open (a trace taken partway through a run), the frame is opened from the event's `pc` rather than the cost being dropped. |
| `HostCall` | Charges the pending delta to the caller, opens a `host[<pc>]` frame, and sets its `exclusive_hostcalls = 1`. |
| `HostReturn` / `Return` | Charges the frame that is ending, then pops it and hands it to its parent. |

Inclusive cost is not tracked as frames are pushed and popped; it is computed over the finished tree (`compute_inclusive`) before the root is returned, so a caller can read either half without recomputing. Conceptually, for one frame:

```text
inclusive = exclusive + sum(child.inclusive for child in children)
```

::: tip Why the memory peak shows up here
`TraceEvent.mem_cost` is a **delta** read from the host budget, and the budget's memory dimension reports its high-water mark (`peak_count`), not a running net sum. So a parent's inclusive memory is the sum of peaks taken around separate host calls, not the peak of the whole call. Two large allocations that were never live at the same time count twice.
:::

---

## Two input shapes the fold tolerates

Both are reachable from a real contract, so neither is treated as an error:

* **A run that traps mid-call records no `Return`.** Whatever frames are still open when the stream ends are folded up the stack and **kept** — dropping them would discard exactly the expensive tail a profiler exists to show.
* **An unmatched `Return`** (whose `Call` was already drained by `flush_trace`) is ignored rather than panicking.

---

## Current fidelity: what a real trace folds into

Quoted from the aggregator's own doc block:

::: warning
The tree can only be as deep as the boundaries the engine reports and only as named as Stage 2 allows. `wasmi` reports no inner WASM-to-WASM calls and every event carries `pc = 0`, so today's real trace folds into **one `wasm[0]` frame holding a single `host[0]` child with all the measured budget** — the contract's own work is attributed to the WASM frame, and nothing inside it is separated. That is the honest output of the input it is given, and the unnamed frames say so on the flamegraph instead of inventing names.
:::

In other words the exclusive/inclusive machinery is fully implemented and tested against synthetic deeper streams; what limits the reading is the trace, not the fold.

---

## How to prioritize refactoring

Use both halves together.

### High exclusive cost — a hotspot

The wide bar at the *top* of a stack, with nothing above it, is compute in that function's own body: an un-vectorized mathematical loop, repetitive serialization or hashing, an inefficient sort or list search.

**Remedy:** change the algorithm; replace dynamic allocation with fixed-size buffers; pre-compute off-chain.

Today this reading is strongest on a **host** frame, because host exclusive cost is budget-measured: `memory_heavy_loop` at 100 iterations reports `host[0] 125022` exclusive CPU and `50080` exclusive memory, and that number belongs to the host work the loop triggered.

### High inclusive, low exclusive — a branch bottleneck

A frame that delegates: a coordinator calling `env.storage().instance().get()` repeatedly across several child helpers, or redundant calls inside a loop.

**Remedy:** hoist state reads to the top of the function and pass borrowed values down instead of re-fetching from storage.

::: info Reach this case from the cheap side
You do not need a per-frame tree to find it. `--metric hostcalls` counts `HostCall` events, and that count is exact: 100 iterations of a vector loop gives 102 (`vec_new` + 100 × `vec_push_back` + `vec_len`). A loop body making one host call per round is visible in the count even while the frame is still named `host[0]` — and it is the pattern Tier 1's `SOROBAN_STORAGE_IN_LOOP` denies at compile time, before a trace is needed at all.
:::

### Which to act on first

| Symptom | Metric | Next step |
| :--- | :--- | :--- |
| One frame dominates exclusive cost | `--metric cpu` | Read that frame's host budget delta; if it is `host[…]`, count the calls. |
| Many small frames, same name | `--metric hostcalls` | Batch the operations; the count is the regression test. |
| Cost moved after a change | `compare` | Per-function diff of two `.folded` runs. |
| Total is what matters | Tier 2 | `soroban-budget-assert` — the network-metered figure. |
