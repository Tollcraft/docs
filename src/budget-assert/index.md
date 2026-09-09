# Budget Assert Overview

<span class="tier-pill t2">Tier 2 • Detect</span>

> **Empirical runtime cost enforcement for Soroban smart contracts** — simulate invocations against live network metering inside `cargo test` and gate pull requests against resource regressions.

Part of the **Tollcraft** initiative:
* **Tier 1: Prevent** — [Cost Linter](/cost-linter/): Catch structurally expensive anti-patterns before compilation.
* **Tier 2: Detect** — [Budget Assert](index.md): Measure network-simulated costs and enforce budgets in CI.
* **Tier 3: Diagnose** — [Cost Profiler](/cost-profiler/): Trace execution and generate visual flamegraphs down to Rust lines.

---

## The Divergence Problem

`soroban-budget-assert` solves a critical failure mode in Soroban smart contract engineering: **local resource estimates do not match real network costs**, and the error can point in either direction.

Measured on an example contract (`do_expensive_work(10_000)`):

<div class="divergence-box">
  <div class="divergence-title">
    Empirical Resource Divergence vs. Network Truth
  </div>
  <div class="divergence-grid">
    <div class="divergence-item">
      <div class="divergence-label">RAW RUST TEST</div>
      <div class="divergence-val under">-81%</div>
      <div class="divergence-note">143,887 inst. (Dangerously under-estimates CPU!)</div>
    </div>
    <div class="divergence-item">
      <div class="divergence-label">SIZE-OPT WASM</div>
      <div class="divergence-val over">+19%</div>
      <div class="divergence-note">901,816 inst. (Over-provisions against phantom costs)</div>
    </div>
    <div class="divergence-item">
      <div class="divergence-label">TESTNET GROUND TRUTH</div>
      <div class="divergence-val truth">756,678</div>
      <div class="divergence-note">Exact Protocol 22 Network Simulation</div>
    </div>
  </div>
</div>

::: warning The only trustworthy number is a live network simulation
A developer who trusts local numbers either deploys a contract that exhausts its budget on the public network, or over-provisions against costs that aren't real. Both mistakes come from the same root cause: mock environments do not execute the exact Stellar Core metering VM.
:::

---

## The Solution: Two-Tier Verification

`soroban-budget-assert` gives you the best of both worlds:

1. **Tier A (Local Fast Assertions):** Deterministic test assertions via `#[budget_cpu_lt(N)]` that run in milliseconds in your normal `cargo test` suite.
2. **Tier B (Network-Verified CI Gating):** `cargo budget-report` deploys the exact compiled WASM to a test network, simulates RPC invocations, and fails CI on any regression beyond a configured tolerance threshold.

```bash
# Check your workspace against budget limits
cargo budget-report --check --network testnet
```

---

## Documentation Navigation

::: info Getting Started
To wire assertions into your test suite, start with the [**End-User Guide**](user_guide.md). To set up automated CI budget gating, see the [**CI/CD Integration Guide**](ci_cd_integration.md).
:::

* [**End-User Guide**](user_guide.md) — Step-by-step walkthrough of macros, baseline snapshots, and commands
* [**Complete CLI & Config Reference**](reference.md) — All flags, `budget.toml` schema, and environment variables
* [**Deriving Limits**](deriving_limits.md) — How to calculate safe Tier A local limits from Tier B network measurements
* [**CI/CD Integration Guide**](ci_cd_integration.md) — GitHub Actions workflow and PR summary generation
* [**Testnet Troubleshooting**](testnet_troubleshooting.md) — Handling RPC timeouts, sequence numbers, and funding
* [**Developer Guide**](developer_guide.md) — Architecture, internals, and building from source
