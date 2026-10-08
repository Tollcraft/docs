# Brand & Design Guide

The site is a VitePress app in this repository: theming lives in `src/.vitepress/theme/custom.css` and
`src/.vitepress/config.mts`, not in any hosted space's settings. This page is the spec for those two
files, plus the in-repo conventions that keep pages consistent.

## Visual Identity

High-contrast dark mode with neon accents — built for smart contract developers who live in dark editors.

### Palette

The tokens below are the ones `custom.css` actually defines (the `/* Tollcraft Core Design Tokens */`
block); the tier variables are what colour a tier's cards, pills, and badges take.

| Role               | Token           | Value     |
| ------------------ | --------------- | --------- |
| Background (dark)  | `--void`        | `#07050d` |
| Raised surface     | `--void-2`      | `#0c0a16` |
| Text               | `--paper`       | `#f4f1ff` |
| Primary accent     | `--violet`      | `#8b5cf6` |
| Tier 1 — Prevent   | `--t1` (cyan)   | `#22d3ee` |
| Tier 2 — Detect    | `--t2` (magenta)| `#e879f9` |
| Tier 3 — Diagnose  | `--t3` (amber)  | `#fbbf24` |

### Theme configuration

All of this is code review, not a settings panel:

1. **Appearance:** `config.mts` sets `appearance: 'force-dark'`. Dark is the design; the toggle is off
   deliberately rather than forgotten.
2. **Brand mapping:** `--vp-c-brand-1/2/3` map to `--violet`, `--cyan`, `--magenta`, so links, active nav
   items and container accents all resolve to the palette above.
3. **Fonts:** `--font-display` is _Unbounded_ (headings), `--font-body` _Instrument Sans_, `--font-mono`
   _JetBrains Mono_, loaded from Google Fonts at the top of `custom.css`.
4. **Logo & favicon:** `themeConfig.logo` points at `/favicon.png`, and `config.mts` emits the icon
   `<link>` tags relative to `base` so they resolve under `/docs/` on Pages.
5. **Page layout:** `cleanUrls: true`, local search provider, and the per-tier sidebars under
   `themeConfig.sidebar`.

::: info
Unbounded and Instrument Sans are webfont loads; if the CDN is unreachable the site falls back to
`sans-serif` and the palette plus dark default still carry most of the aesthetic.
:::

## In-Repo Conventions

These keep new pages consistent without any hosted configuration:

* **Custom containers** are VitePress's four, and they carry the accent colours: `danger` for cost
  pitfalls ("Why is this bad?"), `tip` for fixes, `warning` for operational gotchas, `info` for
  cross-references. There is no `success` container — GitBook had one, and the migration to this site did
  not carry it over.
* **One emoji per H1/section header** as a visual marker (⚡ 🔍 🔌 🎨) — one, not several.
* **Code blocks** open with a fence that names the language, and the filename goes in the sentence above
  the block when the reader is meant to create that file.
* **Lint pages** follow the shared template: severity → what it does → why it's bad (`danger`) → `❌ Bad`
  example → suggested fix (`tip`).

## Where the site is built and served

Documentation is a VitePress site in this repository, not a hosted space:

* **Live site:** [https://tollcraft.github.io/docs/](https://tollcraft.github.io/docs/)
* **Source:** `src/` in [Tollcraft/docs](https://github.com/Tollcraft/docs); `src/.vitepress/config.mts`
  holds nav and sidebars, `src/.vitepress/theme/custom.css` holds the palette.
* **Base path:** `config.mts` sets `base = process.env.CI ? '/docs/' : '/'`, so links resolve correctly
  both locally and under the Pages sub-path.
* **Deploy:** a GitHub Actions workflow builds `src/.vitepress/dist` and publishes it to Pages on push to
  `main`. There is no `.gitbook.yaml` and no `SUMMARY.md` — navigation is the `sidebar` object, and a page
  that is not listed there is still built but unreachable from the menu.
* **The old GitBook space** at `tollcraft.gitbook.io/docs` is stale. It still answers HTTP 200, which is
  why links to it survive unnoticed; anything pointing there should point at
  `https://tollcraft.github.io/docs/` with the page's own path.

