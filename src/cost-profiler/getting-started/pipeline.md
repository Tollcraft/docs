# Tollcraft Cost Pipeline

> How Cost Profiler fits into the unified Tollcraft smart contract cost-awareness suite.

---

## Three Tiers of Cost Awareness

Writing cost-effective smart contracts requires a multi-stage approach. In Soroban, cost regressions are not syntax errors—they compile cleanly, pass unit tests, and silently increase user fees or fail with out-of-gas errors in production.

Tollcraft addresses this problem across three progressive development phases:

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

---

## Comparison Matrix

| Capability | Tier 1: `soroban-cost-linter` | Tier 2: `soroban-budget-assert` | Tier 3: `soroban-cost-profiler` |
| :--- | :--- | :--- | :--- |
| **Primary Goal** | Prevent anti-patterns | Enforce budget boundaries | Locate bottlenecks |
| **Execution Point** | `cargo check` / compile-time | `cargo test` / CI pipeline | On-demand / diagnostic runs |
| **Methodology** | AST / HIR Static Analysis | Simulated WASM execution | Instruction-level tracing & DWARF |
| **Metric Monitored** | Structural code patterns | CPU instructions & ledger bytes | Per-function CPU & memory |
| **Runtime Input Sensitivity** | None (input-independent) | High (measures real inputs) | High (traces execution path) |
| **Output** | Compiler warnings / lints | Pass/Fail report & diffs | Visual SVG flamegraph & stack traces |

---

## The Workflow in Practice

### Step 1: Write and Lint
As you write contract logic, `soroban-cost-linter` flags structural blunders before you run a single test:
* Repeated storage reads inside loops.
* Redundant environment cloning.
* Inefficient dynamic byte concatenation.

### Step 2: Test and Enforce
Once structural anti-patterns are resolved, `soroban-budget-assert` simulates your contract against the exact Soroban network metering model using `budget_lt!` macros:

```rust
// Fails CI if CPU instructions exceed 1,500,000
#[budget_cpu_lt(1_500_000)]
fn test_liquidity_provision() {
    // contract setup and invocation
}
```

### Step 3: Profile and Optimize
When a test fails because a new feature pushed the cost from 1,200,000 to 2,800,000 CPU instructions, you run `soroban-cost-profiler`:
1. It produces a flamegraph showing the wider horizontal bars (where CPU was spent).
2. You discover that 70% of the cost was spent in an auxiliary sorting routine.
3. You refactor the routine, re-run `soroban-budget-assert` to confirm the regression is gone, and commit with confidence.

