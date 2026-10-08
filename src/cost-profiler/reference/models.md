# Data Models & Trace Events

> Internal structures, event schemas, and tree representations.

These are the types in `soroban-cost-profiler`'s `src/models.rs`, transcribed from the source rather than from a spec. The comments in the repository say *why* each field is shaped the way it is; where a field's meaning is narrower than its name suggests, that is called out here too.

---

## 1. Event Types (`EventType`)

Five variants, not three — WASM boundaries and host transitions are separate kinds:

```rust
pub enum EventType {
    /// Entry into a WASM function, crossing a frame boundary.
    Call,
    /// The current WASM function frame has exited.
    Return,
    /// A sampled block of cost, emitted once `--sample-rate` accumulates.
    Step,
    /// A call from WASM into a host-provided Soroban function.
    HostCall,
    /// Return from a host function back into WASM.
    HostReturn,
}
```

The aggregator selects on this enum, so two variants comparing equal would merge, say, a `Call` with a `Step` and corrupt the tree built from them — `tests` in `src/models.rs` assert all five are distinct and survive a clone.

---

## 2. Trace Event (`TraceEvent`)

```rust
pub struct TraceEvent {
    /// Where in the wasm this event happened, in the address space `addr2line`
    /// indexes: an offset into the code section's payload, where address `0` is
    /// the function-count byte.
    pub pc: usize,
    pub event_type: EventType,
    pub cpu_cost: u64, // CPU cost consumed since last event
    pub mem_cost: u64, // Memory allocated since last event
}
```

Two things about `pc` matter when reading a profile:

* It is **not** a file offset and **not** a linear-memory address. `crate::source_map::CodeMap` translates between those spaces.
* `wasmi` 2.0 gives its call hook no instruction pointer, so **every event the tracer records is `0`**. `0` is a real address that belongs to no instruction, which is what a frame named `wasm[0]` is reporting.

The two cost fields are deltas since the previous event, not cumulative readings — except at a host boundary, where `record_host_call` snapshots the cumulative budget and `record_host_return` charges the frame the difference.

---

## 3. Source Frame (`SourceFrame`)

```rust
pub struct SourceFrame {
    pub function_name: String,
    pub file_path: Option<String>,
    pub line_number: Option<u32>,
}
```

`function_name` is what `addr2line` demangled, with rustc's anonymous closure segments rewritten to `[closure]` / `[closure#N]`. That rewriting is load-bearing: `CallStackNode::children` pools frames by this string, so two names differing only in `{closure}` noise would split one function's cost across two frames.

When DWARF is absent, `file_path` and `line_number` are `None` and the name comes from the binary's `name` section if it has one. When nothing resolves, Stage 3 writes a placeholder frame instead of inventing a name:

| Frame | Meaning |
| :--- | :--- |
| `wasm[<pc>]` | a WASM boundary Stage 2 did not resolve. Today that is every frame, and every one is `wasm[0]`. |
| `host[<pc>]` | a Soroban host call. The event records the crossing but names no host function, so the call site is the best label available. |
| `unsymbolized` | the root of a tree from an event stream that opened no boundary at all — distinguishable from "everything ran unresolved". |

---

## 4. Call Stack Node (`CallStackNode`)

```rust
pub struct CallStackNode {
    pub frame: SourceFrame,
    pub exclusive_cpu: u64,         // cost of this function itself
    pub inclusive_cpu: u64,         // this function + all its children
    pub exclusive_mem: u64,
    pub inclusive_mem: u64,
    pub exclusive_hostcalls: u64,
    pub inclusive_hostcalls: u64,
    pub children: HashMap<String, CallStackNode>,
}
```

Six cost columns, not four: host-call counts are tracked alongside CPU and memory, which is what makes `--metric hostcalls` a real axis rather than a relabelling. `children` is keyed by function name.

The three metrics are selected by a fourth model, `Metric { Cpu, Memory, Hostcalls }`, and the folded writer reads exactly one column per node:

```rust
let cost = match metric {
    Metric::Cpu => node.exclusive_cpu,
    Metric::Memory => node.exclusive_mem,
    Metric::Hostcalls => node.exclusive_hostcalls,
};
```

---

## 5. Output Format (`Format`) and the artifacts it writes

```rust
pub enum Format { Folded, Json, Raw }
```

`Folded` is the default. It is the format every other document in the project describes, because speedscope.app and `flamegraph.pl` read it and `compare` re-reads it.

### Folded (default)

One line per stack path, exclusive cost for the selected metric:

```text
wasm[0] 0
```

and, for an export that calls the host (the measured `memory_heavy_loop` at 100 iterations):

```text
wasm[0];host[0] 125022
```

A `.folded` file records **no metric**. Two of them handed to `compare` can disagree on `--metric` and nothing detects it — the reason the JSON format exists.

### JSON

The real document from `fixtures/dwarf_probe/dwarf_probe.wasm --fn caller_of_heavy --format json`:

```json
{
  "metric": "cpu",
  "root": {
    "children": [],
    "exclusive": {
      "cpu": 0,
      "hostcalls": 0,
      "memory": 0
    },
    "file": null,
    "function": "wasm[0]",
    "inclusive": {
      "cpu": 0,
      "hostcalls": 0,
      "memory": 0
    },
    "line": null
  }
}
```

Note the shape, since it is not a serialisation of the Rust struct: `metric` names what the numbers are denominated in, `file` and `line` are flat per node (and `null` here because this fixture's frames arrive with no program counter), each node carries all three cost columns as `exclusive`/`inclusive` objects rather than the one number folded selects, and `children` is an **array sorted by function name** rather than a `HashMap`'s iteration order. Sorted deliberately: two profiles of one contract would otherwise write byte-different JSON, which defeats a format meant for a CI job to diff.

### Raw

Stage 1's output before symbolization and before the tree is built — `kind pc=<n> cpu=<n> mem=<n>` per event. The measured pair for the same call:

```text
call pc=0 cpu=0 mem=0
return pc=0 cpu=0 mem=0
```

Those two lines are the whole of what the engine reports, which is why the profile is one frame of zeros. It takes no `--metric` (each event carries its own cpu and mem deltas, unselected) and prints no ranking (nothing was aggregated). Events and boundaries are not the same count: `record_call`/`record_return` are emitted unconditionally while steps pass the `--sample-rate` throttle, so this fixture writes two lines at the default rate and **four** at `--sample-rate 1` across the same two boundaries.

---

## 6. Comparison models (`src/formatter.rs`)

Used by `compare`, which reads two artifacts and runs no contract:

```rust
pub struct FunctionDelta {
    pub name: String,
    pub baseline: u64, // 0 when the function is new since then
    pub current: u64,  // 0 when it no longer appears
}

pub enum DeltaScale { Regression, Improvement, Neutral }
```

* Per **function** rather than per stack, because the question is "did my change make this cheaper", which a stack-level diff only answers if the reader sums lines themselves.
* Both raw counts travel with the entry rather than just the difference: `+51489` alone cannot say whether that is noise on a 1.5-million-instruction loop or the whole of a small function.
* `delta()` is `current - baseline` widened to `i128`, because the difference of two `u64` costs is not representable as an `i64` and saturating would hide a change that large rather than report it.
* `DeltaScale` is where the red/blue decision lives and gets tested. Rendering is external: `flamegraph.pl --diff` applies the hue (regressions red, improvements blue). The tool ships no renderer — `AGENTS.md` forbids adding `inferno` or any SVG library.
