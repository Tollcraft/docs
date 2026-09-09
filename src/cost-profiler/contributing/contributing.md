# Contributing

> Guidelines for reporting issues, contributing code, and submitting pull requests.

---

## Welcome to Tollcraft

We welcome contributions across all areas of the `soroban-cost-profiler` project, including:
* WASM execution tracing and interpreter hooks.
* DWARF symbol parsing and address translation.
* Visual output formatters and speedscope integration.
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
4. **Ensure Tests Pass:** Run all tests locally before opening a pull request:
   ```bash
   cargo fmt --check
   cargo clippy --all-targets -- -D warnings
   cargo test
   ```
5. **Open a Pull Request:** Open your PR against the `main` branch of `Tollcraft/soroban-cost-profiler`. Include context explaining the problem, the solution, and test verification results.

---

## Documentation Standards

When adding or updating documentation:
* Follow the standard GitBook Markdown formatting guidelines.
* Preserve consistent headings, callout boxes (``), and tables.
* Keep explanations accessible to smart contract developers while preserving technical precision.

