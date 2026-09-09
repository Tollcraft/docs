# The Debug Precondition

> Preserving DWARF debug tables for profiling without compromising production contract size or fees.

---

## Why Debug Symbols are Required

To map a WebAssembly (WASM) instruction pointer (Program Counter, or PC) back to a human-readable Rust file, function name, and line number, the profiler requires **DWARF debug information** (`.debug_line` and `.debug_info` sections).

Standard Soroban smart contract development emphasizes minimal WASM binary sizes. The canonical release profile strips all debug info and symbol names to reduce on-chain deployment costs and contract footprint. Without DWARF data, the profiler can only report raw function indices (e.g., `func_42+0x1a`), making visual flamegraphs difficult to interpret.

---

## The Solution: A Dedicated `[profile.profiling]`

To avoid accidentally deploying debug-heavy binaries to mainnet, maintain two distinct profiles in your workspace `Cargo.toml`:

```toml
# 1. Mainnet Deployment Profile (Stripped & Minimal)
[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true

# 2. Local Diagnostic Profile (Includes Line Tables Only)
[profile.profiling]
inherits = "release"
debug = "line-tables-only"
```

### Why `debug = "line-tables-only"`?

Setting `debug = true` (or `debug = 2`) adds full debug tables, including variable locations and type metadata. This can swell a 40 KB contract to over 1.5 MB during compilation. 

By specifying `debug = "line-tables-only"`, rustc emits only the minimal mapping from bytecode addresses to source code line numbers (`.debug_line`). This provides full resolution for the profiler while keeping build times fast.

---

## Critical Safety Notice

::: danger
**Never deploy with debug tables enabled!**

Soroban charges an on-chain fee for every byte of WASM stored on the ledger. A contract deployed with debug symbols can cost **10x to 30x more XLM** to upload, and can exceed the network transaction size limit (typically 128 KB) entirely. Always use `cargo build --release` for mainnet deployments.
:::

---

## Two Compiler Caveats

### 1. Downstream Stripping Tools
If your build pipeline uses tools like `stellar contract build` or runs an external `wasm-opt` pass, the tool may automatically strip all custom and debug sections by default, regardless of what is set in `Cargo.toml`. 

To profile effectively:
* Build directly with `cargo build --target wasm32-unknown-unknown --profile profiling`.
* If using `wasm-opt`, ensure `--debuginfo` or `-g` is passed to prevent stripping line tables.

### 2. Inlining and Link-Time Optimization (LTO)
To obtain accurate runtime execution costs, your profiling build must inherit `release` optimizations (`opt-level = "z"`, `lto = true`). However, aggressive compiler optimizations frequently inline small functions and unroll loops.

When the compiler inlines a function:
* Multiple source lines may collapse into a single sequence of WASM instructions.
* The flamegraph may show costs attributed to the caller rather than the callee, or show coarse line ranges.
* The profiler will faithfully attribute the cost to the line where instructions were actually emitted by LLVM.

---

## Fallback Behavior: Stripped Binaries

If `soroban-cost-profiler` is executed against a stripped WASM binary without DWARF tables:

1. It checks for an embedded WASM `name` section. If present, it resolves function names without line numbers.
2. If the `name` section is also stripped, it falls back to raw WASM exported function names and index identifiers (e.g., `wasm_export::swap -> wasm_func[12]`).
3. It emits a warning in the console indicating that source line mapping is disabled.

