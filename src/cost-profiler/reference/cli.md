# CLI Tool Reference

> Command-line interface documentation, flags, options, and environment variables.

---

## Command Syntax

```bash
soroban-cost-profiler [OPTIONS] --wasm <WASM_FILE> --fn <FUNCTION_NAME>
```

---

## Required Arguments

| Option | Shorthand | Description |
| :--- | :--- | :--- |
| `--wasm <PATH>` | `-w` | Path to the compiled contract WASM binary (compiled with `--profile profiling`). |
| `--fn <NAME>` | `-f` | Contract export or test entry-point function name to execute and trace. |

---

## Configuration Options

| Option | Default | Description |
| :--- | :--- | :--- |
| `--output <PATH>` | `profile.svg` | Destination file for the profile output. |
| `--format <FMT>` | `svg` | Output format: `svg` (interactive flamegraph), `speedscope` (folded stack text), `json` (raw call tree). |
| `--sample-rate <INT>` | `1000` | Sampling frequency for raw instruction steps in tight loops to avoid memory exhaustion. |
| `--max-instructions <INT>` | `100000000` | Hard CPU instruction ceiling before halting runaway loops (matches network cap). |
| `--extra-wasm <PATH>` | None | Additional WASM binaries for resolving multi-contract / cross-contract calls. |
| `--wasm-dir <DIR>` | None | Directory to search for auxiliary contract WASM files with DWARF tables. |
| `--color <WHEN>` | `auto` | Terminal color output: `auto`, `always`, `never`. |

---

## Environment Variables

| Variable | Description |
| :--- | :--- |
| `NO_COLOR=1` | Disables ANSI colored terminal output, respecting the [NO_COLOR](https://no-color.org) standard. |
| `SOROBAN_PROFILER_LOG` | Configures verbosity level (`trace`, `debug`, `info`, `warn`, `error`). |

---

## Examples

### 1. Generate an SVG Flamegraph
```bash
soroban-cost-profiler \
  --wasm target/wasm32-unknown-unknown/profiling/my_contract.wasm \
  --fn process_order \
  --output ./flamegraph.svg
```

### 2. Export Folded Stacks for Speedscope
```bash
soroban-cost-profiler \
  --wasm target/wasm32-unknown-unknown/profiling/my_contract.wasm \
  --fn process_order \
  --format speedscope \
  --output ./stacks.folded
```

### 3. Trace with Multi-Contract Dependencies
```bash
soroban-cost-profiler \
  --wasm target/wasm32-unknown-unknown/profiling/router.wasm \
  --extra-wasm target/wasm32-unknown-unknown/profiling/pool.wasm \
  --extra-wasm target/wasm32-unknown-unknown/profiling/token.wasm \
  --fn multi_hop_swap \
  --output multi_swap.svg
```

### 4. Adjust Sampling for Ultra-High Compute Contracts
```bash
soroban-cost-profiler \
  --wasm target/wasm32-unknown-unknown/profiling/heavy_math.wasm \
  --fn benchmark_calculations \
  --sample-rate 5000 \
  --max-instructions 50000000
```

