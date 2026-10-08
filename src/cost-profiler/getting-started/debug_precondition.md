# The Debug Precondition

> Preserving DWARF debug tables for profiling without compromising production contract size or fees.

---

## Why debug tables are needed at all

Stage 2 of the pipeline maps an address to a Rust file, function name, and line number. To do that it needs **DWARF debug information** — `.debug_info`, `.debug_line`, `.debug_abbrev`, `.debug_str`, `.debug_ranges` — which a `wasm32-unknown-unknown` build with debug info carries as *separate WASM custom sections*, not as one merged `DWARF` section.

Standard Soroban development emphasizes minimal binaries. The canonical release profile strips debug info and symbol names to reduce on-chain deployment cost. Without DWARF the profiler still runs and still writes an artifact; it just cannot name a source line.

::: warning What the tables buy you today, stated exactly
Line tables are **not** what makes today's picture rich. Every frame still arrives named `wasm[0]`, whatever you build, because `wasmi` 2.0's call hook reports no program counter to look a line up with. What a profiling build gets you is:

* the warnings, which tell you out loud which half of your artifact is missing,
* the `name`-section fallback, which names functions even with no line tables, and
* a source-mapping stage that is already built and tested underneath — `CodeMap` indexes the code-section body-start space and `tests/source_map_fixture.rs` checks resolved addresses against the *text* of the source they came from — so the frame names land the moment PC attribution does, rather than a second build being required then.
:::

---

## The solution: a dedicated `[profile.profiling]`

Keep `debug` out of `[profile.release]` — that is the profile whose output gets deployed. In your contract's `Cargo.toml`:

```toml
[profile.profiling]
inherits = "release"
debug = "line-tables-only"   # enough for source mapping, far cheaper than full -g
```

```bash
cargo build --target wasm32-unknown-unknown --profile profiling
```

### What it costs, measured

On the tutorial's three-function contract — the same source, two profiles, one artifact each:

| Build | Size | Sections the profiler reads |
| :--- | :--- | :--- |
| `--profile profiling` (`debug = "line-tables-only"`) | 1,482 B | `.debug_info`, `.debug_line`, `.debug_abbrev`, `.debug_ranges`, `.debug_str`, `name` |
| `--profile release` | 714 B | none |

The **768-byte difference is the debug info**. `inherits = "release"` means the optimized code is identical byte-for-byte; the extra bytes are the mapping tables laid beside it.

::: info On the "10× to 100×" figure
Older Tollcraft documentation quoted an order-of-magnitude multiple for debug tables. Nothing in this repository measures that, and the one measured pair above is about 2× on a 1.5 KB module — a ratio on a toy contract generalises to nothing. What is safe to say is the shape of the risk: debug tables are a large multiple of a small contract's own code size, mainnet charges per byte stored on the ledger, and a profile you deploy is a fee you pay forever.
:::

---

## Critical safety notice

::: danger
Do **not** add `debug` to your main `[profile.release]`. A contract deployed with debug tables pays mainnet fees for the binary bloat, and a bloated artifact can push a transaction over the network's size limits. `[profile.profiling]` exists so the build you profile is not the build you deploy. Build deployments with `cargo build --release` (or your normal release recipe) and profiling reads with `--profile profiling`.
:::

---

## Three pipeline caveats

### 1. Downstream stripping
If your pipeline runs `stellar contract build` or an external `wasm-opt` pass, it may strip custom and debug sections regardless of what `Cargo.toml` says. `stellar contract optimize` passes no `-g` today.

If you must run Binaryen, pass `-g`.

### 2. Stale DWARF is worse than no DWARF
The easy failure is no line tables: an error fires and you are told. The hard failure is a binary whose DWARF loads and describes different code from the bytes that ran. Measured on `fixtures/dwarf_probe/dwarf_probe.wasm`:

| Applied to the artifact | `.debug_*` | `name` section | Addresses that resolve |
| :--- | :--- | :--- | :--- |
| nothing (as built) | 1,002 B | present | 160 of 166 probed |
| `wasm-opt -O0` | 855 B, **stale** | **gone** | **0 of 152** |
| `wasm-opt -Oz` | 855 B, **stale** | **gone** | **0 of 145** |
| `wasm-opt -Oz -g` | 1,098 B | present | 140 of 145 |
| `wasm-opt --strip-dwarf` | none | gone | not applicable |

`SourceMapper::new` finds `.debug_info`, `gimli` parses it, `has_debug_info()` returns `true`, and every lookup returns nothing. Nothing structurally wrong fires. The signal is the coverage warning:

```text
warning: 100% of the sampled addresses in this binary map to no line or to one another address already
```

**A run that warns about coverage is not broken — it is telling you the artifact is.**

### 3. Inlining and LTO
A profiling build inherits release optimizations (`opt-level`, `lto`), so the compiler inlines aggressively and unrolls loops. Multiple source lines can collapse into one instruction sequence.

Stage 2 handles this rather than suffering it: `resolve` asks DWARF for the **inline stack** at an address and returns it innermost-frame-first. On the fixture, address `14` is `u64::wrapping_add` inlined into `caller_of_heavy`, and it yields two frames naming two different files. That machinery is tested — and today's trace never asks for anything but address `0`, so nothing reaches the tree.

---

## Fallback behaviour on a stripped binary

Three measured transcripts, so you can tell which case you are in:

**No DWARF at all** — it still profiles, and still exits `0`. A binary with no line tables is not a failed run; it is a run whose frames cannot be named:

```text
warning: this artifact has a `name` section but no DWARF line tables, so frames will name functions and
never `file:line`. Build the copy you profile with a profiling profile — `[profile.profiling]` with
`inherits = "release"` and `debug = "line-tables-only"` — and keep `debug` out of `[profile.release]`: that
is the profile whose output gets deployed, and mainnet bills for the extra bytes.
```

**No DWARF and no usable `name` section** — the harder case, produced by the recipe the caveat above warns about:

```console
$ wasm-opt --strip-debug fixtures/dwarf_probe/dwarf_probe.wasm -o stripped.wasm
$ soroban-cost-profiler --wasm stripped.wasm --fn caller_of_heavy
warning: no `.debug_info` section, so program counters cannot be mapped to Rust source lines. Build the
copy you profile with a profiling profile — `[profile.profiling]` with `inherits = "release"` and
`debug = "line-tables-only"` is enough for `file:line` frames — and profile that artifact rather than the
stripped one (`wasm-opt`, and `stellar contract build`, strip debug info). Keep `debug` out of
`[profile.release]`: that is the profile whose output gets deployed, and mainnet bills for the extra bytes.
The module carries no custom sections at all. Every frame will therefore be named by address, `wasm[pc]`,
and not by source.
```

**Neither** — frames are labelled by the placeholder for the address the event carried, not by an invented name:

| Frame label | Meaning |
| :--- | :--- |
| `wasm[<pc>]` | a WASM boundary Stage 2 did not resolve. Today: every frame, `wasm[0]`. |
| `host[<pc>]` | a host transition; the event names no host function. |
| `unsymbolized` | an event stream that opened no boundary at all. |

Note that `--strip-debug` / `--strip-dwarf` drop DWARF **and** the `name` fallback together, so "just strip it" recipes lose both at once. And the file paths the tables carry are the absolute ones from whatever machine ran `rustc`, which is why this repository's tests match file names by suffix.
