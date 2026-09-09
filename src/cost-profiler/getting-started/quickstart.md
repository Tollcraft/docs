# Overview & Quickstart

> Get started profiling your Soroban smart contracts to generate visual flamegraphs in minutes.

---

## Installation

You can install `soroban-cost-profiler` using Cargo directly from the Tollcraft repository:

```bash
cargo install --git https://github.com/Tollcraft/soroban-cost-profiler
```

Or clone and build from source:

```bash
git clone https://github.com/Tollcraft/soroban-cost-profiler.git
cd soroban-cost-profiler
cargo build --release
```

---

## 1. Configure the Profiling Profile

By default, Soroban release builds strip all debug tables to minimize bytecode size. To enable source mapping down to Rust line numbers, add a dedicated `[profile.profiling]` entry in your contract's `Cargo.toml`:

```toml
[profile.profiling]
inherits = "release"
debug = "line-tables-only"
```

::: danger
**Never add `debug = true` to `[profile.release]`!**
If you accidentally deploy a contract with debug tables to mainnet, you will pay significantly higher ledger storage and transaction size fees for the binary bloat.
:::

---

## 2. Compile Your Contract

Compile your contract with the profiling profile targeted at WebAssembly:

```bash
cargo build --target wasm32-unknown-unknown --profile profiling
```

Your unstripped binary containing DWARF line tables will be located at:
`target/wasm32-unknown-unknown/profiling/my_contract.wasm`

---

## 3. Run the Profiler

Run `soroban-cost-profiler` against the compiled WASM binary, specifying the contract function you wish to trace:

```bash
soroban-cost-profiler \
  --wasm target/wasm32-unknown-unknown/profiling/my_contract.wasm \
  --fn compute_heavy_loop \
  --output flamegraph.svg
```

The tool will:
1. Load the WASM binary and parse DWARF line information.
2. Spin up a metered Soroban execution environment.
3. Trace every instruction and function call.
4. Resolve instruction pointers to Rust file and line numbers.
5. Aggregate inclusive and exclusive CPU costs.
6. Render an interactive `flamegraph.svg`.

---

## 4. Inspect the Output

Open `flamegraph.svg` in any standard web browser:

```bash
open flamegraph.svg
```

Alternatively, generate a `.folded` text file for interactive exploration in [Speedscope](https://www.speedscope.app):

```bash
soroban-cost-profiler \
  --wasm target/wasm32-unknown-unknown/profiling/my_contract.wasm \
  --fn compute_heavy_loop \
  --format speedscope \
  --output profile.folded
```

Drag and drop `profile.folded` into [speedscope.app](https://www.speedscope.app) to switch between:
* **Time Order view:** Visualizes the execution sequence over the transaction lifecycle.
* **Left Heavy view:** Aggregates identical call stacks to immediately reveal top cost contributors.
* **Sandwich view:** Shows callers and callees for any individual function.

---

## Next Steps

* Learn about [**The Debug Precondition**](debug_precondition.md) to understand compiler optimizations and downstream stripping caveats.
* Dive into [**Soroban Cost Model & Metering**](../cost/cost_model.md) to understand what resources are tracked.
* See [**Diagnosing Budget Regressions**](../guides/diagnosing_regressions.md) for a step-by-step optimization tutorial.

