# Cross-Contract Calls

> What the profiler does when one contract calls another — and the shape of the trace that results.

::: danger Not traced
`soroban-cost-profiler` traces **one module's one export**. There is no multi-WASM mode: `--wasm` takes exactly one file, and there is no `--extra-wasm` and no `--wasm-dir`. A contract-to-contract call is the one case Tier 3 does not cover, and this page exists so you do not discover that from a flamegraph that quietly omits it.
:::

---

## Why the trace stops at the boundary

Production Soroban hands its dispatch a live engine caller, so a host `call` function can re-enter wasm with a different module's bytes and a different source map. The bindings in `src/host.rs` are generated from `soroban-env-host`'s own x-macro table and call the real `Host` — 199 registrations, the same table the production host builds its linker from — but the `Env` methods that would re-enter wasm run with **no engine caller**. Those two functions return a host error instead of recursing.

A single-module trace never reaches them: the profiler invokes an export from outside a contract call, and the engine reports one boundary pair for that invocation. So the trace has no point at which a second module would come into scope.

---

## What you get instead

The call attempt is still an event. A contract whose export crosses into another contract through the host emits a `HostCall`/`HostReturn` pair like any other host transition, and the frame is named `host[<pc>]`. What you can read out of it:

* **That the boundary happened, and how much the host charged while it was open** — host cost is the budget-measured half of a trace, which makes this the one part of a cross-contract call the profiler reports honestly.
* **Not which contract was called.** The event records the crossing but names no host function, so `host[0]` is the label.
* **Nothing about the callee's internals.** The callee's functions, its line tables, and its own host calls are not in the artifact.

There is no `[router]` / `[pool]` prefix in the output, no per-contract DWARF context, and no contract-ID switching in the source mapper — `SourceMapper` is built from one binary.

---

## How to profile a multi-contract workflow today

The workflow is: profile each contract's entry point separately, then read the host-call counts side by side.

```bash
# One run per contract, one export per run
soroban-cost-profiler --wasm profile-router.wasm --fn execute_swap --metric hostcalls --output router.folded
soroban-cost-profiler --wasm profile-pool.wasm   --fn swap         --metric hostcalls --output pool.folded
soroban-cost-profiler --wasm profile-token.wasm  --fn transfer     --metric hostcalls --output token.folded
```

Then diff each against the previous build, which is where per-contract attribution *is* available:

```bash
soroban-cost-profiler compare router.before.folded router.folded
```

Three caveats that decide whether the numbers are comparable:

* **Arguments are words, not values.** On an SDK build the guest reads a tagged `Val`, so `--args` for an export taking `U32Val(10000)` wants `42949672960004`.
* **Ledger state must be supplied per run.** `--state <snapshot.json>` reads a standard Soroban ledger snapshot — the same JSON `soroban-cli` and `Env::to_ledger_snapshot_file` write — but a profile of a *caller* and a profile of a *callee* against one snapshot will not see the state the caller would have written. Each run starts from the file.
* **Contract-ID-scoped reads still trap.** What no snapshot supplies is the contract frame a host call normally runs inside, so `get_contract_data` and its siblings and `require_auth` stop on an empty stack before reaching the file. A callee that reads its own contract data cannot be profiled this way, and the two refusals (no ledger, no frame) read identically: `HostError: Error(Context, InternalError)`.

---

## What would lift this

Two of the three pieces are the same ones every other limitation traces back to:

| Needed | Status |
| :--- | :--- |
| An engine caller threaded into the re-entering `Env` methods, so a host `call` recurses into wasm | The gap this page is about. The host bindings exist and are generated from the real table, so the recursion is the missing piece rather than the whole machinery. |
| A per-contract `SourceMapper` selected by the active contract ID | Unreachable until the above — a second module never executes, so there is no second address space to index. |
| A program counter at each boundary | Upstream: `wasmi` 2.0's call hook is handed the hook variant and nothing else, so even a single-module trace cannot name a line today. |

Until the first lands, **the flamegraph for a cross-contract transaction is a set of flamegraphs, one per contract**, and any single trace that appears to show a whole swap path is showing you one module and a `host[0]` frame where the hand-off happened.

::: tip For the cost of the whole transaction
Use Tier 2. An integration test that calls through Router → Pool → Token runs inside real contract frames under the network's cost model, so `#[budget_cpu_lt(...)]` and `cargo budget-report` give you the transaction's total — exactly the figure Tier 3 is not built to produce.
:::
