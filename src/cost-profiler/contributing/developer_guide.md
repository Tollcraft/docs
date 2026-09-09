# Developer Guide

> Instructions for setting up a local development environment, building the profiler, and running test suites.

---

## Prerequisites

* **Rust Toolchain:** Stable Rust (1.80+) with `wasm32-unknown-unknown` target installed:
  ```bash
  rustup target add wasm32-unknown-unknown
  ```
* **Git:** For repository management.

---

## Repository Structure

```
soroban-cost-profiler/
├── Cargo.toml                  # Workspace manifest
├── .gitbook.yaml               # GitBook documentation synchronization
├── src/                        # Profiler core codebase
│   ├── main.rs                 # CLI entry point
│   ├── lib.rs                  # Library entry point
│   ├── models.rs               # TraceEvent, CallStackNode, SourceFrame
│   ├── tracer.rs               # ExecutionTracer (wasmi interception)
│   ├── source_map.rs           # SourceMapper (DWARF parsing)
│   ├── aggregator.rs           # ProfileAggregator (tree accumulation)
│   └── formatter.rs            # OutputFormatter (folded stacks, SVG)
├── docs/                       # GitBook documentation site
│   ├── SUMMARY.md              # Documentation table of contents
│   ├── README.md               # Introduction page
│   ├── getting-started/        # Getting started guides
│   ├── cost/                   # Cost model and metering documentation
│   ├── guides/                 # Step-by-step optimization guides
│   ├── reference/              # Architecture and CLI specifications
│   └── contributing/           # Development and contributor guidelines
├── fixtures/                   # Test contracts
│   └── dummy-contract/         # Contract with compute loops and storage
└── tests/                      # Integration test suites
```

---

## Building the Profiler

Build the profiler in debug or release mode:

```bash
cargo build
cargo test
```

---

## Compiling the Fixture Contract

To run integration tests against a real Soroban contract:

1. Navigate to the dummy contract directory:
   ```bash
   cd fixtures/dummy-contract
   ```
2. Build with the profiling profile to generate line tables:
   ```bash
   cargo build --target wasm32-unknown-unknown --profile profiling
   ```
3. The resulting binary will be at:
   `target/wasm32-unknown-unknown/profiling/dummy_contract.wasm`

---

## Running Integration Tests

Run the workspace integration test suite:

```bash
cargo test --test integration
```

To run with full backtraces and debug logging:

```bash
RUST_BACKTRACE=1 SOROBAN_PROFILER_LOG=debug cargo test
```

