# Visualizing with Speedscope

> Using Speedscope for interactive, multi-dimensional profile exploration.

---

## Why Speedscope?

While static SVG flamegraphs are excellent for quick inspections, [Speedscope](https://www.speedscope.app) provides an interactive web-based interface designed specifically for performance analysis. It supports:

* **Chronological view (Time Order):** Visualizes exactly what happened in execution order.
* **Aggregated view (Left Heavy):** Merges common call paths to reveal bottlenecks.
* **Sandwich view:** Shows all callers and callees of a specific function.

---

## Exporting Folded Stacks

`soroban-cost-profiler` can export folded stack format directly:

```bash
soroban-cost-profiler \
  --wasm target/wasm32-unknown-unknown/profiling/my_contract.wasm \
  --fn process_deposit \
  --format speedscope \
  --output profile.folded
```

The resulting file contains lines formatted as:

```text
root;init_ledger;verify_caller 14500
root;process_deposit;calculate_interest 280000
root;process_deposit;update_balances;storage_set 1920000
```

Where the final integer represents the number of metered CPU instructions consumed on that path.

---

## Loading into Speedscope

1. Open [https://www.speedscope.app](https://www.speedscope.app) in your browser.
2. Drag and drop `profile.folded` onto the window.
3. The file is parsed completely locally in your browser—no contract bytecode or execution data leaves your machine.

---

## The Three Speedscope Views

### 1. Time Order View
In the Time Order view, the horizontal axis represents the progression of execution time (instruction order).
* Use this to see the execution lifecycle: initialization $\to$ authorization checks $\to$ core math $\to$ state updates $\to$ event emission.
* Quickly identify if a slow operation occurred early or late in the transaction.

### 2. Left Heavy View
In the Left Heavy view, all identical call stacks are grouped and sorted with the heaviest consumers on the left.
* Instantly answers: *"Which single function consumed the largest slice of the transaction fee?"*

### 3. Sandwich View
Click on any function in the list to open the Sandwich view:
* **Top panel:** Shows all functions that called this function (and what percentage of cost came from each caller).
* **Middle panel:** The selected function itself.
* **Bottom panel:** All child functions called by this function.

