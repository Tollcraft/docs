# Diagnosing Budget Regressions

> A step-by-step tutorial on what to do when a CI budget assertion fails — and what Tier 3 can and cannot tell you about it.

---

## The scenario

Your team maintains an AMM contract. A pull request adds a multi-asset swap feature, the tests pass functionally, and Tier 2 stops the build:

```text
failures:
    test_swap_multi
assertion failed: CPU budget
  test_swap_multi: measured 4_892_100 instructions, budget asserted 2_500_000
```

::: info Where that number comes from
`4,892,100` is illustrative — it is the shape of a `#[budget_cpu_lt(...)]` failure, not a measurement from this repository. The **real** figures a budget assertion produces come from `cargo budget-report`, and they are network-metered instructions. That is the whole division of labour between the two tiers, and this guide is about not confusing them.
:::

Two questions follow, and they have different answers:

| Question | Tool | Why |
| :--- | :--- | :--- |
| *How much* did it cost, and did it exceed the cap? | Tier 2 `soroban-budget-assert` | It reads the same cost tables the network charges from. |
| *Which function* moved, between the before and after build? | Tier 3 `soroban-cost-profiler compare` | It diffs two profile artifacts and names the functions whose cost changed. |
| *Which line* of the contract is responsible? | **Neither, today** | See [what the trace can name](#4-know-what-you-are-looking-at). |

---

## 1. Get the failing build and the passing build side by side

The regression diagnosis works on two `.folded` artifacts, one per commit, so you need both binaries.

In your contract's `Cargo.toml`:

```toml
[profile.profiling]
inherits = "release"
debug = "line-tables-only"
```

Keep `debug` out of `[profile.release]` — that is the profile whose output gets deployed, and mainnet bills for the extra bytes. Then build the PR's contract and its merge base:

```bash
# On the PR branch
cargo build --target wasm32-unknown-unknown --profile profiling
cp target/wasm32-unknown-unknown/profiling/amm_pool.wasm /tmp/after.wasm

# On the merge base
git switch --detach origin/main
cargo build --target wasm32-unknown-unknown --profile profiling
cp target/wasm32-unknown-unknown/profiling/amm_pool.wasm /tmp/before.wasm
```

---

## 2. Profile the same export from both builds

One export per run, and the same arguments on both sides or the diff means nothing:

```bash
soroban-cost-profiler \
  --wasm /tmp/before.wasm \
  --fn swap \
  --args 42949672960004 \
  --metric memory \
  --output before.folded

soroban-cost-profiler \
  --wasm /tmp/after.wasm \
  --fn swap \
  --args 42949672960004 \
  --metric memory \
  --output after.folded
```

::: warning Both sides must agree on `--metric`
A `.folded` file records no metric. Hand `compare` a CPU run and a memory run and nothing detects it — the table will be a correct diff of two incompatible numbers. Use `--format json` when you want the artifact to name its own units; `compare` reads folded text, so the JSON pair is for a script, not for this command.
:::

::: tip `--args` takes words, not numbers
`42949672960004` is `U32Val(10000)` — `(10000 << 32) | 4`. On a `soroban-sdk` build the guest reads a tagged `Val`, so a plain `10000` passes the arity check and then traps mid-run. The profiler checks the count against the module's signature before it calls anything, so a wrong *count* is a refused command line that writes no artifact; a wrong *tag* is a trap with a partial trace beside it.
:::

---

## 3. Diff them

```bash
soroban-cost-profiler compare before.folded after.folded
```

The output shape, on the sample pair a before/after change would produce:

```text
Cost comparison, baseline → current (exclusive cost per function):
 caller_of_heavy    1512612  1200000  -312612
 legacy_pack          79210        0   -79210
 memory_heavy_loop   448512   500001   +51489
 packed_reader            0    12000   +12000
 total              2040334  1712001  -328333
4 of 4 functions changed cost, 0 unchanged
```

Read it as three things:

* **Per function, not per stack.** The question is "did my change make this cheaper", and a stack-level diff would make you sum lines yourself.
* **Both raw counts beside the move.** `+51489` alone cannot say whether that is noise on a 1.5-million loop or the whole of a small function.
* **A function present on one side only is a row against `0`**, not an absence — `legacy_pack` disappeared and `packed_reader` is new. Functions that did not move are left out of the table but counted in the last line, so an empty table cannot be mistaken for a broken one.

Regressions print red and improvements green **only when the output is a terminal**, so piping into a file or `grep` stays plain text. Exit code is `0` even when the news is bad: a `compare` that reports a regression has answered, not failed.

---

## 4. Know what you are looking at

This is the part a regression report makes dangerous. Before you act on the table:

::: danger A profile is a floor and a shape, not a budget reading
`wasmi` 2.0 exposes a call hook and no instruction hook, so what the tracer charges is one synthetic unit per **boundary**, and the only accurate numbers in a trace come from the host budget read around a host call. Two consequences for a regression review:
>
> * A pure-compute regression — a heavier loop, an extra `u128` multiply — can produce an **identical** artifact on both sides. The table reads `0 changed`, and the contract got twice as expensive.
> * A storage-write regression *does* show, because each write crosses into the host and host cost is budget-measured. `memory_heavy_loop` at 100 iterations measures `host[0] 125022` in CPU, `50080` in memory and `102` host calls.
>
> So `compare` finding nothing is not the same as the change being free. The budget assertion that failed in CI is the authority on how much; this is a look at *where*.
:::

::: warning Frames are named `wasm[0]` and `host[0]`, not `src/amm_pool.rs:184`
The call hook is handed the hook *variant* and nothing else — no callee, no offset — so every event is recorded at `pc = 0`, and a run collapses into one `wasm[0]` frame. Host frames carry the crossing but name no host function, so they read `host[<pc>]`. Source mapping is built and tested underneath (`CodeMap` indexes the code-section body-start space, `tests/source_map_fixture.rs` checks resolved addresses against the source text they came from), but today the trace never asks for anything but `0`.

**No flamegraph in this pipeline will point at line 184.** When the engine gains an address per boundary, the `file:line` half is already correct; until then the honest read is "the host transitions moved", not "this line moved".
:::

---

## 5. What to do with a host-call regression

Where the table *does* show movement — host calls — the useful next step is the metric axis, not a picture:

```bash
soroban-cost-profiler compare before.folded after.folded
# re-run both sides with --metric hostcalls: the count is the clearest signal
```

Host-call **count** is the least ambiguous thing this tool reports. On the fixture, 100 iterations of a vector loop produce exactly 102 calls: `vec_new` + 100 × `vec_push_back` + `vec_len`. If a refactor takes a loop from N host calls to 1 host call, the count says so even while the frame is still named `host[0]`.

That is the pattern Tier 1 was written to catch before a test ever runs:

```bash
cargo cost-lint
```

```text
error: storage operations inside a loop
  --> src/amm_pool.rs
   = note: [SOROBAN_STORAGE_IN_LOOP] is the driver's one Deny-level lint
```

---

## 6. Re-verify

The loop that wrote to instance storage once per iteration is the usual culprit, and batching it into a `Map` and one write per key is the usual fix. Then close the loop in the right order:

1. `cargo cost-lint` — the pattern is gone, not just the count.
2. `soroban-cost-profiler compare` against the pre-fix artifact — the host-call count moved the way you expect.
3. `cargo test` with `soroban-budget-assert` — the **budget assertion is the gate**. It is the tier that reads network cost, and "the profile improved" is not a substitute for "the assertion passes".

```bash
soroban-cost-profiler compare before.folded fixed.folded
```

A differential *picture* is available if you want one: `OutputFormatter::to_differential_folded` writes the `<stack> <baseline> <current>` form `flamegraph.pl --diff` shades red and blue. That is a library call today, not a CLI flag — the command line's way to look at two runs is the table above.
