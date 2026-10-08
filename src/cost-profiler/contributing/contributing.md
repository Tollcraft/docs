# Contributing

> Guidelines for reporting issues, contributing code, and submitting pull requests.

---

## Welcome to Tollcraft

We welcome contributions across all areas of the `soroban-cost-profiler` project, including:
* WASM execution tracing and interpreter hooks.
* DWARF symbol parsing and address translation.
* Output formats and the artifact's fidelity to what the engine reported.
* Documentation, guides, and reproducible contract benchmarks.

---

## Getting Started

1. **Browse Open Issues:** Check the [GitHub Issues](https://github.com/Tollcraft/soroban-cost-profiler/issues) page. Look for labels like `good first issue` or `help wanted`.
2. **Join the Community:** Discuss ideas with maintainers in the [Tollcraft Discord](https://discord.gg/5aprtMSyR) or [Telegram](https://t.me/+Gflo5jZStw1jMjE0).

---

## Pull Request Workflow

1. **Fork the Repository:** Create a personal fork on GitHub.
2. **Create a Feature Branch:** Branch from `main`:
   ```bash
   git checkout -b feat/my-enhancement
   ```
3. **Make Atomic Commits:** Write clear, descriptive commit messages following the Conventional Commits specification (`feat:`, `fix:`, `docs:`, `perf:`).
4. **Ensure Tests Pass:** Run the same checks CI runs, locally, before opening a pull request:
   ```bash
   cargo fmt --all -- --check
   cargo clippy --workspace --all-targets -- -D warnings
   cargo test --workspace
   ```
5. **Open a Pull Request:** Open your PR against the `main` branch of `Tollcraft/soroban-cost-profiler`.
   `main` is protected by a repository ruleset, so a direct `git push origin main` is refused with `GH013`
   even for users with admin — the pull request is the only way in, from a fork or a branch. Include context
   explaining the problem, the solution, and the verification you actually ran, and land the `ROADMAP.md`
   box for the issue in the same branch.

---

## Documentation Standards

Documentation for this project lives in two places, and they are not the same file format:

* **In the repository** (`docs/`, module docs, `README.md`): CommonMark as `rustfmt` leaves it, tables,
  fenced code, and `> [!NOTE]` / `> [!WARNING]` / `> [!CAUTION]` callouts — the GitHub-flavoured ones,
  because that is where the pages are read.
* **On the site** ([Tollcraft/docs](https://github.com/Tollcraft/docs)): VitePress markdown, where the
  callout syntax is `::: tip` / `::: warning` / `::: danger` / `::: info`. GitBook's `success` block and
  its file-title blocks did not survive the migration; use `tip` and a sentence above the fence.

Either way:

* Headings nest without gaps, and every page opens with a one-sentence statement of what it is for.
* **A number in a document is a measured number.** An instruction count, a byte count or a percentage
  names the fixture and the command line that produced it, or it does not appear. This is rule 6 of
  `AGENTS.md`, and it is the reason the docs quote transcripts rather than illustrations.
* Keep explanations accessible to smart contract developers while preserving technical precision.

