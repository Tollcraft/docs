# Cost Profiler Overview

<span class="tier-pill t3">Tier 3 • Diagnose</span>

> **Execution tracing and cost attribution for Soroban smart contracts** — turn a failed budget into a
> profile that names the functions and source lines where the cost was recorded.

Part of the **Tollcraft** initiative.

::: tip Product tour available
The [**demo page**](https://tollcraft.github.io/soroban-cost-profiler/) walks the pipeline and shows the
real command line and output, including what a degraded run prints. It is a tour of the tool, not a
profiler running in your browser.
:::

---

## The Cost of Soroban Execution

Every smart contract on Stellar runs against strict, network-enforced resource limits. Every operation has an immediate fee impact:

| Resource Dimension | Metering Unit | Fee Impact | Primary Cost Drivers |
| :--- | :--- | :--- | :--- |
| **CPU Instructions** | Executed instruction count | Direct fee charge | Wasm instruction execution (`WasmInsnExec`), crypto hashing, host dispatches |
| **Memory Allocations** | Bytes allocated / copied | Hard ceiling enforcement | Byte array cloning, memory copies (`MemCpy`), large vector instantiation |
| **Storage Operations** | Entry reads & writes | Direct fee charge | Key-value lookups, instance data serialization, persistent ledger mutations |
| **Ledger I/O Bytes** | Bytes read & written | Direct fee charge | Serialized payload sizes written to or read from the ledger |

When your contract transaction executes, the Stellar network calculates a non-refundable resource fee based directly on these measured inputs. 

::: warning
**Cost bugs don't fail standard tests — they silently inflate production transaction fees or exhaust user budgets on-chain.**
:::

---

## The Visibility Problem

Testing tools like `soroban-budget-assert` can tell you *that* an invocation burned through your CI
budget. However, raw numbers do not tell you *why*:

* Was the budget spike caused by an unrolled loop in your contract logic?
* Did an innocently structured helper method repeatedly cross the WASM-to-host boundary?
* Which specific line of code triggered redundant storage serialization?

Without execution profiling, developers are forced to manually comment out code blocks or insert ad-hoc logging to guess where instructions were burned.

`soroban-cost-profiler` solves this by running one exported function of a compiled contract under an
instrumented engine, rebuilding the call tree from what the engine reports, naming the frames from the
binary's own DWARF line tables, and writing the result as collapsed-stack text, JSON, or the raw event
stream.

::: warning Read the limitations before you read a number
The pipeline is complete and tested — load, trace, symbolize, aggregate, format, diff — and its ceiling is
at the *input*: `wasmi` 2.0 exposes no instruction-level hook and its call hook carries no program counter,
so the tracer sees a list of call boundaries rather than the instructions between them, and today every
frame lands at `wasm[0]`. The counts are a floor and a shape, not a budget reading. See
[Known Risks & Failure Modes](reference/risks.md).
:::

---

## How It Works

```
                     ┌───────────────────────────┐
                     │   contract.wasm (DWARF)   │
                     └─────────────┬─────────────┘
                                   │
                                   ▼
┌──────────────────┐     ┌───────────────────┐     ┌────────────────────┐
│  WASM Execution  │ ──> │ Execution Tracer  │ ──> │ Profile Aggregator │
│ (soroban-env)    │     │  (wasmi hooks)    │     │ (CallStack Tree)   │
└──────────────────┘     └───────────────────┘     └─────────┬──────────┘
                                                             │
                                                             ▼
┌──────────────────┐     ┌───────────────────┐     ┌────────────────────┐
│ Text Artifact    │ <── │ Output Formatter  │ <── │   Source Mapper    │
│ .folded/.json/   │     │ (folded stacks,   │     │   (gimli/DWARF)    │
│ .raw  + summary  │     │  JSON tree, raw)  │     │                    │
└──────────────────┘     └───────────────────┘     └────────────────────┘
```

1. **WASM tracing:** Hooks into the execution engine to record call and return boundaries, host
   transitions, and sampled steps with their cost deltas.
2. **DWARF source resolution:** Translates a code-section address into a Rust function name, source
   file, and line number when the binary's line tables carry it; falls back to the wasm `name`
   section, then to `wasm[pc]`.
3. **Cost aggregation:** Calculates both **exclusive** (self-consumed) and **inclusive** (total
   sub-tree) CPU instructions, memory bytes, and host calls for every frame.
4. **Text output:** Writes the standard collapsed-stack format that speedscope.app opens directly and
   `flamegraph.pl` turns into a picture, plus a JSON call tree and the raw event stream, and prints a
   terminal summary of the same run. The tool writes text and no SVG.

---

## The Tollcraft Cost Pipeline

`soroban-cost-profiler` operates as Tier 3 in Tollcraft's three-tiered cost awareness architecture:

| Tier | Tool | Focus | When It Runs | What It Answers |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1: Prevent** | `soroban-cost-linter` | Static Analysis | Compile time / `cargo check` | *"Are there obvious anti-patterns like storage calls in loops?"* |
| **Tier 2: Detect** | `soroban-budget-assert` | Empirical Testing | Test time / `cargo test` | *"Did a code change exceed our calibrated CPU or byte budget?"* |
| **Tier 3: Diagnose** | `soroban-cost-profiler` | Deep Diagnostics | Post-failure / CI diagnostics | *"Where exactly in our Rust source code was the budget spent?"* |

---

## Jump In

::: info
Ready to start profiling? Read the [**Overview & Quickstart**](getting-started/quickstart.md) and ensure you configure [**The Debug Precondition**](getting-started/debug_precondition.md) before building your WASM binaries.
:::

* [**Overview & Quickstart**](getting-started/quickstart.md) — Profile your first Soroban contract in minutes
* [**The Debug Precondition**](getting-started/debug_precondition.md) — How to preserve DWARF symbols without bloating production mainnet contracts
* [**Soroban Cost Model & Metering**](cost/cost_model.md) — Detailed breakdown of Soroban cost types, host dispatch, and fee calculations
* [**Exclusive vs. Inclusive Costs**](cost/exclusive_vs_inclusive.md) — How to interpret self-cost versus child-call costs
* [**Reading & Visualizing Profiles**](guides/flamegraphs.md) — The collapsed-stack format, speedscope.app, and `flamegraph.pl`
* [**Diagnosing Regressions**](guides/diagnosing_regressions.md) — `compare` two runs and read the table
* [**CLI Tool Reference**](reference/cli.md) — Flags, output formats, subcommands, and exit codes
* [**Known Risks & Failure Modes**](reference/risks.md) — What the trace cannot see, and what a profile of zeros means
* [**Development Roadmap**](contributing/roadmap.md) — What has shipped and what is left

