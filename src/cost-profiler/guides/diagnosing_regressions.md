# Diagnosing Budget Regressions

> A step-by-step tutorial on diagnosing and fixing a contract that failed a CI budget assertion.

---

## Scenario: CI Fails on Budget Regression

Imagine your team maintains an automated market maker (AMM) contract on Soroban. A developer submits a pull request adding a multi-asset swap feature.

In CI, `soroban-budget-assert` fails with the following report:

```
Error: BudgetAssertionFailure
Function: swap_tokens_multi
  Measured CPU Instructions: 4,892,100
  Budget Limit (CI cap):     2,500,000
  Difference:                +2,392,100 (+95.6% OVER BUDGET)
```

The test passed functionally, but transaction execution will be nearly double the fee limit set for this contract. How do we find the culprit?

---

## Step 1: Compile with the Profiling Profile

Ensure your contract workspace has the profiling profile in `Cargo.toml`:

```toml
[profile.profiling]
inherits = "release"
debug = "line-tables-only"
```

Compile the contract:

```bash
cargo build --target wasm32-unknown-unknown --profile profiling
```

---

## Step 2: Trace the Failing Invocation

Run `soroban-cost-profiler` against the compiled WASM binary:

```bash
soroban-cost-profiler \
  --wasm target/wasm32-unknown-unknown/profiling/amm_pool.wasm \
  --fn swap_tokens_multi \
  --output swap_profile.svg
```

The CLI will trace execution and write `swap_profile.svg`.

---

## Step 3: Read the Flamegraph

Open `swap_profile.svg` in your browser:

```
┌────────────────────────────────────────────────────────────────────────┐
│ swap_tokens_multi (4,892,100 instructions)                             │
├──────────────────────────────────────┬─────────────────────────────────┤
│ execute_path (1,210,000)             │ update_reserves_batch (3,650,000)│
│                                      ├─────────────────────────────────┤
│                                      │ instance().set (3,400,000)      │
│                                      │ [amm_pool.rs:184]               │
└──────────────────────────────────────┴─────────────────────────────────┘
```

Notice immediately:
* `execute_path` (the math calculation) took only 1,210,000 instructions (24.7% of total cost).
* `update_reserves_batch` burned 3,650,000 instructions (74.6% of total cost).
* The widest block in `update_reserves_batch` is `instance().set` at line 184 in `src/amm_pool.rs`.

---

## Step 4: Inspect the Code

Looking at `src/amm_pool.rs:184`:

```rust
// Inefficient pattern: writing back to storage on each pool iteration
for pool in pools.iter() {
    let mut state = env.storage().instance().get(&pool.id).unwrap();
    state.reserve_a += pool.delta_a;
    state.reserve_b += pool.delta_b;
    env.storage().instance().set(&pool.id, &state); // <-- LINE 184
}
```

The code was performing an `instance().set()` write on every iteration of the loop! Each call serializes data, increments the ledger write count, and incurs host dispatch overhead.

---

## Step 5: Refactor and Re-verify

Refactor the loop to aggregate updates in memory and write to storage once:

```rust
// Optimized: aggregate state changes in memory before committing to storage
let mut states: Map<PoolId, PoolState> = Map::new(&env);
for pool in pools.iter() {
    let mut state = states.get(pool.id).unwrap_or_else(|| env.storage().instance().get(&pool.id).unwrap());
    state.reserve_a += pool.delta_a;
    state.reserve_b += pool.delta_b;
    states.set(pool.id, state);
}
for (pool_id, final_state) in states.iter() {
    env.storage().instance().set(&pool_id, &final_state);
}
```

Re-run `soroban-cost-profiler`:
* New CPU instructions: **1,720,000** (down from 4,892,100).
* Re-run `cargo test` with `soroban-budget-assert`: CI passes cleanly under the 2,500,000 ceiling!

