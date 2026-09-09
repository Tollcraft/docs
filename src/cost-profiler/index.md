# Cost Profiler Overview

<span class="tier-pill t3">Tier 3 • Diagnose</span>

> **Visual flamegraphs and execution tracing for Soroban smart contracts** — pinpoint the exact functions, loops, and host operations consuming your transaction budget.

Part of the **Tollcraft** initiative.

::: tip Interactive Online Playground Available
Don't want to install anything locally yet? Try out the [**Interactive Web Playground**](https://tollcraft.github.io/soroban-cost-profiler/) to inspect live sample flamegraphs, zoom into stack frames, and search hot functions right in your browser.
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

Testing tools like `soroban-budget-assert` can tell you *that* an invocation consumed 8,450,000 CPU instructions and violated your CI budget. However, raw numbers do not tell you *why*:

* Was the budget spike caused by an unrolled loop in your contract logic?
* Did an innocently structured helper method repeatedly cross the WASM-to-host boundary?
* Which specific line of code triggered redundant storage serialization?

Without execution profiling, developers are forced to manually comment out code blocks or insert ad-hoc logging to guess where instructions were burned.

`soroban-cost-profiler` solves this by tracing WebAssembly (WASM) execution instruction-by-instruction, resolving instruction pointers back to human-readable Rust source code lines via DWARF symbols, and rendering visual flamegraphs.

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
│ Visual Output    │ <── │ Output Formatter  │ <── │   Source Mapper    │
│ (Flamegraph/SVG) │     │ (Folded Stacks)   │     │   (gimli/DWARF)    │
└──────────────────┘     └───────────────────┘     └────────────────────┘
```

1. **WASM Instrumentation:** Hooks into the execution engine to monitor function calls, returns, and metered instruction steps.
2. **DWARF Source Resolution:** Translates raw WASM Program Counters (PC) into Rust function names, source files, and line numbers.
3. **Cost Aggregation:** Calculates both **exclusive** (self-consumed) and **inclusive** (total sub-tree) CPU instructions and memory consumption for every frame.
4. **Visual Flamegraph Generation:** Exports standard folded-stack profiles compatible with tools like `speedscope.app` or renders interactive SVGs via `inferno`.

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
* [**Generating & Reading Flamegraphs**](guides/flamegraphs.md) — How to read and navigate collapsed stacks and flamegraphs
* [**CLI Tool Reference**](reference/cli.md) — Flags, options, and commands
* [**Development Roadmap**](contributing/roadmap.md) — Current status and upcoming milestones

