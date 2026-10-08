# Visualizing with Speedscope

> Using Speedscope for interactive, multi-dimensional profile exploration.

---

## Why Speedscope?

While a static SVG is good for a quick look, [Speedscope](https://www.speedscope.app) gives an interactive
browser UI over the same file — and speedscope.app is what the profiler's own documentation names as the
first place a `.folded` artifact goes. It supports:

* **Chronological view (Sequence):** Visualizes what the trace recorded, in order.
* **Aggregated view (Left Heavy):** Merges common call paths to reveal bottlenecks.
* **Sandwich view:** Shows all callers and callees of a specific function.

---

## Exporting Folded Stacks

The default format *is* the one speedscope reads, so the shortest command produces it:

```bash
soroban-cost-profiler \
  --wasm target/wasm32-unknown-unknown/profiling/my_contract.wasm \
  --fn process_deposit \
  --output profile.folded
```

`--format folded` is already the default; the other two values are `json` and `raw`. There is no
`--format speedscope` and there is no `svg` format.

The resulting file is the collapsed-stack format — a stack path, a space, the cost:

```text
wasm[0];process_deposit 1508000
wasm[0];process_deposit;calculate_interest 280000
wasm[0];process_deposit;update_balances;host[0] 192000
```

The trailing integer is the cost on that path **in whatever `--metric` the run used** (`cpu` by default, or
`memory`, or `hostcalls`). A `.folded` file records no metric of its own, which is why both sides of a
`compare` have to agree on the flag in advance.

---

## Loading into Speedscope

1. Open [https://www.speedscope.app](https://www.speedscope.app) in your browser.
2. Drag and drop `profile.folded` onto the window.
3. The file is parsed completely locally in your browser—no contract bytecode or execution data leaves your machine.

---

## The Three Speedscope Views

### 1. Sequence view
In the Sequence view, the horizontal axis is the order the trace recorded.
* Use it to see the execution lifecycle: initialization, authorization checks, core math, state updates,
  event emission.
* Quickly identify whether a slow operation happened early or late in the transaction.

::: info This view has little to show today
Only the host-initiated call is recorded as a boundary, so a directly invoked export traces one frame.
Sequence and Left Heavy differ mainly when host transitions are in the run.
:::

### 2. Left Heavy View
In the Left Heavy view, all identical call stacks are grouped and sorted with the heaviest consumers on the left.
* Instantly answers: *"Which single function consumed the largest slice of the transaction fee?"*

### 3. Sandwich View
Click on any function in the list to open the Sandwich view:
* **Top panel:** Shows all functions that called this function (and what percentage of cost came from each caller).
* **Middle panel:** The selected function itself.
* **Bottom panel:** All child functions called by this function.

