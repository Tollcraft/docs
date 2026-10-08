# Tollcraft Cost Pipeline

> How Cost Profiler fits into the unified Tollcraft smart contract cost-awareness suite.

---

## Three Tiers of Cost Awareness

Writing cost-effective smart contracts requires a multi-stage approach. In Soroban, cost regressions are not syntax errors — they compile cleanly, pass unit tests, and silently increase user fees or fail with out-of-gas errors in production.

Tollcraft addresses this across three progressive development phases:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. PREVENT: soroban-cost-linter                                        │
│ Static analysis in rustc / Dylint — catches bad patterns at build time │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ passes checks
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. DETECT: soroban-budget-assert                                       │
│ Budget assertions in cargo test — exact network-metered cost per call  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ budget violated!
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. DIAGNOSE: soroban-cost-profiler                                     │
│ Execution tracing & source mapping — says which frame the host charged │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Comparison Matrix

| Capability | Tier 1: `soroban-cost-linter` | Tier 2: `soroban-budget-assert` | Tier 3: `soroban-cost-profiler` |
| :--- | :--- | :--- | :--- |
| **Primary Goal** | Prevent anti-patterns | Enforce budget boundaries | Locate the frame the host charged |
| **How it runs** | `cargo cost-lint` (Dylint driver) | `#[budget_*_lt]` macros in `cargo test` | Standalone `soroban-cost-profiler` binary |
| **Execution Point** | `cargo check` / compile-time | `cargo test` / CI pipeline | On-demand / diagnostic runs |
| **Methodology** | AST / HIR static analysis | Real host execution under the network's cost model | `wasmi` 2.0 with the host's budget read at boundaries, plus DWARF symbolization |
| **Metric** | Structural code patterns | CPU instructions, memory bytes, ledger read/write bytes, events, ledger entries | CPU, memory, host-call count, per frame |
| **Input sensitivity** | None (input-independent) | High (measures real inputs) | High (runs the export), but one export per run |
| **Output** | Compiler diagnostics, 40 registered lints | Pass/fail plus `cargo budget-report` tables | `.folded` / `.json` / `.raw` text plus a ranked summary |
| **Cost figures mean network fees?** | No | **Yes** | No — see the warning below |

::: warning Tier 3's numbers are not what the network charges
The engine gives the tracer a call hook and no instruction hook, so WASM-side cost is one synthetic unit per boundary and the accurate half of a trace is the **host budget** read around a host call. A profile is a floor and a shape: it says which frames the host charged, not how many instructions mainnet will bill. For that, Tier 2 is the instrument — which is why the pipeline's last arrow points *from* a failed budget assertion *to* the profiler rather than the other way round.
:::

::: info The three tiers do not share a protocol version
Tier 2 targets `soroban-sdk` 27.0.3 / `stellar-xdr` 27.0.0 (Protocol 27). Tier 3's profiler builds against `soroban-env-host` 28.0.2 (Protocol 28). Cost tables differ between protocols, so the two tiers can genuinely disagree about the same contract. `--state` refuses a ledger snapshot that declares any protocol other than 28 rather than silently re-stamping it.
:::

---

## The Workflow in Practice

### Step 1: Write and lint
As you write contract logic, `soroban-cost-linter` flags structural problems before you run a single test — 40 registered lints, of which `SOROBAN_STORAGE_IN_LOOP` ("storage operations inside a loop") is the driver's one Deny-level rule:

```bash
cargo cost-lint
```

### Step 2: Test and enforce
Once the patterns are resolved, `soroban-budget-assert` runs your contract under the real host's cost model and asserts a ceiling per call:

```rust
// Fails the test if this invocation exceeds 1,500,000 CPU instructions
#[budget_cpu_lt(1_500_000)]
fn test_liquidity_provision() {
    // contract setup and invocation
}
```

### Step 3: Profile when a budget assertion fails
The profiler is the *diagnosis* step, and diagnosis has one honest shape today:

1. Build the merge base and the PR, profile the **same export with the same `--args`** on both, and `compare` the two `.folded` files.
2. Read the table for host-call movement: an extra storage write or a loop that got more rounds shows up as a changed `host[…]` cost and a changed host-call count, because those are budget-measured. A pure-compute regression can leave the artifact byte-identical.
3. Expect `wasm[0]` and `host[0]` frame names. Source mapping is complete and tested underneath it, but the engine reports no program counter, so no run points at a line number yet.
4. Re-run `cargo test` — the budget assertion is the gate, not the profile.

[Diagnosing Budget Regressions](../guides/diagnosing_regressions.md) walks that through end to end, and [Reading & Visualizing Profiles](../guides/flamegraphs.md) covers what the artifact does and does not show.

---

## Where each tier is strongest

* **Tier 1** catches the pattern in the source, cheaply, before anything runs. It is input-independent, so it cannot be fooled by an untested code path — and cannot price one either.
* **Tier 2** is the only tier whose numbers are the numbers the network will bill. It belongs in CI as a gate.
* **Tier 3** is the only tier that says *where*. Today the strongest version of that answer is host-call attribution: which frame was open while the host spent the budget, and how many times it was entered.
