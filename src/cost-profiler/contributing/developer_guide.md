# Developer Guide

> Setting up a local environment for `soroban-cost-profiler`, building it, and running its test suites.
> The tree and commands below are read from the repository at `main`, not from a plan.

---

## Prerequisites

* **Rust 1.85 or newer.** The crate is `edition = "2024"`, which stable Rust 1.85 introduced; an older
  toolchain fails to parse the manifests rather than failing a test.
* **No repository-wide toolchain pin.** There is no `rust-toolchain.toml`, so the installed stable is
  used. CI pins its own version in `.github/workflows/ci.yml`.
* **`wasm32-unknown-unknown`** — only for rebuilding the fixture contracts. The profiler itself is a
  host binary and its test suite runs without that target installed.

```bash
rustup target add wasm32-unknown-unknown   # only needed to rebuild fixtures
```

* **Git**, and nothing else. The dependencies are `soroban-env-host` 28.0.2, `wasmi` 2.0.0 and `tracing`
  0.1.44, plus `criterion` as a dev-dependency.

::: warning The `vendor/` directory is load-bearing
`Cargo.toml` carries a `[patch.crates-io]` entry pointing `ed25519-dalek` at `vendor/ed25519-dalek-2.1.1`.
The resolver otherwise picks 3.0.x for `soroban-env-host`, whose `rand_core` traits are incompatible with
env-host's `testutils` code. Do not "clean up" that patch or that directory.
:::

---

## Repository Structure

```
soroban-cost-profiler/
├── Cargo.toml                    # workspace: this crate + fixtures/dummy-contract
├── AGENTS.md                     # the six rules every change is reviewed against
├── ARCHITECTURE.md               # stage-by-stage design
├── ROADMAP.md                    # phases; the box for the issue you are on lands in the same branch
├── README.md                     # usage + the Limitations section docs pages link to
├── benches/
│   ├── tracer_benchmark.rs       # criterion, harness = false
│   └── source_map_benchmark.rs
├── docs/                         # this site's source, plus the Pages landing page
│   ├── index.html                # https://tollcraft.github.io/soroban-cost-profiler/
│   ├── internals/                # call_boundaries, dwarf_mapping, tracer_architecture
│   ├── spikes/                   # 01 budget API limits, 02 name-section fallback
│   ├── troubleshooting.md
│   └── tutorial.md
├── fixtures/
│   ├── build.sh                  # cargo build --release for dummy-contract
│   ├── dummy-contract/           # compute + storage loops, its own test_snapshots/
│   ├── dwarf_probe/              # line tables on purpose; also a no-debug twin
│   └── state/ledger.json         # a snapshot --state can load
├── src/
│   ├── main.rs                   # CLI: parsing, the five stages, the summary, exit codes
│   ├── lib.rs                    # library surface so tests and benches reach each stage
│   ├── models.rs                 # TraceEvent/EventType, SourceFrame, CallStackNode
│   ├── tracer.rs                 # ExecutionTracer: the wasmi call/return/step hooks
│   ├── host.rs                   # the 199 soroban-env-host function bindings
│   ├── state.rs                  # --state: ledger snapshot → Host
│   ├── source_map.rs             # SourceMapper facade: name lookup + the policies
│   ├── source_map/               # its submodules
│   │   ├── wasm.rs               # WasmSections: parse the wasm module
│   │   ├── names.rs              # NameSection: the function-name fallback
│   │   └── dwarf.rs              # CodeMap: gimli line tables + the degenerate sample
│   ├── aggregator.rs             # ProfileAggregator: events → costed call tree
│   └── formatter.rs              # OutputFormatter: folded, JSON, raw, differential folded
└── tests/
    ├── cli_e2e.rs                # the real binary, argv in / stdout+stderr+exit code out
    ├── integration.rs
    ├── meter_probe.rs            # what the engine actually reports (and pins what it does not)
    ├── differential.rs           # compare's arithmetic
    ├── source_map_fixture.rs     # resolved addresses checked against source text
    └── traces/                   # baseline.folded / current.folded
```

`target/wasm32-unknown-unknown/` and `target/` are build output and are not committed.

---

## Building

```bash
cargo build --release      # the binary lands in target/release/soroban-cost-profiler
cargo test                 # unit + integration; no wasm target required
cargo doc --no-deps        # not in CI; catches dead intra-doc links
```

`[profile.release]` is `opt-level = "z"`, because the release build is the artifact people download, not a
benchmark target. Measure with `cargo bench` or an explicit `--profile profiling` build.

---

## Rebuilding the fixtures

```bash
fixtures/build.sh                          # → dummy-contract release wasm
(cd fixtures/dwarf_probe && ./build.sh)    # → the DWARF probe and its no-debug twin
```

`dwarf_probe.wasm` and `dwarf_probe_no_debug.wasm` **are** committed. Tests `include_bytes!` them, so a
rebuild that changes their bytes changes the assertions in
`tests/source_map_fixture.rs` and `tests/cli_e2e.rs` — including the pinned `wasm[0] 0`. Rebuild them only
when the source-mapping behaviour is what you are changing, and read the test diffs before accepting them.

A fixture contract that takes SDK parameters receives a tagged `Val` as an `i64` word, which is why the
documentation's `--args` examples write `(10000 << 32) | 4` rather than `10000`.

---

## Running the suites

```bash
cargo test --test integration          # the pipeline stages wired together
cargo test --test cli_e2e              # argv → artifact, exit code included
cargo test --test meter_probe          # the engine-behaviour probes
cargo bench --bench tracer_benchmark   # criterion
```

Verbose test output uses Cargo's own flags:

```bash
RUST_BACKTRACE=1 cargo test -- --nocapture
```

There is no `SOROBAN_PROFILER_LOG`, no `RUST_LOG` and no `NO_COLOR` variable. Progress logging inside the
profiler is `tracing` behind `-v`/`-vv`/`-vvv`, and those levels are refused together with `--quiet` by the
argument parser rather than resolved at runtime.

---

## Before you open a pull request

`AGENTS.md` is normative and short. CI runs three commands plus a fixture build, and they are the same ones
to run before pushing:

```bash
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo build --target wasm32-unknown-unknown --release -p dummy-contract   # the fixture job, from fixtures/build.sh
```

`cargo doc --no-deps` is not in the workflow. Run it anyway: the pipeline documentation is full of intra-doc
links into these modules, and a dead one is review noise.

The rules that most often fail a first draft:

1. **Stdout is a contract.** The artifact and the summary go to stdout; warnings, errors and `tracing`
   records go to stderr. A new diagnostic on stdout breaks `--output -`.
2. **Zero instrumentation.** Nothing may require the profiled contract to add macros, features or a
   second build.
3. **No new dependencies without a decision.** That is what keeps `arbitrary` and the `testutils` feature
   out of the tree, and why there is no `inferno` and no hand-rolled DWARF parser instead of `gimli`.
4. **Nothing may allocate per instruction.** A contract can run 100M of them; the trace buffer is bounded
   by `--instruction-limit` for exactly this reason.
5. **Every number in a doc or PR body is measured.** If a claim cites an instruction count, a byte count,
   or a percentage, it names the fixture and the command that produced it.
6. **The ROADMAP box for the issue lands in the same branch** as the change.

See [Contributing](contributing.md) for the PR shape and
[Roadmap](roadmap.md) for what is open.
