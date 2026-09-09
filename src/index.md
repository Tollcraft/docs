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
      text: View on GitHub
      link: "https://github.com/Tollcraft"

features:
  - title: 🛡️ Tier 1 — Prevent
    details: Catch structurally expensive anti-patterns (storage in loops, redundant clones) before your code compiles using rustc and Dylint static analysis.
    link: /cost-linter/
    linkText: Cost Linter Docs →
  - title: 🧪 Tier 2 — Detect
    details: Simulate your contract against live network metering inside cargo test. Pin verified costs and fail CI before regressions hit on-chain.
    link: /budget-assert/
    linkText: Budget Assert Docs →
  - title: 🔥 Tier 3 — Diagnose
    details: When a budget fails, trace WASM execution instruction-by-instruction, map offsets back to Rust lines via DWARF, and inspect visual flamegraphs.
    link: /cost-profiler/
    linkText: Cost Profiler Docs →
---

<div id="the-pipeline" style="margin-top: 60px;"></div>

## The Three Tiers of Cost Awareness

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. PREVENT: soroban-cost-linter                                        │
│ Static analysis in rustc / Dylint — catches bad patterns at build time │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ passes checks
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. DETECT: soroban-budget-assert                                       │
│ Runtime simulation in cargo test — asserts against exact network budgets│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ budget violated!
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. DIAGNOSE: soroban-cost-profiler                                     │
│ Instruction tracing & flamegraphs — shows exactly where cost occurred  │
└────────────────────────────────────────────────────────────────────────┘
```

<div class="tollcraft-grid">
  <a class="tollcraft-card tier-1" href="/cost-linter/">
    <div class="card-badge">Tier 1: Prevent</div>
    <h3>Cost Linter</h3>
    <p>A static analysis shield for Soroban smart contracts. Hooks directly into rustc to catch expensive patterns before compilation.</p>
    <div class="card-link">Explore Cost Linter →</div>
  </a>

  <a class="tollcraft-card tier-2" href="/budget-assert/">
    <div class="card-badge">Tier 2: Detect</div>
    <h3>Budget Assert</h3>
    <p>An empirical runtime test harness. Measures network-simulated resource consumption and fails CI when budget limits are breached.</p>
    <div class="card-link">Explore Budget Assert →</div>
  </a>

  <a class="tollcraft-card tier-3" href="/cost-profiler/">
    <div class="card-badge">Tier 3: Diagnose</div>
    <h3>Cost Profiler</h3>
    <p>Visual flamegraphs and execution tracing. Diagnoses exactly which functions, loops, and host operations burned your budget.</p>
    <div class="card-link">Explore Cost Profiler →</div>
  </a>
</div>

---

## The Cost of Soroban Operations

Soroban charges for every hardware resource your contract consumes:

| Resource Dimension | Unit of Measurement | Hard Cap (Per Tx) | Fee Impact |
| :--- | :--- | :--- | :--- |
| **CPU Instructions** | Executed instruction count | 100,000,000 instructions | Non-refundable fee per million instructions |
| **Memory Allocations** | Bytes allocated / resident | 40 MB | Enforced limit (execution fails on breach) |
| **Ledger Entry Reads** | Key-value pairs accessed | 40 entries | Non-refundable fee per entry read |
| **Ledger Entry Writes** | Key-value pairs mutated | 25 entries | Non-refundable fee per entry written |
| **Ledger Read Bytes** | Serialized payload bytes | ~200 KB | Non-refundable fee per KB read |
| **Ledger Write Bytes** | Serialized payload bytes | ~100 KB | Non-refundable fee per KB written |
| **Ledger Space Rent** | Byte $\times$ Ledgers duration | Dynamic | Dynamic refundable rent based on entry TTL |

::: tip Every wasted instruction is a fee your users pay
Cost bugs don't fail standard tests — they silently inflate transaction fees in production. Use the Tollcraft pipeline to audit and safeguard your protocols.
:::
