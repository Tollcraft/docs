# Development Roadmap

> What has shipped in `soroban-cost-profiler`, what is open, and what the engine ceiling does to the
> remaining plan. This page mirrors [`ROADMAP.md`](https://github.com/Tollcraft/soroban-cost-profiler/blob/main/ROADMAP.md)
> in the repository — that file is the one a contribution must update, and this one is a summary of it.

---

## Progress Overview

| Phase | Focus Area | Status | Boxes |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Core Scaffolding & Setup | **Complete** ✅ | 7 / 7 |
| **Phase 2** | Execution Tracing | **Complete** ✅ | 21 / 21 |
| **Phase 3** | DWARF Source Mapping | **Complete** ✅ | 16 / 16 |
| **Phase 4** | Aggregation & Formatting | **Complete** ✅ | 5 / 5 |
| **Phase 5** | CLI & Edge Cases (MVP completion) | **Complete** ✅ | 26 / 26 |
| **Phase 6** | Code Quality & Refactoring | **Complete** ✅ | 20 / 20 |
| — | Tooling & Agent Setup | **Complete** ✅ | 4 / 4 |
| — | Metering Probes (`tests/meter_probe.rs`) | **Complete** ✅ | 3 / 3 |
| — | Website Polish (landing page audit) | **Complete** ✅ | 7 / 7 |
| — | Documentation Upkeep (post-MVP) | **Complete** ✅ | 2 / 2 |

Counts are checkbox states in `ROADMAP.md` as of 2026-10-08, read from that file on `main`. #220 was the
last unchecked box the original plan held, so **no box is open**: 111 checked across the six phases and the
four side tracks (tooling, metering probes, website polish, documentation upkeep), 0 unchecked. One caveat
about that figure, because the page prints it: the file lists the #163 fallback-documentation entry twice,
so 111 checked lines describe 110 pieces of work. Nothing depends on the number — it is here so a reader who
counts gets the same answer twice.

---

## What each phase delivered

**Phase 1 — Scaffolding.** The repository, `AGENTS.md`, the PRD and architecture documents, the four
pipeline modules as skeletons, and the core data models (`TraceEvent`, `CallStackNode`, `SourceFrame`).

**Phase 2 — Tracing.** `soroban-env-host` and `wasmi` wired together, `ExecutionTracer` with its
call/return/step hooks and host-boundary diffing, the `fixtures/dummy-contract` with `compute_heavy_loop`
and `memory_heavy_loop`, and `fixtures/build.sh`.

**Phase 3 — Source mapping.** DWARF loading and line-table resolution through `gimli` (`CodeMap`), the
wasmi-offset → code-section address translation, the `name`-section fallback for binaries with no DWARF,
closure and inline-frame naming, resolution caching, and the `wasm-opt` behaviour spike that measured when
the tables survive optimisation.

**Phase 4 — Aggregation & formatting.** `ProfileAggregator::aggregate` folding the flat event stream into
the costed tree, exclusive/inclusive arithmetic across CPU, memory and host calls, the collapsed-stack
formatter, and the differential `.folded` form `flamegraph.pl --diff` reads.

**Phase 5 — CLI & edge cases.** `clap` argument handling, `--args`, `--state`, `--metric`, `--format`,
`--sample-rate`, `--instruction-limit`, `--verbose`/`--quiet`; the Soroban host-function bindings (199 of
them) so a real SDK contract runs; standardized exit codes; trap-time trace flushing; the `warning:` on a
binary without line tables; `compare`; the end-to-end CLI tests; and the README's Limitations section.

**Phase 6 — Quality.** The per-file documentation and test bank (#45-#64), the Apache-2.0 `LICENSE`, the
Code of Conduct, the PR template, and the `src/source_map` refactor series (#217-#220), which turned a
single 2,431-line file into `source_map/`: `wasm.rs` (`WasmSections`, the container walk), `names.rs`
(`NameSection`, the fallback), `dwarf.rs` (`CodeMap` and the `gimli` traversal), and `mod.rs` holding
only the facade — construction, the DWARF-then-`name` precedence, the resolution cache, and the
degenerate-line-tables threshold — with the public path unchanged. No `gimli` or `addr2line` type is
named in `mod.rs`, which is what makes the "no custom DWARF parsing" rule checkable one file at a time.

**Documentation upkeep (post-MVP).** A track outside the six phases, opened when the README's Contributors
grid turned out to be a **dated snapshot with no way to refresh it**: the person landing someone's sixteenth
contribution now regenerates the grid with one documented command, in the same PR, instead of hand-adding a
tile. `ROADMAP.md` carries the two entries (#249 added the rule in
[`CONTRIBUTING.md`](https://github.com/Tollcraft/soroban-cost-profiler/blob/main/CONTRIBUTING.md#keeping-the-contributor-grid-current),
#251 corrected the figure it quoted into an invariant, because the merge that carried it invalidated the
number on contact). The command itself lives in that section rather than being copied here — two copies of it
is two things to keep in sync, which is the failure the section exists to prevent.

---

## Open work

**Nothing in the plan.** Every box in `ROADMAP.md` is checked as of 2026-10-08, and issue #220 — the facade
split described above — was the last open issue in the repository. Work now starts from a new issue, not
from this page.

Two things the roadmap deliberately does **not** claim to have solved:

* **Instruction-level tracing is an upstream gap.** See the findings below: `wasmi` 2.0 exposes no
  instruction hook, and no box in this repository owns that.
* **The generated quality bank is not a to-do list.** Several of its targets have nothing to optimize, which
  `ROADMAP.md` records as blocked or not applicable rather than closing them with a cosmetic diff — see
  [Issues triaged rather than implemented](#issues-triaged-rather-than-implemented).

---

## Findings that bound the remaining plan

The probes in `tests/meter_probe.rs` pinned three facts that every later phase had to work around, and
they are the reason the [Known Risks & Failure Modes](../reference/risks.md) page reads the way it does:

* **Internal wasm calls are not traced.** `wasmi` 2.0's `Store::call_hook` fires only for the
  host-initiated call. A `probe()` that calls `work()` twice yields one Call/Return pair, not three, so the
  call tree can only be as deep as the boundaries the engine reports.
  Pinned by `only_the_outer_invocation_is_recorded_as_a_boundary`.
* **The instruction ceiling counts boundaries, not instructions.** Its only caller in the live path is the
  call hook, so a contract looping inside one function body emits no boundaries and is not stopped.
* **A trapped run keeps its trace.** The boundaries crossed before the trap are still there to write, which
  is what Phase 5's panic handling was built on.

The single change that would lift all three is an instruction-level hook in the engine. `wasmi` 2.0 does
not expose one, and no open issue in this repository owns that gap — it is upstream.

---

## Issues triaged rather than implemented

The generated quality bank (#45-#60) asked for a performance pass on several files that have nothing to
optimize. `ROADMAP.md` records those as *blocked* or *not applicable* instead of closing them with a
cosmetic diff:

* `src/models.rs` (#59) and `src/lib.rs` (#51) — derive-only data structures and module declarations; no
  loops, clones or allocations to remove, and the issue forbids changing the public API.
* `fixtures/dummy-contract/src/lib.rs` (#47) — the deliberately expensive loops **are** the fixture.
  Optimizing `compute_heavy_loop` or `memory_heavy_loop` would delete the signal every trace test depends
  on, and #57 pinned their exact arithmetic.
* `tests/integration.rs` (#55) — a test file with nothing for a performance pass to do to it; #45 expanded
  its coverage instead.

---

## Contributing to the roadmap

The document carries a standing rule: **update `ROADMAP.md` with the change it describes, in the same
branch.** Check the box, or add it if the work does not have one yet. See
[Contributing](contributing.md) and the
[repository's `CONTRIBUTING.md`](https://github.com/Tollcraft/soroban-cost-profiler/blob/main/CONTRIBUTING.md).
