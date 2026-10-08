# Debugging Panics & Traps

> What `soroban-cost-profiler` keeps, prints, and exits with when an execution does not return.

---

## Why this matters more for contracts

In a traditional profiler, traces are buffered in memory and serialized on clean program exit. Smart contract execution regularly does not exit cleanly:

* **Budget exhaustion** — the run exceeded a per-transaction network cap.
* **WASM traps** — arithmetic overflow, an `unreachable` instruction, a bad memory access.
* **Explicit panics** — an `assert!`, `panic!`, or `.unwrap()` in the contract.

The profile is most valuable exactly when the contract failed, so the rule this tool follows is narrow and firm:

::: tip A contract that traps keeps the trace it collected and still exits `1`
The contract failed; the profiler did not. Both facts are reported, in different places: the artifact is the file, the failure is the message and the exit code.
:::

---

## What actually happens

There is no stack-unwinding pass that labels the open frames. What happens is simpler and worth stating precisely:

1. Events accumulate in the tracer as execution proceeds — call boundaries, sampled steps, host entry/exit snapshots.
2. The engine returns an error instead of a normal return.
3. The events collected **up to that point** are flushed through aggregation and written to the artifact path you gave.
4. `error: …` goes to stderr and the process exits `1`.

That is the whole mechanism. Consequences a reader needs:

* **The trace is one level deep, because the engine reports one boundary pair for the host-initiated call.** `wasmi` 2.0's call hook fires for the call *into* wasm, not for calls made from inside running wasm. So the partial trace is a partial record of what was never a deep record to begin with — not a truncation you can read downward into.
* **Costs in it are incomplete "because the call never returned"** — the literal wording of the message. A host frame opened but not closed has no budget diff charged to it, since `record_host_return` is where the diff happens.

The measured transcript, a `--args` value the guest could not read as a `Val`:

```console
$ soroban-cost-profiler --wasm …/dummy_contract.wasm --fn compute_heavy_loop --args 10000 --output out.folded
error: 'compute_heavy_loop' trapped: wasm `unreachable` instruction executed. The partial trace up to the
trap is in out.folded, and its costs are incomplete because the call never returned.
$ echo $?
1
```

A host function that needed chain state it did not have:

```console
error: 'read_sequence' trapped: host function 'x.3' failed: HostError: Error(Context, InternalError)
DebugInfo not available
. The partial trace up to the trap is in blank.folded, and its costs are incomplete because the call never returned.
```

::: info `DebugInfo not available` is the host's sentence
The detail that would print after it is built only with `soroban-env-host`'s `testutils` feature, which this crate deliberately does not enable — that feature pulls `arbitrary` into the dependency tree. So `Error(Context, InternalError)` is all a refusal says, and the two common refusals (no ledger, no contract frame) read identically from a terminal.
:::

---

## Reading the artifact of a failed run

::: warning The file is not evidence that the run halted
On a fixture run halted by the instruction ceiling, `halted.folded` holds:

```text
wasm[0] 0
```

— byte-for-byte what a **completed** run of the same export writes. The guard trips while the call unwinds and `wasmi` still reports `ReturningFromWasm`, so the artifact cannot distinguish the two. Only the exit code and the `error:` line do. Never read the `.folded` file alone as "the call finished".
:::

Check, in this order:

| Signal | Says |
| :--- | :--- |
| exit code | `0` honoured as asked, `1` the invocation could not be honoured (including a trap), `2` the profiler could not finish its own work |
| `error:` on stderr | what the engine reported, quoted with its own wording |
| the artifact | the trace up to the failure — same text as a clean run, possibly identical bytes |
| `-v` on stderr | which stage was entered, and where it stopped |

---

## The instruction ceiling, and what it does not stop

`--instruction-limit` (default **100,000,000**) bounds the trace buffer. When it trips it comes through the trap path, so the message has a trap's shape:

```console
$ soroban-cost-profiler --wasm fixtures/dwarf_probe/dwarf_probe.wasm --fn caller_of_heavy \
    --output halted.folded --instruction-limit 1
error: 'caller_of_heavy' trapped: Instruction ceiling exceeded. The partial trace up to the trap is in
halted.folded, and its costs are incomplete because the call never returned.
$ echo $?
1
```

Measured on that command; `--instruction-limit 2` on the same fixture exits `0`.

::: danger The ceiling cannot see an infinite loop
The counter advances **per boundary, not per instruction** — its only caller in the live path is the call hook, and one host-initiated call gives two boundaries. That is why `1` halts a function that computes a million instructions and `2` lets it finish.

A contract that loops forever *inside* one function body emits no boundaries, never advances the counter, and is not stopped. `wasmi`'s own fuel is set to `u64::MAX` for the run, so the engine does not stop it either.

The guard is real for the thing it was written to protect — a run with many boundaries cannot grow the event `Vec` unboundedly — and inert against a compute-only runaway loop. A ceiling that also halts execution needs an instruction hook, and `wasmi` 2.0 has none to expose. **No open issue in this repository owns that gap; it is the engine's, and every other limitation here traces back to it.**
:::

So if your symptom is "it hangs" or "my machine ran out of memory", the ceiling message is not the diagnosis and `--instruction-limit` is not the lever. Profile exports that terminate, and prefer the fixture-sized contracts the repository tests against.

---

## Traps that are really input errors

Some failures look like contract bugs and are command-line bugs. The profiler tries to refuse these **before** calling anything, so no artifact is written:

```console
$ soroban-cost-profiler --wasm needs_arg.wasm --fn needs_arg --output out.folded
error: 'needs_arg' takes 1 argument (i64); --args gave no values. `--args` is one value per parameter, in
the order the signature lists them.
$ echo $?
1
$ ls out.folded
ls: out.folded: No such file or directory
```

Before that check existed, the same command line produced a *trap* — `encountered an incorrect number of parameters`, exit `1`, and an `out.folded` beside it. A profile of a call that was never legal is the worst artifact this tool can write, which is why it is now an input error.

The check reads the module's signature, so it catches a wrong **count** and a wrong **width** (`'needs_i32' takes 1 argument (i32), and --args supplies i64 values only`) but not a wrong **tag**. On an SDK build the guest reads a tagged `Val`, so `--args 10000` for a `U32Val(10000)` parameter passes the check and then traps mid-run. The two differ in whether a file appears.

Full catalogue: [Troubleshooting](https://github.com/Tollcraft/soroban-cost-profiler/blob/main/docs/troubleshooting.md) in the profiler repository.
