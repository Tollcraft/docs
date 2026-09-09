# Exclusive vs. Inclusive Costs

> Understanding how the profiler attributes resource consumption across function call hierarchies.

---

## The Concept

When analyzing a flamegraph or profiling report, every function has two primary cost metrics:

1. **Exclusive Cost (Self Cost):** Resources consumed directly by the function's own instructions, excluding any child functions it calls.
2. **Inclusive Cost (Total Cost):** Total resources consumed by the function itself *plus* all descendants, nested helper functions, and host operations it invokes.

```
┌─────────────────────────────────────────────────────────────┐
│ transfer_tokens()                     [Inclusive: 450,000]  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Self execution logic                 [Exclusive: 15,000]│ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────┐     ┌─────────────────────────┐ │
│ │ verify_signature()      │     │ update_balance()        │ │
│ │ [Inclusive: 310,000]    │     │ [Inclusive: 125,000]    │ │
│ │ [Exclusive: 310,000]    │     │ [Exclusive: 25,000]     │ │
│ └─────────────────────────┘     │ ┌─────────────────────┐ │ │
│                                 │ │ storage().set()     │ │ │
│                                 │ │ [Inclusive: 100,000]│ │ │
│                                 │ │ [Exclusive: 100,000]│ │ │
│                                 │ └─────────────────────┘ │ │
│                                 └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

In this example:
* `transfer_tokens` has a high **inclusive** cost (450,000 CPU instructions), but its **exclusive** cost is only 15,000 instructions.
* `verify_signature` has an identical inclusive and exclusive cost (310,000 instructions) because it is a leaf node doing heavy crypto work.
* `storage().set()` is a host call boundary where 100,000 instructions are spent in ledger state persistence.

---

## How the Profiler Aggregates Costs

During execution, `soroban-cost-profiler` receives a stream of `TraceEvent` objects from the execution engine.

The `ProfileAggregator` maintains an internal stack of `CallStackNode`s:

```rust
pub struct CallStackNode {
    pub frame: SourceFrame,
    pub exclusive_cpu: u64,
    pub inclusive_cpu: u64,
    pub exclusive_mem: u64,
    pub inclusive_mem: u64,
    pub children: HashMap<String, CallStackNode>,
}
```

### Aggregation Rules

1. **Function Entry (`Call` Event):**
   * A new frame is pushed onto the active call stack.
2. **Instruction Step (`Step` Event):**
   * The delta of CPU instructions consumed since the last event is added directly to the top frame's `exclusive_cpu`.
   * Any memory allocated is added to `exclusive_mem`.
3. **Function Exit (`Return` Event):**
   * The frame is popped from the call stack.
   * The frame's total `inclusive_cpu` is calculated as:
     $$\text{inclusive\_cpu} = \text{exclusive\_cpu} + \sum \text{child.inclusive\_cpu}$$
   * The inclusive total is added to the parent frame's running child total.

---

## How to Prioritize Refactoring

When optimizing a contract to lower its execution fee, use both metrics together:

### 1. Look for High Exclusive Cost (Hotspots)
A function with a wide horizontal bar on top of the flamegraph (no children below it) indicates a compute-heavy bottleneck in your own code:
* An un-vectorized mathematical loop.
* A repetitive serialization or hashing routine.
* Inefficient sorting or list searching.
* **Remedy:** Optimize algorithms, replace dynamic allocations with static arrays, or pre-compute values off-chain.

### 2. Look for High Inclusive Cost (Branch Bottlenecks)
A function with high inclusive cost but low exclusive cost is delegating work inefficiently:
* A coordinator function invoking `env.storage().instance().get()` repeatedly across multiple child helpers.
* Redundant cross-contract calls inside a loop.
* **Remedy:** Hoist state reads to the top of the function and pass borrowed references to child helpers instead of re-fetching state from storage.

