import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Tollcraft',
  description: 'Soroban Smart Contract Cost Awareness Pipeline',
  base: process.env.BASE_URL || (process.env.CI ? '/docs/' : '/'),
  ignoreDeadLinks: true,
  srcDir: '.',
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#07050d' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Tollcraft — Soroban Cost Awareness' }],
    ['meta', { property: 'og:description', content: 'A three-tier cost pipeline for Stellar smart contracts. Lint at compile time, assert at test time, profile when the budget fails.' }]
  ],
  themeConfig: {
    logo: undefined,
    siteTitle: 'Tollcraft',
    search: {
      provider: 'local'
    },
    nav: [
      { text: 'Home', link: '/' },
      { text: '🛡️ Cost Linter', link: '/cost-linter/' },
      { text: '🧪 Budget Assert', link: '/budget-assert/' },
      { text: '🔥 Cost Profiler', link: '/cost-profiler/' },
      {
        text: 'Ecosystem',
        items: [
          { text: 'Tollcraft GitHub', link: 'https://github.com/Tollcraft' },
          { text: 'Interactive Playground', link: 'https://tollcraft.github.io/soroban-cost-profiler/' },
          { text: 'Stellar Developers', link: 'https://developers.stellar.org' }
        ]
      }
    ],
    sidebar: {
      '/cost-linter/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Overview', link: '/cost-linter/' },
            { text: 'Cost Rationale', link: '/cost-linter/cost_rationale' },
            { text: 'Lint Categories', link: '/cost-linter/lint_categories' }
          ]
        },
        {
          text: 'Guides',
          items: [
            { text: 'Scope: Clippy vs Linter', link: '/cost-linter/scope_boundary' },
            { text: 'Integration & CI', link: '/cost-linter/integration' },
            { text: 'Windows Setup', link: '/cost-linter/windows_setup' },
            { text: 'False Positives', link: '/cost-linter/false_positives' },
            { text: 'Severity Rationale', link: '/cost-linter/severity_rationale' },
            { text: 'Troubleshooting', link: '/cost-linter/troubleshooting' }
          ]
        },
        {
          text: 'Lints Catalog',
          items: [
            { text: 'Catalog Overview', link: '/cost-linter/lint_catalog' },
            { text: 'Lint Reference', link: '/cost-linter/lints/' }
          ]
        },
        {
          text: 'Branding & History',
          items: [
            { text: 'Branding Guide', link: '/cost-linter/branding' },
            { text: 'Roadmap MVP', link: '/cost-linter/history/roadmap_mvp' }
          ]
        }
      ],
      '/budget-assert/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/budget-assert/' },
            { text: 'End-User Guide', link: '/budget-assert/user_guide' },
            { text: 'Local vs Network Cost Gap', link: '/budget-assert/cost_gap' },
            { text: 'Protocol Mechanics', link: '/budget-assert/mechanics' },
            { text: 'Cost Terms Glossary', link: '/budget-assert/glossary' },
            { text: 'Testnet Troubleshooting', link: '/budget-assert/testnet_troubleshooting' }
          ]
        },
        {
          text: 'Guides & Tutorials',
          items: [
            { text: 'Deriving Limits', link: '/budget-assert/deriving_limits' },
            { text: 'CI Tutorial', link: '/budget-assert/ci_tutorial' },
            { text: 'CI/CD Integration', link: '/budget-assert/ci_cd_integration' },
            { text: 'Cross-Contract Testing', link: '/budget-assert/cross_contract_testing' },
            { text: 'Adding a Cost Metric', link: '/budget-assert/adding_a_metric' }
          ]
        },
        {
          text: 'Reference & Architecture',
          items: [
            { text: 'Tool Reference', link: '/budget-assert/reference' },
            { text: 'Macro Architecture', link: '/budget-assert/macro_architecture' },
            { text: 'Measurements', link: '/budget-assert/measurements' }
          ]
        },
        {
          text: 'Contributing',
          items: [
            { text: 'Developer Guide', link: '/budget-assert/developer_guide' },
            { text: 'Contributing', link: '/budget-assert/contributing' },
            { text: 'Release Process', link: '/budget-assert/release_process' }
          ]
        }
      ],
      '/cost-profiler/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/cost-profiler/' },
            { text: 'Quickstart', link: '/cost-profiler/getting-started/quickstart' },
            { text: 'The Debug Precondition', link: '/cost-profiler/getting-started/debug_precondition' },
            { text: 'Tollcraft Cost Pipeline', link: '/cost-profiler/getting-started/pipeline' }
          ]
        },
        {
          text: 'Cost & Metering',
          items: [
            { text: 'Cost Model & Limits', link: '/cost-profiler/cost/cost_model' },
            { text: 'Exclusive vs. Inclusive', link: '/cost-profiler/cost/exclusive_vs_inclusive' },
            { text: 'Host Function Attribution', link: '/cost-profiler/cost/host_attribution' }
          ]
        },
        {
          text: 'Guides & Tutorials',
          items: [
            { text: 'Diagnosing Regressions', link: '/cost-profiler/guides/diagnosing_regressions' },
            { text: 'Reading Flamegraphs', link: '/cost-profiler/guides/flamegraphs' },
            { text: 'Speedscope Visualization', link: '/cost-profiler/guides/speedscope' },
            { text: 'Cross-Contract Calls', link: '/cost-profiler/guides/cross_contract' },
            { text: 'Debugging Panics & Traps', link: '/cost-profiler/guides/panics_and_traps' }
          ]
        },
        {
          text: 'Reference & Architecture',
          items: [
            { text: 'CLI Reference', link: '/cost-profiler/reference/cli' },
            { text: 'System Architecture', link: '/cost-profiler/reference/architecture' },
            { text: 'Data Models', link: '/cost-profiler/reference/models' },
            { text: 'Known Risks & Failure Modes', link: '/cost-profiler/reference/risks' },
            { text: 'Spike: Budget API Limitations', link: '/cost-profiler/reference/spike_budget_api' }
          ]
        },
        {
          text: 'Contributing',
          items: [
            { text: 'Roadmap', link: '/cost-profiler/contributing/roadmap' },
            { text: 'Developer Guide', link: '/cost-profiler/contributing/developer_guide' },
            { text: 'Contributing', link: '/cost-profiler/contributing/contributing' }
          ]
        }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Tollcraft' }
    ],
    footer: {
      message: 'Built for the Stellar & Soroban ecosystem.',
      copyright: 'Copyright © Tollcraft Initiative'
    }
  }
})
