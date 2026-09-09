# Generating & Reading Flamegraphs

> How to generate and interpret interactive SVG flamegraphs for Soroban smart contracts.

---

## What is a Flamegraph?

A flamegraph is an interactive visualization of hierarchical profile data. Originally invented by Brendan Gregg, flamegraphs visualize call stacks and resource consumption simultaneously:

* **Y-Axis (Vertical):** Represents the **call stack depth**. The top-level entry point is at the bottom (or root), and nested function calls appear higher up the stack.
* **X-Axis (Horizontal):** Represents the **proportion of resource consumption** (CPU instructions or memory bytes). The wider a box is, the more CPU instructions were spent in that function and its descendants.
* **Order:** Boxes along the X-axis are sorted alphabetically or logically to merge identical call paths, not chronologically.

---

## Generating an SVG Flamegraph

Run the profiler with the `--output` flag specifying an `.svg` extension:

```bash
soroban-cost-profiler \
  --wasm target/wasm32-unknown-unknown/profiling/my_contract.wasm \
  --fn execute_order \
  --output flamegraph.svg
```

The tool uses `inferno` under the hood to fold stacks and render an SVG directly without requiring external Perl or Python dependencies.

---

## Interacting with the SVG

When you open `flamegraph.svg` in any browser:

1. **Hover:** Hover your mouse over any box to view:
   * Full qualified function name (e.g., `my_contract::math::calculate_sqrt`).
   * Resolved file and line number (e.g., `src/math.rs:89`).
   * Total CPU instructions consumed.
   * Percentage of the total transaction budget.
2. **Click to Zoom:** Click any box to zoom into that function call and make it the new root of the view. This makes inspecting deep call stacks trivial.
3. **Reset Zoom:** Click the **Reset Zoom** button in the top corner to return to the full transaction view.
4. **Search:** Press `Ctrl+F` (or `Cmd+F`) to search for function names. Matching boxes will highlight in magenta.

---

## Reading Patterns in Flamegraphs

### Pattern 1: The Plateau (Heavy Leaf Function)
A wide box at the top of the stack with no children above it.
* **Meaning:** This function has high **exclusive cost**. It is spending massive CPU cycles doing work internally (e.g., tight loop, mathematical calculations).
* **Action:** Inspect the function's internal implementation for optimization opportunities.

### Pattern 2: The Tower of Babel (Deep Recursion)
Tall, narrow stacks that climb vertically.
* **Meaning:** Deeply nested or recursive function calls.
* **Action:** Check whether recursion can be converted into an iterative loop to save stack frames and WASM function call overhead.

### Pattern 3: The Toothcomb (Repeated Host Dispatches)
A sawtooth pattern of dozens of small, identical boxes calling into host functions (e.g., `put_contract_data` or `get_contract_data`).
* **Meaning:** The contract is making frequent, fine-grained host calls across a loop or collection.
* **Action:** Batch operations in memory and perform bulk host invocations.

