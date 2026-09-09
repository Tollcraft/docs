# Profiler Architecture

> System design, component pipelines, and execution flow.

---

## Technical Stack

* **Language:** Rust
* **WASM Host & Environment:** `soroban-env-host` (native Soroban runtime)
* **WASM Interpreter:** `wasmi` (WebAssembly execution engine used in the Soroban test harness)
* **DWARF Parsing & Source Mapping:** `addr2line` and `gimli` (parsing `.debug_line` and `.debug_info`)
* **Flamegraph Rendering:** `inferno` (pure Rust port of FlameGraph)

---

## The Four-Stage Pipeline

`soroban-cost-profiler` executes as a four-stage sequential pipeline:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. EXECUTION TRACER (src/tracer.rs)                                   │
│    • Wraps soroban-env-host and wasmi VM                               │
│    • Emits TraceEvent stream (Call, Return, Step)                      │
│    • Snapshots Budget cost tracker at host function boundaries         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. SOURCE MAPPER (src/source_map.rs)                                   │
│    • Loads uncompressed DWARF sections from WASM                       │
│    • Translates raw PC (Instruction Pointer) into SourceFrame          │
│    • Gracefully falls back to WASM name section if stripped            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. PROFILE AGGREGATOR (src/aggregator.rs)                              │
│    • Consumes TraceEvents and manages active call stack                │
│    • Aggregates exclusive and inclusive CPU & memory costs             │
│    • Constructs the hierarchical CallStackNode tree                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. OUTPUT FORMATTER (src/formatter.rs)                                 │
│    • Traverses CallStackNode tree into collapsed stack strings         │
│    • Drives inferno to render vector SVG flamegraphs                   │
│    • Emits standard Speedscope folded-stack profiles                   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. Execution Tracer (`src/tracer.rs`)
The tracer instruments the `wasmi` interpreter hooks to detect:
* **Function Calls:** Emitted when a WASM `call` or `call_indirect` instruction executes.
* **Function Returns:** Emitted when a function frame exits.
* **Instruction Steps:** Metered instruction counter increments. Rather than buffering 100M individual step events (which would consume over 3.2 GB of RAM), the tracer accumulates instruction deltas locally and emits a `Step` event periodically at the configured sampling rate.

### 2. Source Mapper (`src/source_map.rs`)
The source mapper indexes the `.debug_line` table extracted from the WASM binary. When queried with an instruction address (PC):
* It resolves the source file path (e.g., `src/lib.rs`).
* It resolves the 1-based source code line number (e.g., `42`).
* It demangles the Rust symbol name (e.g., &lt;my_contract::Token as Contract&gt;::transfer`).

### 3. Profile Aggregator (`src/aggregator.rs`)
The aggregator constructs the execution tree. As `TraceEvent` items are processed:
* Inclusive costs bubble up to parent nodes.
* Exclusive costs remain pinned to the frame that executed the instructions.
* If a trap or panic occurs, the active stack is flushed immediately.

### 4. Output Formatter (`src/formatter.rs`)
The formatter traverses the final call tree and converts it into the classic folded format:

```text
frame_a;frame_b;frame_c <count>
```

When SVG output is selected, `inferno::flamegraph` converts this text representation into an interactive SVG with CSS styling and embedded JavaScript for zooming and searching.

