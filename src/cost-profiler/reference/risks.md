# Known Risks & Failure Modes

> Analysis of technical edge cases, compiler optimization artifacts, and failure modes.

Every item below is a measured property of the current engine or build pipeline, not a hypothetical. Each names what would lift it. Read this before you read a number out of a `.folded` file.

::: warning The root cause is one missing hook
`wasmi` 2.0 exposes a call hook and no instruction hook. Most of what follows — the counts, the frame names, the depth of the tree, the ceiling that does not bound a loop — traces back to that single gap rather than to a choice in this repository.
:::

---

## 1. Stale DWARF after an optimizer pass

### The problem
To obtain representative measurements a contract is built with release optimizations. The easy failure is a binary with no line tables at all: an error fires and you are told. The hard failure is a binary whose DWARF **loads and is wrong**.

### Measured
On the committed `fixtures/dwarf_probe/dwarf_probe.wasm`:

| Applied to the artifact | `.debug_*` | `name` section | Addresses that resolve |
| :--- | :--- | :--- | :--- |
| nothing (as built) | 1,002 B | present | 160 of 166 probed |
| `wasm-opt -O0` | 855 B, **stale** | **gone** | **0 of 152** |
| `wasm-opt -Oz` | 855 B, **stale** | **gone** | **0 of 145** |
| `wasm-opt -Oz -g` | 1,098 B | present | 140 of 145 |
| `wasm-opt --strip-dwarf` | none | gone | not applicable |

`SourceMapper::new` finds `.debug_info` after `wasm-opt`, `gimli` parses it, `has_debug_info()` returns `true`, and **every lookup returns nothing** — the line table describes the pre-optimization code section the optimizer rewrote. No error fires, because there is nothing structurally wrong to fire on.

### Mitigation and what it costs you
The defence is the coverage ratio check: every tenth address of the code section is sampled, and if more than 90% map to no line or to a line another address already claimed, the run warns that the DWARF describes different code from the bytes that ran. It is the only signal for this case, so **a run that warns about coverage is not broken — it is telling you the artifact is.**

Practically: build the profiling profile yourself (`cargo build --profile profiling`), and if you must run Binaryen pass `-g`. `stellar contract optimize` passes no `-g` today, so its output is unmappable by either source.

On inlining specifically, Stage 2 does read DWARF's inline stack (`DW_TAG_inlined_subroutine`) and returns it innermost-frame-first — `wrapping_add` inlined into `caller_of_heavy` resolves to two frames in two different files. That machinery is tested and correct; today the trace never hands it an address other than `0`, so nothing reaches the tree.

---

## 2. The tracing buffer, and the ceiling that cannot see an infinite loop

### The problem
A complex Soroban contract can execute tens of millions of instructions. Buffering one `TraceEvent` per instruction would grow the trace with the run, so the tracer keeps the buffer bounded instead:

* `record_call` / `record_return` are emitted **unconditionally** — boundaries are the spine of the tree, and sampling them would lose frames.
* `record_step` accumulates cost between calls and emits only once the accumulated amount crosses `--sample-rate` (default 1,000), so the buffer holds roughly `total_cost / sample_rate` step events rather than one per instruction.
* `--instruction-limit` (default 100,000,000) bounds it further; past the ceiling `record_step` returns `Err`, the caller treats it as a halt signal, and the trace up to that point is still readable.
* The aggregator allocates per **call**, not per instruction: open frames live on a stack and a step only touches the innermost one.

### The sharp edge
The flag does not change what the counter counts. Its only caller in the live path is the call hook, which runs once per boundary, so **the counter advances per boundary, not per instruction**. A contract that loops forever *inside* one function body emits no boundaries, never advances the counter, and is not stopped; `wasmi`'s own fuel is set to `u64::MAX` for the run, so the engine does not stop it either.

The guard is real for the buffer it was written to protect and inert against a compute-only runaway loop. A ceiling that also halts execution needs an instruction hook, and `wasmi` 2.0 does not have one to expose — no open issue in this repository owns that gap; it is upstream.

Until then: **profile exports that terminate**, and prefer the fixture-sized contracts the repository tests against. The flag does have a measurable effect on contracts making many host calls now that those calls link — `memory_heavy_loop` crosses 102 host calls at 100 iterations, and the pair `--instruction-limit 1` / `--instruction-limit 2` is exactly the difference between a halted run and a finished one.

---

## 3. Only the outer invocation is traced

`Store::call_hook` fires for the host-initiated call *into* wasm, not for calls made from inside running wasm. A contract whose entry point calls five helpers yields one `Call`/`Return` pair, not six, so **the call tree is one level deep no matter how deep the contract goes**. The probe `only_the_outer_invocation_is_recorded_as_a_boundary` in `tests/meter_probe.rs` pins it.

Consequences for reading a flamegraph: a wide `wasm[0]` is the whole run, and the children you would expect to see under it are simply not in the input. Cross-contract calls are the same gap in a different place — production hands its dispatch a live engine caller so a contract can re-enter wasm, and the `Env` methods bound here run with none, so those functions return a host error instead of recursing.

---

## 4. Every frame lands at `wasm[0]`

The call hook is handed the hook *variant* and nothing else — no callee, no offset — so all events are recorded at `pc = 0`. An internal instruction pointer would not fix it either: `wasmi` re-encodes wasm bytecode into its own instruction stream during translation and keeps no table back to the original offsets, so the finest address any future hook could hand this profiler is a function body's start.

This is why source mapping exists as a separate, complete stage rather than a nice-to-have: `CodeMap` indexes exactly that body-start space, and `tests/source_map_fixture.rs` checks resolved addresses against the *text* of the source they came from. When an address reaches a frame, the `file:line` half is already built and correct.

---

## 5. Upstream Soroban runtime drift

`soroban-cost-profiler` instruments execution hooks inside the WASM VM and interfaces with `soroban-env-host`. If Stellar upgrades the runtime — migrating away from `wasmi`, refactoring internal cost-tracking types, or changing host function ABI signatures — the tracing hooks need updates.

* The profiler relies on public API only: budget reads go through `AsBudget` (`get_cpu_insns_consumed()`, `get_mem_bytes_consumed()`), and the host bindings are generated from `soroban_env_host::call_macro_with_all_host_functions`, the same x-macro table the production host builds its linker from. Unexported internals like `invocation_metering` are not touched, and `testutils` is not enabled — that feature is what pulls `arbitrary` into the tree, which `AGENTS.md` forbids.
* Version parity is visible in one error message. `--state` refuses a snapshot whose declared protocol is not the host's: *"ledger24.json declares protocol 24 and this profiler's host implements 28. Cost tables differ between protocols, so a snapshot from another protocol is refused rather than silently re-stamped."* Re-stamping would price the contract with another protocol's cost tables and report them as the ledger it was given.

::: warning The three tiers do not read the same cost tables
Tier 3's profiler builds against `soroban-env-host` 28.0.2. Tier 2 (budget-assert) targets `soroban-sdk` 27.0.3 / `stellar-xdr` 27.0.0, i.e. Protocol 27. A profile and a budget assertion on one contract are therefore priced against different tables, which is a reason to treat profile numbers as a *shape* rather than a forecast of what the network will charge.
:::

---

## 6. Stripped and partially stripped binaries

A contract compiled without debug tables has no `.debug_line`. Detected on startup, warned about, and then handled in two falling-back stages: DWARF → the WASM `name` section → `wasm[<pc>]` placeholders.

* The warning recommends `[profile.profiling]` with `inherits = "release"` and `debug = "line-tables-only"`, and to keep `debug` out of `[profile.release]` — that is the profile whose output gets deployed, and mainnet bills for the extra bytes.
* `--strip-debug` / `--strip-dwarf` drop DWARF **and** the `name` fallback together, so "just strip it" recipes lose both at once.
* The paths in the line tables are the absolute ones from whatever machine ran `rustc`, which is why file matching in this repository's tests is by suffix.

---

## 7. What the mocked ledger cannot supply

`--state <snapshot.json>` provides the ledger itself: its `LedgerInfo` goes into the host, which answers the five context-free reads of it, and the snapshot's entries are installed as the storage the host reads through. What no state file can supply is the **contract frame** a host call normally runs inside, because the profiler invokes an export from outside a contract call.

A read whose ledger key is built from the current contract ID — `get_contract_data` and its siblings, `require_auth` — stops on that empty stack and never reaches the file. Both refusals read identically from a terminal:

```text
error: 'read_sequence' trapped: host function 'x.3' failed: HostError: Error(Context, InternalError)
DebugInfo not available
```

`DebugInfo not available` is the host's own sentence, not a defect here — the detail it would print after it is built only with `soroban-env-host`'s `testutils` feature.

---

## 8. `--args` gives words, and the guest reads tags

`--args` is checked **before** the call against the module's own signature, so an arity mismatch is an input error that writes no artifact. But the values are `i64` words, and on an SDK build the guest reads a tagged `Val`. `compute_heavy_loop(iterations: u32)` wants `U32Val(10000)` — `(10000 << 32) | 4` = `42949672960004` — not `10000`. The arity check cannot see the difference: the signature says `i64` either way, so the wrong value **traps mid-run** and leaves a partial trace whose costs are incomplete because the call never returned.

---

## 9. Not a limitation

Worth stating so the list above is not over-read:

* No macros, no test hooks, no recompiled-with-instrumentation source. A standard `cargo build --profile profiling` artifact is enough — that is the point of the zero-instrumentation rule.
* Output is plain text that speedscope.app opens and `flamegraph.pl` pictures. No SVG renderer is bundled and none is promised.
* Exit codes are the documented `0`/`1`/`2`; a trap writes the partial trace it earned; `compare` reports a regression as an answer rather than a failure.
* One export per run is by design: a trace of a whole transaction is a different artifact from a profile of a function.
