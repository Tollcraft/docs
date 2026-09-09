# Known Risks & Failure Modes

> Analysis of technical edge cases, compiler optimization artifacts, and failure modes.

---

## 1. DWARF Distortion from Compiler Optimizations

### The Problem
To obtain representative gas measurements, contracts must be profiled using release optimizations (`opt-level = "z"`, `lto = true`). However, aggressive optimizations (function inlining, dead-code elimination, loop unrolling) alter the relationship between source code and emitted WASM instructions.

### Symptoms in Profiler Output
* Multiple distinct lines in source code collapsing into a single WASM instruction sequence.
* Inlined helper functions disappearing from the call stack hierarchy, with their costs attributed directly to the calling function.
* Coarse or unexpected line number jumps.

### Mitigation
* The profiler uses DWARF inlined subroutine records (`DW_TAG_inlined_subroutine`) where available to reconstruct virtual call frames.
* When functions are fully flattened, costs are faithfully credited to the line where instructions were physically scheduled by LLVM.

---

## 2. Memory Exhaustion from High-Volume Instruction Tracing

### The Problem
A complex Soroban smart contract can execute tens of millions of instructions. Buffering 100M uncompressed 32-byte `TraceEvent` records in memory would consume over 3.2 GB of RAM (and up to 6.4 GB during vector reallocation), exceeding the memory capacity of typical CI test runners.

### Mitigation
* **Boundary & Sampled Tracing:** The tracer only emits events at function entry/exit boundaries. For raw instruction steps, it increments a lightweight local integer counter and flushes a `Step` event periodically at the configured `--sample-rate` (default: 1,000 instructions).
* **Hard Instruction Ceiling:** Tracing terminates if execution reaches `--max-instructions` (default: 100M instructions) to prevent infinite loops from exhausting system memory.

---

## 3. Upstream Soroban Environment Instability

### The Problem
`soroban-cost-profiler` instruments execution hooks within the WASM virtual machine and interfaces with `soroban-env-host`. 

### Symptoms
If Stellar upgrades the underlying Soroban runtime (such as migrating from `wasmi` to `wasmtime`, refactoring internal cost tracking types, or changing host function ABI signatures), internal tracing hooks may require updates.

### Mitigation
* The profiler relies exclusively on public host APIs (`Budget::get_cost_tracker()`) and avoids unexported internal functions like `invocation_metering`.
* Version parity is maintained and tested against pinned `soroban-env-host` releases in CI.

---

## 4. Stripped WASM Binaries

### The Problem
If a developer profiles a contract compiled without debug tables (e.g., standard `cargo build --release` or binaries processed by stripping tools), DWARF sections (`.debug_line`) will be missing.

### Symptoms
* Source files and line numbers cannot be resolved.
* Flamegraphs show raw WASM function indices (`wasm_func[23]`).

### Mitigation
* The profiler detects missing debug sections immediately upon startup.
* It prints an informative warning recommending the addition of `[profile.profiling] debug = "line-tables-only"`.
* It falls back to resolving names via the WASM `name` section if present.

