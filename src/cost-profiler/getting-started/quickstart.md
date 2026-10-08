# Overview & Quickstart

> Run one exported function of a compiled Soroban contract under a traced engine and write its profile, in
> about the time it takes to build the contract.

---

## Installation

Build the profiler from source:

```bash
git clone https://github.com/Tollcraft/soroban-cost-profiler.git
cd soroban-cost-profiler
cargo build --release            # Rust 1.85 or newer; the crate is edition 2024
./target/release/soroban-cost-profiler --help
```

Building from source is the documented install path — the repository publishes no versioned release, so
start from `--help` on the binary you built rather than a package name. The binary is not a cargo
subcommand either: `cargo cost-profiler` does not exist. You run the binary and point it at a `.wasm` file.

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

Point the binary at the compiled WASM and name the export to invoke:

```bash
soroban-cost-profiler \
  --wasm target/wasm32-unknown-unknown/profiling/my_contract.wasm \
  --fn compute_heavy_loop \
  --output compute.folded
```

The tool will:

1. Load and parse the module, then instantiate it against `soroban-env-host` — all 199 host functions are
   linked, so an SDK contract actually runs.
2. Record the engine's call, return, step and host-transition events, sampled every `--sample-rate`
   boundaries (1000 by default).
3. Name each frame from the binary's DWARF line tables, falling back to the wasm `name` section, then to
   `wasm[pc]`.
4. Fold the event stream into a call tree with exclusive and inclusive cost per frame.
5. Write the artifact — collapsed stacks here, since `--format` defaults to `folded` — and print a ranked
   summary of the same run on stdout.

Read the artifact, not only the summary:

```console
$ soroban-cost-profiler --wasm target/wasm32-unknown-unknown/profiling/dwarf_probe.wasm --fn caller_of_heavy
no function recorded any exclusive cost (cpu)
$ cat profile.folded
wasm[0] 0
```

That transcript is real, and the sentence is the tool doing its job: `wasmi` 2.0 hands the tracer call
boundaries and no program counter, so frames arrive at `wasm[0]` and the cost columns read `0`. A profile
of zeros and a profiler that never ran would otherwise look the same. When the export calls the host, the
host frames carry the cost — measured on the repository's `dummy-contract` artifact, `memory_heavy_loop`
at 100 iterations is 125,022 in CPU units, 50,080 in memory bytes, and 102 host calls.

Read [Known Risks & Failure Modes](../reference/risks.md) before you treat any of these numbers as a
budget estimate. For the instructions the network will actually charge, use Tier 2.

---

## 4. Inspect the Output

There is no SVG to open: the profiler writes text and does not draw pictures. Three shapes, one flag:

| `--format` | Writes | Default file | Reach for it when |
| :--- | :--- | :--- | :--- |
| `folded` (default) | one line per call path, `<frame>;<frame> <cost>` | `profile.folded` | you want to look at the run, or diff it later |
| `json` | the call tree, metric and `file:line` on every frame | `profile.json` | a script or CI job walks the frames |
| `raw` | one line per recorded event, unnamed and unfolded | `profile.raw` | the profile looks wrong and you want what the engine said |

```bash
# a picture, drawn by the tool that draws pictures
flamegraph.pl compute.folded > compute.svg && open compute.svg

# the same file in speedscope.app — it reads the collapsed-stack format directly
open https://www.speedscope.app

# the tree as data, straight into jq
soroban-cost-profiler --wasm contract.wasm --fn compute_heavy_loop --format json --output - | jq .metric
```

`--output -` sends the artifact to stdout and prints nothing else, which is what makes the last line work.
With `--output` omitted, the filename follows the format — `profile.folded`, `profile.json`, `profile.raw`.

In speedscope.app, switch views to read the same file three ways:

* **Sequence (Time Order) view:** the call paths as the trace recorded them.
* **Left Heavy view:** stacks sorted by cost, so the widest frame is the biggest single contributor.
* **Sandwich view:** one function with its callers above and its callees below.

::: warning What the viewer is showing you
The counts are boundaries the engine reported, not wasm instructions, and the tree is one level deep for a
directly invoked export. A wide bar means "this frame had the most recorded cost", not "this line executed
the most instructions". See [Reading & Visualizing Profiles](../guides/flamegraphs.md).
:::

---

## Next Steps

* Learn about [**The Debug Precondition**](debug_precondition.md) to understand compiler optimizations and downstream stripping caveats.
* Dive into [**Soroban Cost Model & Metering**](../cost/cost_model.md) to understand what resources are tracked.
* See [**Diagnosing Budget Regressions**](../guides/diagnosing_regressions.md) for a step-by-step optimization tutorial.

