---
layout: home

hero:
  name: "Tollcraft"
  text: "Stop guessing your gas bill."
  tagline: "A three-tier cost awareness pipeline for Stellar smart contracts. Lint at compile time, assert at test time, profile when the budget fails — so every CPU instruction and storage byte is accounted for before mainnet."
  actions:
    - theme: brand
      text: Explore the Pipeline
      link: "#the-pipeline"
    - theme: alt
      text: Product Tour
      link: "https://tollcraft.github.io/soroban-cost-profiler/"

features:
  - title: Tier 1 — Prevent
    details: Catch structurally expensive anti-patterns (storage in loops, redundant clones) before your code compiles using rustc and Dylint static analysis.
    link: /cost-linter/
    linkText: Cost Linter Docs →
  - title: Tier 2 — Detect
    details: Simulate your contract against live network metering inside cargo test. Pin verified costs and fail CI before regressions hit on-chain.
    link: /budget-assert/
    linkText: Budget Assert Docs →
  - title: Tier 3 — Diagnose
    details: When a budget fails, run one contract export under a traced engine, name its frames from the binary's DWARF line tables, and write a profile the profilers you already know can read.
    link: /cost-profiler/
    linkText: Cost Profiler Docs →
---

<div id="the-pipeline" style="margin-top: 48px;"></div>

<!-- Interactive Pipeline Component -->
<PipelineInteractive />

---

## Two Ways In

Tier 1 and Tier 2 run as Cargo subcommands — `cargo cost-lint` and `cargo budget-report` — inside your
contract's own build. Tier 3 is a standalone binary you point at a compiled `.wasm`; it needs no macro,
no test hook and no change to your contract's source.

<TerminalDemo />

---

## The Three Tiers of Cost Awareness

<CostTiersGrid />

---

<!-- Interactive Cost Telemetry Matrix -->
<CostTelemetryMatrix />

---

## The Cost of Soroban Operations

Soroban charges for every hardware resource your contract consumes on-chain. These are the
per-transaction caps the budget macros read from `tier-a-limits.env`, as configured for **Protocol 23**
(source: [Stellar Lab network limits](https://lab.stellar.org/network-limits)):

| Resource Dimension | Unit of Measurement | Cap (Per Tx) | Fee Impact |
| :--- | :--- | :--- | :--- |
| **CPU Instructions** | Metered instruction count | 100,000,000 | Non-refundable fee per million instructions |
| **Memory** | Bytes resident during execution | 41,943,040 (40 MiB) | Enforced limit (execution fails on breach) |
| **Ledger Read Bytes** | Serialized payload bytes | 200,000 | Non-refundable fee per KB read |
| **Ledger Write Bytes** | Serialized payload bytes | 132,096 | Non-refundable fee per KB written |

::: warning Limits move with the protocol
Validator consensus sets these numbers and they change between protocol versions. `soroban-budget-assert`
pins `soroban-sdk` 27.0.3 / `stellar-xdr` 27.0.0 and targets Protocol 27; `soroban-cost-profiler`'s host is
`soroban-env-host` 28.0.2, i.e. **Protocol 28**. Treat the table above as the configuration the tools
derive percentage budgets from, not as a guarantee for the network you deploy to — re-derive it against
the limits your target protocol actually ships (`stellar network settings` prints them).
:::

::: tip Every wasted instruction is a fee your users pay
Cost bugs don't fail standard unit tests — they silently inflate transaction fees in production. Use the Tollcraft pipeline to audit, gate, and diagnose your contracts before deployment.
:::
