# Reading & Visualizing Profiles

> The artifact `soroban-cost-profiler` writes is collapsed-stack text. This page is how to turn that text
> into a picture with the tools that draw pictures, and how to read the picture honestly.

---

## What the profiler writes, and what it does not

The tool writes text and no SVG. It bundles no renderer and takes no dependency on `inferno`, because the
collapsed-stack format is the interchange: [flamegraph.pl](https://github.com/brendangregg/FlameGraph) and
[speedscope.app](https://www.speedscope.app) both read it, and both are better at drawing than this tool
needs to be.

```bash
soroban-cost-profiler --wasm contract.wasm --fn execute_order --output order.folded

# a picture, in one command
flamegraph.pl order.folded > order.svg && open order.svg

# or an interactive one, in the browser
open https://www.speedscope.app      # then drop order.folded onto the page
```

`--format json --output -` gives the same tree as structured data when you want to walk it from a script;
`--format raw` gives the event stream before any of it was named or folded.

---

## What is a Flamegraph?

A flamegraph is an interactive visualization of hierarchical profile data. Originally invented by Brendan
Gregg, it shows call stacks and resource consumption at once:

* **Y-axis (vertical):** call stack depth. The root is at the bottom; nested calls appear above it.
* **X-axis (horizontal):** proportion of the resource being counted. A wider box is more of it — not more
  time on a wall clock, more of the metric the profile was written in.
* **Order along X:** stacks are merged and sorted so identical paths share a box. The horizontal position
  carries no meaning; do not read left-to-right as chronological.

In speedscope.app, the same file gives three views: **Sequence** keeps the trace's own order, **Left
Heavy** sorts by cost so the widest contributor sits at the far left, and **Sandwich** shows one function
with its callers above and its callees below.

Interactions come from whichever tool drew the picture, not from this profiler: `flamegraph.pl` output
supports hover for the full frame name and a click to zoom; speedscope supports search, zoom and the view
switch above.

---

## Reading patterns

::: warning Read these with the ceiling in mind
The engine reports call boundaries and no program counter, so today most frames land at `wasm[0]` and the
tree from a directly invoked export is one level deep. A wide box means "this frame holds the most
recorded cost", not "this source line executed the most instructions".
[Known Risks & Failure Modes](../reference/risks.md) is the full list, and
`--metric hostcalls` is the quickest way to see whether the run recorded any host transitions at all.
:::

### Pattern 1: A wide leaf

A box with nothing above it.

* **Meaning:** high **exclusive** cost — the frame was running when the cost was recorded, rather than
  waiting on a child.
* **On this profiler:** a `host[…]` frame is exactly this shape. The budget deltas read around a host call
  land on the host frame, so a loop of `vec_push_back` calls shows up as one wide `host[0]` bar. Measured on
  the repository's `dummy-contract`: `memory_heavy_loop` at 100 iterations is 125,022 CPU units, 50,080
  memory bytes, and 102 host calls — `vec_new` + 100 × `vec_push_back` + `vec_len`.

### Pattern 2: A tall, thin stack

Many levels, each nearly as wide as the one below.

* **Meaning:** inclusive cost dominated by a single path — nothing is wasted *here*, the cost is simply
  downstream.
* **On this profiler:** you will rarely see it. Internal wasm calls are not traced, so a contract whose
  entry point calls five helpers yields one Call/Return pair. Depth appears when host transitions
  intervene.

### Pattern 3: A plateau

A wide box near the top with children of similar width beneath it.

* **Meaning:** the whole subtree is the expensive part, and the cost is spread rather than concentrated —
  usually a loop doing modest work many times.
* **On this profiler:** read it as a *shape*, not a magnitude. The counts are boundary counts; the ratio
  between two runs of the same contract is the useful signal, which is what `compare` reports.

### Pattern 4: A frame named `wasm[17]`, or a file that is all zeros

* `wasm[<pc>]` with a number that is not `0` means the binary had no DWARF line tables and no `name`
  entry for that function — the run also printed a `warning:` saying so. Build with a profiling profile
  ([The Debug Precondition](../getting-started/debug_precondition.md)).
* A profile that is one line of `0` is not a broken file; it is the tool reporting that the engine gave it
  nothing to attribute. Read the terminal line — `no function recorded any exclusive cost (cpu)` — then
  `--format raw` to see what the engine actually emitted.

---

## From a picture to a decision

The picture answers "where do I look". It does not answer "what will this cost on mainnet". For that, use
[`soroban-budget-assert`](/budget-assert/) in a test, which reads the network's own metering, and use
`soroban-cost-profiler compare before.folded after.folded` to check whether the change you just made moved
the cost in the direction you wanted.
