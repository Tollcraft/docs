<template>
  <div class="pipeline-container">
    <div class="pipeline-header">
      <div class="pipeline-badge">INTEGRATED WORKFLOW</div>
      <h3 class="pipeline-title">Interactive Cost Lifecycle</h3>
      <p class="pipeline-sub">Select a stage to inspect its role, runtime mechanism, and telemetry output.</p>
    </div>

    <!-- Tier Navigation Pills -->
    <div class="stage-nav" role="tablist" aria-label="Pipeline Stages">
      <button
        v-for="(stage, idx) in stages"
        :key="stage.id"
        role="tab"
        :aria-selected="activeStageIndex === idx"
        :class="['stage-tab', `tier-${idx + 1}`, { active: activeStageIndex === idx }]"
        @click="activeStageIndex = idx"
      >
        <div class="tab-indicator">
          <span class="pulse-dot"></span>
          <span class="stage-num">0{{ idx + 1 }}</span>
        </div>
        <div class="tab-text">
          <span class="tab-verb">{{ stage.verb }}</span>
          <span class="tab-name">{{ stage.name }}</span>
        </div>
      </button>
    </div>

    <!-- Active Stage Panel -->
    <div :class="['stage-panel', `tier-${activeStageIndex + 1}`]">
      <div class="panel-meta">
        <div class="panel-phase">
          <span class="phase-tag">{{ currentStage.phase }}</span>
          <span class="runtime-tag">{{ currentStage.runtime }}</span>
        </div>
        <h4 class="panel-headline">{{ currentStage.headline }}</h4>
        <p class="panel-desc">{{ currentStage.description }}</p>
      </div>

      <div class="panel-grid">
        <!-- Highlights List -->
        <div class="panel-col">
          <div class="col-title">CRITICAL CAPABILITIES</div>
          <ul class="feature-list">
            <li v-for="(feat, fIdx) in currentStage.features" :key="fIdx">
              <span class="check-icon">▹</span>
              <span>{{ feat }}</span>
            </li>
          </ul>
        </div>

        <!-- Live Code/Command Telemetry Box -->
        <div class="panel-col telemetry-col">
          <div class="telemetry-bar">
            <span class="tele-dot red"></span>
            <span class="tele-dot yellow"></span>
            <span class="tele-dot green"></span>
            <span class="tele-title">{{ currentStage.cliCommand }}</span>
          </div>
          <pre class="telemetry-code"><code>{{ currentStage.cliOutput }}</code></pre>
        </div>
      </div>

      <div class="panel-footer">
        <a :href="withBase(currentStage.link)" class="action-btn">
          Explore {{ currentStage.name }} Documentation →
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { withBase } from 'vitepress'

interface Stage {
  id: string
  verb: string
  name: string
  phase: string
  runtime: string
  headline: string
  description: string
  features: string[]
  cliCommand: string
  cliOutput: string
  link: string
}

const stages: Stage[] = [
  {
    id: 'prevent',
    verb: 'PREVENT',
    name: 'soroban-cost-linter',
    phase: 'PHASE 01 • COMPILE TIME',
    runtime: 'rustc / Dylint driver',
    headline: 'Eliminate structural cost anti-patterns before execution',
    description: 'Intercepts expensive patterns like storage mutations inside loops, redundant clone allocations, and unbounded recursion at build time with zero gas cost.',
    features: [
      '40+ specialized Soroban AST and HIR lints',
      'Detects blind storage writes and discarded reads',
      'Flags TTL extension in loops and inefficient byte concat',
      'Configurable severity (deny, warn, allow) via cargo config'
    ],
    cliCommand: 'cargo cost-lint --all-targets',
    cliOutput: `warning: storage write inside loop
  --> contracts/pool/src/lib.rs:88:9
   |
88 |   env.storage().instance().set(&key, &val);
   |   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   = help: batch storage operations outside the loop
   = note: each write incurs 25k CPU instructions and ledger write fees`,
    link: '/cost-linter/'
  },
  {
    id: 'detect',
    verb: 'DETECT',
    name: 'soroban-budget-assert',
    phase: 'PHASE 02 • TEST / CI TIME',
    runtime: 'cargo test & RPC simulation',
    headline: 'Empirically assert against network resource limits',
    description: 'Runs contract invocations through local metering or live Stellar RPC simulations. Pin resource ceilings and gate pull requests against regressions.',
    features: [
      'Tier A: Fast local test assertions via #[budget_cpu_lt(N)]',
      'Tier B: Testnet simulation matching Stellar Protocol 22 fees',
      'Baseline snapshot tracking with --record-baseline and --check-baseline',
      'Outputs automated GitHub Step Summaries, JSON, and CSV reports'
    ],
    cliCommand: 'cargo budget-report --check --network testnet',
    cliOutput: `=== BUDGET REGRESSION REPORT ===
amm_pool::swap [CPU Instructions]
  Measured: 1,420,110 inst. | Limit: 1,500,000 inst. -> PASS
amm_pool::swap [Write Bytes]
  Measured:     2,048 bytes | Limit:     1,024 bytes -> FAIL
Error: 1 budget check failed. Regression exceeds 10% tolerance.`,
    link: '/budget-assert/'
  },
  {
    id: 'diagnose',
    verb: 'DIAGNOSE',
    name: 'soroban-cost-profiler',
    phase: 'PHASE 03 • PROFILING TIME',
    runtime: 'WASM interpreter & DWARF symbolizer',
    headline: 'Pinpoint hot instructions and memory bottlenecks',
    description: 'When budgets fail, step through contract WASM execution instruction-by-instruction. Correlate raw bytecode costs back to original Rust source code lines.',
    features: [
      'Interactive SVG Flamegraphs with zoom, search, and reset',
      'Exclusive vs. inclusive cost attribution across subcalls',
      'Speedscope folded stack export for deep frame analysis',
      'Host function attribution for cryptographic and storage operations'
    ],
    cliCommand: 'soroban-cost-profiler --wasm pool.wasm --fn swap -o profile.svg',
    cliOutput: `[PROFILER] Symbolizing WASM via DWARF .debug_line...
[PROFILER] Tracing 1,420,110 instructions across 14 stack frames...
[PROFILER] Hotspots identified:
  - 42.1% soroban_sdk::map::Map::insert (pool.rs:142)
  - 28.4% host::crypto::sha256 (host call)
  - 14.5% soroban_sdk::val_to_raw (serialization)
[OUTPUT] Wrote interactive flamegraph -> profile.svg`,
    link: '/cost-profiler/'
  }
]

const activeStageIndex = ref(0)
const currentStage = computed(() => stages[activeStageIndex.value])
</script>

<style scoped>
.pipeline-container {
  margin: 48px 0;
  padding: 32px;
  background: radial-gradient(120% 120% at 50% 0%, #131024 0%, #07050d 100%);
  border: 1px solid rgba(244, 241, 255, 0.08);
  border-radius: 24px;
  box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.7);
}

.pipeline-header {
  text-align: center;
  margin-bottom: 32px;
}

.pipeline-badge {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--cyan);
  background: rgba(34, 211, 238, 0.1);
  border: 1px solid rgba(34, 211, 238, 0.25);
  padding: 4px 12px;
  border-radius: 9999px;
  margin-bottom: 12px;
}

.pipeline-title {
  font-family: var(--font-display);
  font-size: 1.75rem;
  margin: 0 0 8px 0;
  color: var(--paper);
}

.pipeline-sub {
  color: var(--muted);
  font-size: 0.95rem;
  margin: 0 auto;
  max-width: 580px;
}

/* Stage Navigation */
.stage-nav {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 28px;
}

@media (max-width: 768px) {
  .stage-nav {
    grid-template-columns: 1fr;
  }
}

.stage-tab {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  background: var(--void-2);
  border: 1px solid rgba(244, 241, 255, 0.08);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
  text-align: left;
}

.stage-tab:hover {
  background: #15112a;
  transform: translateY(-2px);
}

.stage-tab.active.tier-1 {
  border-color: var(--cyan);
  box-shadow: 0 0 20px rgba(34, 211, 238, 0.25);
  background: rgba(34, 211, 238, 0.06);
}

.stage-tab.active.tier-2 {
  border-color: var(--violet);
  box-shadow: 0 0 20px rgba(139, 92, 246, 0.25);
  background: rgba(139, 92, 246, 0.06);
}

.stage-tab.active.tier-3 {
  border-color: var(--magenta);
  box-shadow: 0 0 20px rgba(232, 121, 249, 0.25);
  background: rgba(232, 121, 249, 0.06);
}

.tab-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--faint);
  transition: all 0.3s ease;
}

.stage-tab.active.tier-1 .pulse-dot {
  background: var(--cyan);
  box-shadow: 0 0 8px var(--cyan);
}

.stage-tab.active.tier-2 .pulse-dot {
  background: var(--violet);
  box-shadow: 0 0 8px var(--violet);
}

.stage-tab.active.tier-3 .pulse-dot {
  background: var(--magenta);
  box-shadow: 0 0 8px var(--magenta);
}

.stage-num {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--faint);
}

.stage-tab.active .stage-num {
  color: var(--paper);
}

.tab-text {
  display: flex;
  flex-direction: column;
}

.tab-verb {
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--paper);
}

.tab-name {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--muted);
}

/* Stage Panel */
.stage-panel {
  background: var(--void-2);
  border: 1px solid rgba(244, 241, 255, 0.1);
  border-radius: 20px;
  padding: 32px;
  transition: border-color 0.3s ease;
}

.stage-panel.tier-1 { border-color: rgba(34, 211, 238, 0.3); }
.stage-panel.tier-2 { border-color: rgba(139, 92, 246, 0.3); }
.stage-panel.tier-3 { border-color: rgba(232, 121, 249, 0.3); }

.panel-meta {
  margin-bottom: 24px;
}

.panel-phase {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.phase-tag {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--cyan);
}

.stage-panel.tier-2 .phase-tag { color: var(--violet); }
.stage-panel.tier-3 .phase-tag { color: var(--magenta); }

.runtime-tag {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--faint);
  background: rgba(244, 241, 255, 0.04);
  padding: 2px 8px;
  border-radius: 6px;
}

.panel-headline {
  font-family: var(--font-display);
  font-size: 1.35rem;
  color: var(--paper);
  margin: 0 0 8px 0;
}

.panel-desc {
  color: var(--muted);
  font-size: 0.95rem;
  line-height: 1.6;
  margin: 0;
  max-width: 780px;
}

/* Panel Grid */
.panel-grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 28px;
  margin: 28px 0;
}

@media (max-width: 900px) {
  .panel-grid {
    grid-template-columns: 1fr;
  }
}

.col-title {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--faint);
  letter-spacing: 0.08em;
  margin-bottom: 16px;
}

.feature-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feature-list li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--muted);
  font-size: 0.92rem;
  line-height: 1.5;
}

.check-icon {
  color: var(--cyan);
  font-weight: 700;
}

.stage-panel.tier-2 .check-icon { color: var(--violet); }
.stage-panel.tier-3 .check-icon { color: var(--magenta); }

/* Telemetry Box */
.telemetry-col {
  background: #040308;
  border: 1px solid rgba(244, 241, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.telemetry-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: #0d0a19;
  border-bottom: 1px solid rgba(244, 241, 255, 0.06);
}

.tele-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.tele-dot.red { background: #f87171; }
.tele-dot.yellow { background: #fbbf24; }
.tele-dot.green { background: #34d399; }

.tele-title {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--muted);
  margin-left: 8px;
}

.telemetry-code {
  margin: 0;
  padding: 16px;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  line-height: 1.6;
  color: #e2e0ed;
  overflow-x: auto;
  white-space: pre;
}

/* Footer Action */
.panel-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid rgba(244, 241, 255, 0.06);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 600;
  padding: 10px 20px;
  border-radius: 10px;
  background: rgba(244, 241, 255, 0.04);
  border: 1px solid rgba(244, 241, 255, 0.12);
  color: var(--paper);
  text-decoration: none !important;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(244, 241, 255, 0.08);
  border-color: var(--cyan);
  transform: translateX(4px);
}
</style>
