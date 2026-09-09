# Handling Cross-Contract Calls

> Tracing multi-contract workflows and resolving dynamic DWARF symbol mappings.

---

## The Cross-Contract Challenge

Complex DeFi protocols on Stellar rarely consist of a single smart contract. A swap transaction may invoke:
1. A Router contract (`Router.wasm`)
2. A Factory contract (`Factory.wasm`)
3. One or more Liquidity Pool contracts (`Pool.wasm`)
4. A Token contract (`Token.wasm`)

When Contract A invokes Contract B, the Soroban Host suspends Contract A's WASM engine, spins up or switches to Contract B's WASM instance, and transfers execution.

If the profiler naively used Contract A's DWARF line tables for Contract B's execution:
* Instruction offsets from Contract B would map to completely random, nonsensical lines in Contract A's source code.
* The flamegraph would be corrupt and misleading.

---

## Dynamic DWARF Context Switching

`soroban-cost-profiler` tracks the active `ContractID` throughout the execution trace:

```
[TraceEvent] Active Contract: CA3D... (Router)
  PC 0x0124 -> resolved via Router.wasm DWARF (router.rs:45)
  Call: call_contract(Pool)
    │
    ▼ Switch Active Context: CB9F... (Pool)
    PC 0x008a -> resolved via Pool.wasm DWARF (pool.rs:112)
    Return
    │
    ▼ Restore Active Context: CA3D... (Router)
  PC 0x0138 -> resolved via Router.wasm DWARF (router.rs:48)
```

---

## Configuring Multi-WASM Profiling

When profiling an integration test or multi-contract setup, pass the contract directory or multiple WASM artifacts via the CLI:

```bash
soroban-cost-profiler \
  --wasm target/wasm32-unknown-unknown/profiling/router.wasm \
  --extra-wasm target/wasm32-unknown-unknown/profiling/pool.wasm \
  --extra-wasm target/wasm32-unknown-unknown/profiling/token.wasm \
  --fn execute_swap \
  --output cross_contract_profile.svg
```

Alternatively, specify a directory containing all compiled profiling WASM artifacts:

```bash
soroban-cost-profiler \
  --wasm-dir target/wasm32-unknown-unknown/profiling/ \
  --fn execute_swap \
  --output cross_contract_profile.svg
```

The source mapper indexes the DWARF sections of each binary and indexes them by their respective bytecode hash and contract identifier.

---

## Distinguishing Contracts in the Flamegraph

In the generated flamegraph, cross-contract calls are visually prefixed with the contract identity:

```text
root
└─ [router] swap_exact_tokens_for_tokens (src/router.rs:32)
   └─ [pool] swap (src/pool.rs:88)
      ├─ [token] transfer (src/token.rs:54)
      └─ [pool] update_reserves (src/pool.rs:120)
```

This allows immediate visibility into which external dependencies or protocols are contributing to your gas budget.

