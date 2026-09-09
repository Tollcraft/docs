# Cost Linter Overview

<span class="tier-pill t1">Tier 1 • Prevent</span>

> **The static analysis shield for Soroban smart contracts** — catch structurally expensive patterns before they are compiled and deployed to the network.

Part of the **Tollcraft** initiative:
* **Tier 1: Prevent** — [Cost Linter](index.md): Catch structurally expensive anti-patterns before compilation.
* **Tier 2: Detect** — [Budget Assert](/budget-assert/): Measure network-simulated costs and enforce budgets in CI.
* **Tier 3: Diagnose** — [Cost Profiler](/cost-profiler/): Trace execution and generate visual flamegraphs down to Rust lines.

---

## The Cost of Soroban Operations

Soroban charges for every resource your contract consumes on-chain:

| Resource | Cost Profile | Primary Cost Drivers |
| :--- | :--- | :--- |
| **CPU Instructions** | Charged per instruction executed | High-level loops, recursion, host call boundaries |
| **Memory Allocations** | Charged per allocation and copy | `Bytes`, `Vec`, and `Map` re-allocations on host |
| **Storage Operations** | Reads and writes — often the **most expensive** component | Repeated `instance().set()` or `persistent().set()` |

Storage operations (reads and writes) are often the single most expensive component of any smart contract transaction. For instance, executing repeated storage operations inside a loop rather than aggregating state changes in memory before writing can multiply gas costs by 10&times; to 100&times;.

::: warning Every wasted instruction is a fee your users pay
Cost bugs don't fail standard tests — they silently inflate transaction fees in production or exhaust user budgets on-chain.
:::

---

## How It Works

Our linter hooks directly into the Rust compiler's High-Level Intermediate Representation (HIR) via [Dylint](https://github.com/trailofbits/dylint) to detect input-independent, structurally expensive patterns — alerting you before they are compiled and deployed to the network.

```bash
# Run lint checks across all contract crates in the workspace
cargo cost-lint --all-targets
```

---

## Documentation Navigation

::: info Quick Start
New here? Start with the [**Integration Guide**](integration.md) to wire the linter into your workspace and CI in minutes. Before proposing a new lint, read [**Scope: Clippy vs. soroban-cost-linter**](scope_boundary.md).
:::

* [**Lint Catalog**](lint_catalog.md) — complete catalog of all 40+ lints and category breakdown
* [**Lint Categories**](lint_categories.md) — grouping by storage, compute, memory, and authorization
* [**Storage In Loop Rule**](lints/soroban_storage_in_loop.md) — deep dive into our flagship prevention lint
* [**Integration Guide**](integration.md) — `budget.toml` configuration and GitHub Actions setup
* [**Scope: Clippy vs. soroban-cost-linter**](scope_boundary.md) — which patterns belong here and which belong to Clippy
* [**Troubleshooting**](troubleshooting.md) — library-not-found, toolchain mismatch, and silent failures
* [**Cost Rationale**](cost_rationale.md) — empirical research backing every lint severity score
