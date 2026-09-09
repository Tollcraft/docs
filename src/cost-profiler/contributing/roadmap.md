# Development Roadmap

> Milestones, implementation progress, and future development phases for `soroban-cost-profiler`.

---

## Progress Overview

| Phase | Focus Area | Status | Key Deliverables |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Core Scaffolding & Setup | **Completed** ✅ | Repository setup, PRD, architecture specification, pipeline module scaffolding, core data models. |
| **Phase 2** | Execution Tracing | **In Progress** 🚧 | `wasmi` interpreter hooks, instruction counting, call/return boundary tracking, host boundary diffing. |
| **Phase 3** | DWARF Source Mapping | Planned 📋 | DWARF `.debug_info` and `.debug_line` parsing via `addr2line`/`gimli`, symbol demangling, address translation. |
| **Phase 4** | Aggregation & Formatting | Planned 📋 | `ProfileAggregator` tree generation, inclusive/exclusive math, collapsed stack formatter, SVG rendering. |
| **Phase 5** | CLI & Production Polish | Planned 📋 | Full CLI argument handling (`clap`), panic recovery, runaway loop ceilings, CI artifact generation. |

---

## Phase 1: Core Scaffolding & Setup ✅
- [x] Create repository, README, and AGENTS.md instructions.
- [x] Draft PRD and Architecture documents.
- [x] Scaffold initial Rust pipeline modules (`tracer`, `aggregator`, `source_map`, `formatter`).
- [x] Define core data models (`TraceEvent`, `CallStackNode`, `SourceFrame`).
- [x] Tollcraft Org Landing Page setup.

---

## Phase 2: Execution Tracing 🚧
- [x] **SPIKE 01:** Investigate `soroban-env-host` Budget API limitations.
- [ ] **WASM Engine Setup:** Integrate `soroban-env-host` and `wasmi` dependencies.
- [x] **Fixture Contract:** Add `fixtures/dummy-contract` with compute-heavy test functions.
- [ ] **Tracer Hooks:** Implement execution interception in `src/tracer.rs`.
- [ ] **Instruction Metering:** Measure CPU instructions and PC offsets per step.
- [ ] **Boundary Snapshots:** Capture host tracker deltas during host function calls.

---

## Phase 3: DWARF Source Mapping 📋
- [ ] **Dependency Setup:** Add `addr2line` and `gimli`.
- [ ] **DWARF Parsing:** Extract `.debug_line` and `.debug_info` from WASM binaries.
- [ ] **Address Resolution:** Implement `resolve(pc)` mapping WASM offsets to `file:line` frames.
- [ ] **Multi-Contract Context:** Support dynamic symbol table switching across contract IDs.

---

## Phase 4: Aggregation & Formatting 📋
- [ ] **Call Tree Construction:** Implement `ProfileAggregator` to manage hierarchical call stacks.
- [ ] **Cost Aggregation:** Calculate exclusive and inclusive CPU and memory costs.
- [ ] **Collapsed Stack Output:** Format tree into `.folded` Speedscope strings.
- [ ] **SVG Rendering:** Integrate `inferno` for standalone interactive SVG output.

---

## Phase 5: CLI & Production Hardening 📋
- [ ] **CLI Parsing:** Implement full `clap` argument interface in `src/main.rs`.
- [ ] **Panic Recovery:** Ensure traces are flushed upon contract panic or trap.
- [ ] **Infinite Loop Guard:** Enforce the 100M instruction ceiling.
- [ ] **CI Integration:** Provide GitHub Action integration for generating diagnostic profiles on failed budget assertions.

