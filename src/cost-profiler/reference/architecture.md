# Profiler Architecture

> System design, component pipelines, and execution flow.

---

## Technical Stack

* **Language:** Rust
* **WASM Host & Environment:** `soroban-env-host` 28.0.2 (the native Soroban runtime, with its `recording_mode` feature) and `soroban-ledger-snapshot` 28.0.0
* **WASM Interpreter:** `wasmi` 2.0.0 (the execution engine `soroban-env-host` uses in its test harness)
* **DWARF Parsing & Source Mapping:** `addr2line` 0.25.1 and `gimli` 0.32.3, both with `default-features = false` (reading `.debug_line` and `.debug_info` out of the WASM custom sections)
* **CLI:** `clap` 4.5.0 with `derive`
* **JSON artifact:** `serde_json`, used through `Value`/`Map` rather than a derived `Serialize`
* **Logging:** `tracing` for the records, `tracing-subscriber` (`fmt` only, no `ansi`, no `env-filter`) for the reader installed by `--verbose`
* **Renderer:** none. The tool writes text artifacts and no SVG; `flamegraph.pl` and speedscope.app are external programs.

---

## The Four-Stage Pipeline

`soroban-cost-profiler` executes as a four-stage sequential pipeline:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. EXECUTION TRACER (src/tracer.rs, with src/host.rs + src/state.rs)   │
│    • Instantiates the module under wasmi against the real Soroban host │
│    • Emits TraceEvent stream (Call, Return, Step, HostCall, HostReturn)│
│    • Snapshots the host budget at host function boundaries             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. SOURCE MAPPER (src/source_map.rs + dwarf.rs / names.rs / wasm.rs)   │
│    • Walks the binary's custom sections for DWARF, name, and code maps │
│    • Translates a code-section address into a SourceFrame              │
│    • Falls back to the WASM name section, then to an unmapped mapper   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. PROFILE AGGREGATOR (src/aggregator.rs)                              │
│    • Consumes TraceEvents and manages the open-frame stack             │
│    • Aggregates exclusive and inclusive CPU, memory, host-call cost    │
│    • Constructs the hierarchical CallStackNode tree                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. OUTPUT FORMATTER (src/formatter.rs)                                 │
│    • Traverses CallStackNode into collapsed-stack ("folded") text      │
│    • Writes the same tree as JSON, or the pre-aggregation event stream │
│    • Produces the top-N summary and the compare report                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Supporting Modules

Two modules exist so that a real contract can be run at all, and neither is a stage in the pipeline:

* **`src/host.rs`** binds the Soroban host functions to the engine. A compiled contract imports `vec_new`, `vec_push_back`, `obj_from_u64` and the rest the way a program imports `malloc`, so a module linked against an empty `Linker` fails instantiation on its first import. The bindings are not written by hand: `soroban_env_host::call_macro_with_all_host_functions` hands over the whole host interface as an x-macro — each function's WASM import name, its typed argument list, and the `Host` method that implements it — and this module turns every entry into one `wasmi::Linker::func_new` registration that converts at the boundary with `HostArg::from_word` / `HostRet::write`. It is the same table the production host builds its linker from, so the profiler traces the real implementation rather than a model of it.
* **`src/state.rs`** builds the `Host` around ledger state for `--state`. Without it every run gets a `Host::default()`, whose ledger has no `LedgerInfo` and whose storage is an empty enforcing `Storage`, so a contract that reads either traps before doing any work. The file format is the standard one: a Soroban ledger snapshot, exactly as `soroban-cli` and `Env::to_ledger_snapshot_file` write it, parsed by `LedgerSnapshot`. The module invents no state format of its own.

---

## Component Details

### 1. Execution Tracer (`src/tracer.rs`)
`ExecutionTracer` owns no engine state — it is fed by `invoke_function` and `instantiate_module` — so it can be inspected and drained independently of the run being profiled. It collects:

* **Function boundaries:** `record_call` / `record_return`, emitted unconditionally because boundaries are the spine of the tree the aggregator rebuilds; sampling them would lose frames.
* **Host boundaries:** `record_host_call` snapshots the cumulative host budget on entry and carries zero cost itself; `record_host_return` charges the frame the delta from that snapshot. Without the entry snapshot, every host call since the start of the run would be attributed to whichever function returns last. Budget reads are `unwrap_or(0)`: a host that cannot report its budget degrades into an uncosted trace instead of aborting the run.
* **Instruction steps:** `record_step` accumulates cost between calls and emits a `Step` event only once the accumulated amount crosses `sample_rate`, so the buffer holds `total_cost / sample_rate` events rather than one per instruction. Saturation, not wrapping, is deliberate — a contract that racks up absurd counters should show a huge sampled cost rather than roll over to a small one.

`with_instruction_ceiling` bounds the trace against a runaway contract; past the ceiling `record_step` returns `Err`, which the caller treats as a halt signal, and the trace up to that point is still readable via `flush_trace`.

**Two properties of the current engine drive everything downstream, and the docs state them rather than smoothing them over:**

* `wasmi` 2.0 gives its call hook no instruction pointer, so **every event the tracer records carries `pc = 0`**. That is a real address belonging to no instruction, and it is why a default run's frames read `wasm[0]`.
* WASM-side cost is currently **one synthetic unit per boundary**, not a metered instruction count. Host cost is the accurate half of a trace because it is measured from the budget. This is why a profile's counts are counts of boundaries and host budget, and why a whole run can collapse into a single frame.

### 2. Source Mapper (`src/source_map.rs`, `source_map/dwarf.rs`, `source_map/names.rs`, `source_map/wasm.rs`)
Stage 2 is the only place a program counter is translated into a name. `SourceMapper` holds one of three things:

* an `addr2line::Context` built from the DWARF custom sections of the binary that was loaded,
* the same binary's `name` section when it has no DWARF at all, or
* nothing (`SourceMapper::unmapped`) for a caller that chose to continue without symbols.

Construction is fallible and reports *why* there are no symbols, because "the binary has no debug info" and "the address is outside every range" need different fixes and only the first is the user's to make.

When a DWARF address does resolve it yields a `SourceFrame`: the demangled function name (rustc's anonymous closure segments rewritten to `[closure]` / `[closure#N]`, since `CallStackNode::children` pools frames by name), the source file path, and the 1-based line number.

The facts that decided how much code this stage is:

* **DWARF arrives as separate WASM custom sections, so loading is a section walk.** A `wasm32-unknown-unknown` build with debug info carries `.debug_abbrev`, `.debug_info`, `.debug_str`, `.debug_line`, `.debug_ranges` (and `.debug_loc` where applicable) as individual sections alongside `name`, `producers`, `target_features` and Soroban's `contractspecv0`. They are not merged into one `DWARF` section.
* **The only hand-written parsing here is the WASM container** — the section table, the code section's function framing `CodeMap` needs, and the two short subsection walks the name fallback reads — never DWARF itself. `gimli::Dwarf::load` reads the sections and `addr2line::Context::from_dwarf` builds the index, which is what `AGENTS.md`'s "no custom DWARF parsing" rule requires.
* **`CodeMap` translates address spaces.** A `pc` is an offset into the code section's payload, where address `0` is the function-count byte — not a file offset and not a linear-memory address.

### 3. Profile Aggregator (`src/aggregator.rs`)
The aggregator folds the flat event stream into the tree. Inclusive costs bubble to parents; exclusive costs stay pinned to the frame that ran. The fold is deliberately not a map keyed by call path: a run can emit a million sampled `Step` events and a path key per event would allocate for every one of them, so open frames live on a stack and a step only touches the innermost one — accounting allocates per *call*, not per instruction. `ProfileAggregator` holds no persistent state, so one aggregator reused across runs cannot leak cost from the previous trace.

Frames the mapper cannot resolve get an honest placeholder rather than an invented name:

| Frame | When |
| :--- | :--- |
| `wasm[<pc>]` | a WASM boundary Stage 2 did not resolve. Today every event is `pc = 0`, so a whole run collapses into `wasm[0]`. |
| `host[<pc>]` | a Soroban host call. The event says execution crossed into the host but names no host function, so the call site is the best label available. Host frames stay distinct from the WASM frame at the same `pc` because host cost is budget-measured and WASM cost is synthetic. |
| `unsymbolized` | the root of a tree from an event stream that opened no boundary at all — "there was nothing to aggregate", which is a different finding from "everything ran unresolved". |

If a trap or panic occurs, the active stack is flushed immediately.

### 4. Output Formatter (`src/formatter.rs`)
`OutputFormatter` is a set of associated functions over the tree, not a stateful writer:

| Function | Output |
| :--- | :--- |
| `to_collapsed_stack` | `frame_a;frame_b;frame_c <count>` — the folded format speedscope.app and `flamegraph.pl` read, and the format `compare` re-reads. |
| `to_json_tree` | the same tree as structured data, carrying two things folded text has nowhere to put: the metric and each frame's source file are fields, so a JSON artifact cannot be silently diffed against a run that disagreed on `--metric`. |
| `to_raw_events` | one line per recorded event before aggregation — no source names, no tree. The only format that shows what the engine itself reported. |
| `top_functions` / `to_top_summary` | the ranked exclusive-cost list printed on stderr. |
| `parse_folded` / `to_differential_folded` / `function_deltas` / `to_compare_report` | `compare`: baseline vs current, per function, with both raw counts so `+51489` can be read against the size of the function it changed. |

`DeltaScale` (Regression / Improvement / Neutral) is where the red/blue decision lives and gets tested. Rendering is not the tool's job: SVG output would mean `inferno` or another SVG library, which `AGENTS.md` forbids, so the external viewer applies the hue.
