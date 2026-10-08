# CLI Tool Reference

> The flags, output formats, subcommands and exit codes `soroban-cost-profiler` 0.1.0 actually
> accepts. Everything on this page is taken from the binary's own `--help` output and from
> `src/main.rs`; the tool writes text artifacts and no SVG.

---

## Command Syntax

```bash
soroban-cost-profiler [OPTIONS] --wasm <WASM>
soroban-cost-profiler [OPTIONS] <COMMAND>
```

Two modes:

- **profile** — `--wasm <contract.wasm> --fn <export>` runs that export under the instrumented
  engine and writes its profile to `--output`, in whatever shape `--format` picks: collapsed stacks
  (the default), a JSON call tree, or the raw event stream.
- **compare** — `compare <base.folded> <new.folded>` reads two profiles already on disk and prints
  the functions whose cost moved, biggest move first. It runs no contract, so it needs no `--wasm`.

---

## Required Arguments

| Option | Shorthand | Description |
| :--- | :--- | :--- |
| `--wasm <PATH>` | `-w` | Path to the compiled WASM contract. Required unless the command is `compare`. |
| `--fn <NAME>` | — | Exported function to invoke, e.g. `--fn call`. Profiling refuses to start without one, and a name the module does not export is an error that lists the exports it does have. |

`--fn` has no shorthand: there is no `-f`. Its default is hidden on purpose, because `[default: ]`
reads like an accepted empty name, and an empty `--fn` is refused at the run, not by the argument
parser.

---

## Configuration Options

| Option | Default | Description |
| :--- | :--- | :--- |
| `--output <PATH>` / `-o` | name follows `--format` | Where to write the artifact. `-` means stdout. Omitted, the file is `profile.folded`, `profile.json` or `profile.raw` to match the format. |
| `--format <FMT>` | `folded` | `folded` (collapsed stacks), `json` (the call tree as structured data), or `raw` (one line per recorded event). |
| `--metric <METRIC>` | `cpu` | The cost unit the counts are written in: `cpu`, `memory`, or `hostcalls`. |
| `--args <LIST>` | none | Arguments for the export, comma-separated: `--args 1000,7`. |
| `--state <PATH>` | none | A Soroban ledger snapshot file to give the contract before it runs. |
| `--sample-rate <N>` | `1000` | Record one trace event every N instructions. Must be greater than 0. |
| `--instruction-limit <N>` | `100000000` | Stop the run after N traced steps. Must be greater than 0. |
| `--verbose` / `-v` | off | Progress on stderr: `-v` stages, `-vv` every call boundary, `-vvv` every costed step. Repeatable. |
| `--quiet` / `-q` | off | Write the artifact and print nothing on stdout. |
| `--help` / `-h` | — | Print help (`-h` gives the summary, `--help` the full page). |
| `--version` / `-V` | — | Print the version. |

### `--output` and stdout

This is the artifact the run leaves behind. For `--format folded`, [speedscope.app](https://www.speedscope.app)
opens it directly and Brendan Gregg's `flamegraph.pl` turns it into a picture, and `compare` reads
files of that same shape. The name defaults to the format because a JSON tree sitting in a file
called `.folded` is a trap for the next command.

`-` is a convention and not a file: the artifact goes to stdout on its own, which is what makes
`--format json --output - | jq` work. The terminal summary then stays silent, because two documents
in one stream parse as neither.

### `--format`

- `folded` — what every other document here describes: one stack per line, cost as the trailing
  number.
- `json` — the same call tree as structured data, carrying the metric and all three cost columns on
  every frame.
- `raw` — the trace before symbolization and folding, one line per recorded event with no names and
  no tree. This is the format to reach for when a profile looks wrong, because it runs no
  symbolization at all.

There is no `svg` format and no `speedscope` format. `--format raw` ignores `--metric`, since a
trace event holds its CPU and memory deltas unselected.

### `--metric`

A `.folded` file records no metric of its own, so two files handed to `compare` must come from runs
that already agreed on this flag. `--format json` carries the metric inside the document, which is
the one thing the folded format cannot do.

### `--args`

A contract's wasm export takes each parameter as an `i64` — the SDK's `Val` is a 64-bit word at that
boundary — so an export declared `(param i64) (param i64)` wants two numbers here, in the order its
signature lists them. The count and the types are checked against that signature before the call, so
a mismatch names the export's real parameters instead of arriving as `wasmi`'s
`encountered an incorrect number of parameters` trap.

Only integers are accepted, and they are handed over as raw `i64` words. That is enough for an
`extern "C"` export taking `u64`/`i64`, and it is nearly enough for an SDK entry point: the real
Soroban host functions are linked, so a word that already carries a `Val` tag is decoded into a live
object handle. What this flag does not do is tag for you — an SDK `u32` parameter wants
`value << 32 | 4` typed out, and the plain number runs until the guest reads a bad tag and traps. An
argument the contract expects to *find* in the ledger rather than receive as a word needs `--state`.

### `--state`

Without this flag the host's ledger is blank in both senses — there is no ledger info at all, and the
storage is an empty enforcing map — so a contract that reads its sequence, timestamp, network ID or
any ledger entry traps before it does any work. The file is the standard snapshot format: the JSON
`soroban ledger json` writes for a network and `Env::to_ledger_snapshot_file` writes for an
integration test, so a state dump taken alongside the contract being profiled can be handed straight
to the profiler.

Ledger info goes in as written, so the five context-free reads of it (`get_ledger_sequence` and
friends) are served from the file. Entries go in as a recording storage over the snapshot. What a
state file cannot supply is the contract frame a host call normally runs inside, so every storage
read from a directly invoked export stops there before it asks.

A snapshot whose `protocol_version` differs from this build's host is refused rather than silently
re-stamped: the cost tables the profile reports are the ones that protocol ships, and pricing a
protocol-21 contract from a protocol-28 table would be a number that lies. This build's host is
**protocol 28** (`soroban-env-host` 28.0.2, and `supported_protocol_version()` reads
`INTERFACE_VERSION.protocol`).

### `--sample-rate` and `--instruction-limit`

`--sample-rate` trades detail for memory: the default records one event per thousand instructions.

`--instruction-limit` is the OOM guard on the trace buffer. Past it the run stops, the trace recorded
up to that point is still written to `--output`, and the exit code is 1 with `Instruction ceiling
exceeded` named as the cause. The default is the bound the profiler has always used, so omitting the
flag changes nothing.

A "step" is a boundary the engine reports, not a wasm instruction — `wasmi` 2.0 has no instruction
hook, so one step stands for everything run since the boundary before it. Raising the limit lets a
heavy contract finish; lowering it stops a runaway run early, but it counts boundaries, so a loop
that never calls anything will not reach it.

### Verbosity

`-v`/`-vv`/`-vvv` print the profiler's internal progress on stderr. `-q` writes the artifact and
prints nothing on stdout. What `-q` keeps, deliberately: the artifact, every `warning:` line about a
degraded run, and every fatal `error:` — quiet means "do not narrate", not "do not report".
`compare`'s table is that mode's whole answer rather than an echo of a file, so it still prints.

There is no `--color` flag and no `NO_COLOR` or `SOROBAN_PROFILER_LOG` environment variable.

---

## Subcommands

### `compare <BASELINE> <CURRENT>`

Print how each function's cost changed between two `.folded` profiles. Both files must have been
produced with the same `--metric`. See
[Diagnosing Regressions](../guides/diagnosing_regressions.md) for the workflow.

### `help`

Print this message or the help of a given subcommand.

---

## Exit Codes

| Code | Meaning |
| :--- | :--- |
| `0` | The run was honoured as asked. A `compare` that reports a regression still exits 0, because bad news is still an answer. |
| `1` | The invocation could not be honoured as asked: a contract that cannot be read, parsed or linked, an export the module does not have, a contract that trapped, a `.folded` file that is missing or malformed, or a refused flag. |
| `2` | The input was accepted and the profiler could not finish its own work: a write the machine refused for a reason other than the path, or an engine that would not configure. |

---

## Examples

```bash
# profile the `call` export
soroban-cost-profiler --wasm target/wasm32-unknown-unknown/release/contract.wasm --fn call

# the same run in memory units, into a named file
soroban-cost-profiler --wasm contract.wasm --fn call --metric memory --output memory.folded

# the call tree as structured data, straight into jq
soroban-cost-profiler --wasm contract.wasm --fn call --format json --output -

# what the engine actually reported: one line per recorded event
soroban-cost-profiler --wasm contract.wasm --fn call --format raw --sample-rate 1

# an export that takes arguments
soroban-cost-profiler --wasm contract.wasm --fn transfer --args 1000,7

# a contract that reads the ledger, against a mocked ledger snapshot
soroban-cost-profiler --wasm contract.wasm --fn read_sequence --state ledger.json

# a denser trace: one event every 100 rather than every 1000
soroban-cost-profiler --wasm contract.wasm --fn call --sample-rate 100

# a heavier contract than the default bound allows
soroban-cost-profiler --wasm contract.wasm --fn call --instruction-limit 200000000

# did the change help?
soroban-cost-profiler compare before.folded after.folded
```

---

## What the tool does not do

- It writes no SVG and renders no flamegraph itself. It emits the collapsed-stack text that
  `flamegraph.pl` and speedscope.app consume; drawing the picture is those tools' job.
- It is not a cargo subcommand. `cargo cost-profiler` does not exist — the artifact is a standalone
  binary. Only the linter (`cargo cost-lint`) and the budget assertions (`cargo budget-report`) run
  as subcommands.
- It names frames from the binary's own DWARF line tables when it has them. A binary built without
  debug info still profiles, and the run says so on stderr instead of pretending its `wasm[pc]`
  frames are source lines.
