# Debugging Panics & Traps

> How `soroban-cost-profiler` captures execution data right up to the exact instruction of a failure.

---

## Why Standard Profilers Fail on Errors

In traditional profiling systems, profile traces are buffered in memory and serialized upon clean program exit.

However, in smart contracts, execution frequently terminates abruptly due to:
* **Budget Exhaustion (Out-of-Gas):** The contract exceeded the 100M CPU instruction cap or 40MB memory limit.
* **WASM Traps:** An arithmetic overflow, division by zero, or illegal memory access caused the WASM engine to halt.
* **Explicit Contract Panics:** An `assert!`, `panic!`, or `.unwrap()` condition failed.

When a contract fails with out-of-gas, developers need the profile *most*—they need to know which operations burned the budget right before execution crashed.

---

## Graceful Stack Unwinding on Abrupt Halts

`soroban-cost-profiler` does not wait for a clean exit event. Instead, the `ProfileAggregator` maintains an active tree state continuously during execution:

```
Normal Run:            Call ──> Step ──> Step ──> Return  (Clean tree pop)
Abrupt Panic:          Call ──> Step ──> TRAP!            (Halt & Flush)
```

When a WASM trap or host error occurs:
1. The execution tracer catches the VM error code.
2. The current active call stack is frozen in place.
3. The remaining active frames are synthesized with a terminal `[TRAP: BudgetExhausted]` or `[PANIC: OutOfBounds]` label.
4. The incomplete profile tree is immediately serialized and rendered.

---

## The 100M Instruction Infinite Loop Ceiling

If your smart contract contains an infinite loop (e.g., `while true { ... }`), a naive instruction-by-instruction tracer would run forever until the host machine runs out of memory (OOM).

To prevent host system hangs and OOM crashes:

::: warning
**Hard Execution Ceiling:**
`soroban-cost-profiler` enforces a default hard ceiling of **100,000,000 CPU instructions** (the exact Soroban network per-transaction limit).
:::

If this ceiling is breached:
* Tracing immediately halts.
* The profiler flushes the call stack.
* The flamegraph prominently highlights the loop node where instructions were accumulating.

You can customize this ceiling using the `--max-instructions` CLI flag:

```bash
soroban-cost-profiler \
  --wasm target/wasm32-unknown-unknown/profiling/my_contract.wasm \
  --fn test_infinite \
  --max-instructions 20000000 \
  --output runaway.svg
```

