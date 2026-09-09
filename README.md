# Tollcraft Documentation Site

This repository contains the unified documentation site for the **Tollcraft** initiative, migrated from GitBook to a dedicated GitHub Pages documentation platform.

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
