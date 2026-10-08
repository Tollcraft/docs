# Tollcraft Documentation Site

This repository contains the unified documentation site for the **Tollcraft** initiative, migrated from
GitBook to a dedicated GitHub Pages documentation platform. It is live at
**[https://tollcraft.github.io/docs/](https://tollcraft.github.io/docs/)**.

Each tier is one tool, and each has its own repository:

| Tier | Tool | What it is | Repository |
| :--- | :--- | :--- | :--- |
| 1 — Prevent | `soroban-cost-linter` | A Dylint lint library (`soroban_cost_lints`, 40 Soroban HIR lints) plus the `cargo cost-lint` driver | [Tollcraft/soroban-cost-linter](https://github.com/Tollcraft/soroban-cost-linter) |
| 2 — Detect | `soroban-budget-assert` | `budget-macros` (`#[budget_cpu_lt(N)]` and siblings) plus the `cargo budget-report` simulator/CI reporter | [Tollcraft/soroban-budget-assert](https://github.com/Tollcraft/soroban-budget-assert) |
| 3 — Diagnose | `soroban-cost-profiler` | A standalone binary: runs one wasm export under `wasmi` 2.0 + `soroban-env-host` 28, symbolizes frames via DWARF, writes `.folded` / `.json` / `.raw` | [Tollcraft/soroban-cost-profiler](https://github.com/Tollcraft/soroban-cost-profiler) |

Pages under `src/` mirror each repository's own documentation. Where the two disagree, the repository is
the source of truth and this site is the one that needs the fix.

## Structure

* **Tier 1 (Prevent):** `src/cost-linter/` — Documentation for [`soroban-cost-linter`](https://github.com/Tollcraft/soroban-cost-linter).
* **Tier 2 (Detect):** `src/budget-assert/` — Documentation for [`soroban-budget-assert`](https://github.com/Tollcraft/soroban-budget-assert).
* **Tier 3 (Diagnose):** `src/cost-profiler/` — Documentation for [`soroban-cost-profiler`](https://github.com/Tollcraft/soroban-cost-profiler).

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run docs:dev

# Build for production
npm run docs:build

# Preview production build
npm run docs:preview
```

## Deployment

The documentation site is automatically built and deployed to GitHub Pages on push to `main` via `.github/workflows/deploy.yml`.
