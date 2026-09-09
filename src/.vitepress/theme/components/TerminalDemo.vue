<template>
  <div class="terminal-wrapper">
    <div class="terminal-tabs">
      <div class="window-controls">
        <span class="ctrl close"></span>
        <span class="ctrl min"></span>
        <span class="ctrl max"></span>
      </div>
      <div class="tabs-list">
        <button
          v-for="(cmd, idx) in commands"
          :key="cmd.id"
          :class="['term-tab', { active: activeTab === idx }]"
          @click="activeTab = idx"
        >
          <span class="tab-badge">{{ cmd.badge }}</span>
          <span class="tab-label">{{ cmd.label }}</span>
        </button>
      </div>
      <button class="copy-btn" @click="copyCommand" :title="copied ? 'Copied!' : 'Copy Command'">
        <span>{{ copied ? '✓ Copied' : '⎘ Copy' }}</span>
      </button>
    </div>

    <div class="terminal-body">
      <div class="prompt-line">
        <span class="prompt-user">dev@tollcraft</span>
        <span class="prompt-path">~/contracts/amm-pool</span>
        <span class="prompt-symbol">$</span>
        <span class="prompt-cmd">{{ activeCmd.command }}</span>
      </div>
      <div class="terminal-output" v-html="activeCmd.formattedOutput"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface TerminalCommand {
  id: string
  badge: string
  label: string
  command: string
  formattedOutput: string
}

const commands: TerminalCommand[] = [
  {
    id: 'lint',
    badge: 'T1',
    label: 'cargo cost-lint',
    command: 'cargo cost-lint --all-targets',
    formattedOutput: `<span class="c-dim">Building member crates for cost audit...</span>
<span class="c-yellow">warning</span><span class="c-bold">: storage_in_loop detected</span>
  <span class="c-cyan">--&gt;</span> contracts/amm-pool/src/lib.rs:94:13
   <span class="c-cyan">|</span>
<span class="c-cyan">94</span> <span class="c-cyan">|</span>     env.storage().instance().set(&key, &user_deposit);
   <span class="c-cyan">|</span>     <span class="c-yellow">^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^</span>
   <span class="c-cyan">=</span> <span class="c-bold">help</span>: batch storage writes outside the loop iteration
   <span class="c-cyan">=</span> <span class="c-bold">cost impact</span>: ~25,000 CPU instructions + 1 ledger write entry per cycle
<span class="c-green">✓</span> Finished analysis in 0.42s (1 warning, 0 errors)`
  },
  {
    id: 'assert',
    badge: 'T2',
    label: 'cargo budget-report',
    command: 'cargo budget-report --check --network testnet',
    formattedOutput: `<span class="c-dim">Deploying WASM to Stellar Testnet (RPC: https://soroban-testnet.stellar.org)...</span>
<span class="c-dim">Simulating invocations via SorobanTransactionData XDR...</span>

<span class="c-bold">=== WORKSPACE BUDGET REGRESSION REPORT ===</span>
<span class="c-cyan">amm-pool::deposit</span>
  • CPU Instructions :  <span class="c-green">892,104</span> / 1,000,000 inst.  <span class="c-green">[PASS]</span>
  • Memory Bytes     :   <span class="c-green">14,280</span> /    25,000 B      <span class="c-green">[PASS]</span>
  • Read Bytes       :    <span class="c-green">1,024</span> /     2,000 B      <span class="c-green">[PASS]</span>
  • Write Bytes      :      <span class="c-green">512</span> /     1,000 B      <span class="c-green">[PASS]</span>
<span class="c-green">✓ All 4 budget limits satisfied within 0% tolerance. CI check passed.</span>`
  },
  {
    id: 'profiler',
    badge: 'T3',
    label: 'soroban-cost-profiler',
    command: 'soroban-cost-profiler --wasm pool.wasm --fn swap --output flamegraph.svg',
    formattedOutput: `<span class="c-dim">Loading WASM binary (target/wasm32-unknown-unknown/profiling/pool.wasm)...</span>
<span class="c-dim">Parsed 2,418 DWARF debug line entries.</span>
<span class="c-magenta">Tracing execution of function: swap()</span>
Execution completed in 1,248,310 instructions.

<span class="c-bold">Top Hotspots by Exclusive Instruction Count:</span>
  1. <span class="c-magenta">41.8%</span>  521,800 inst.  soroban_sdk::map::Map::insert (pool.rs:148)
  2. <span class="c-cyan">28.2%</span>  352,000 inst.  host::crypto::sha256_slice (host call)
  3. <span class="c-yellow">16.4%</span>  204,720 inst.  amm_math::compute_constant_product (math.rs:32)
  4. <span class="c-dim">13.6%</span>  169,790 inst.  other frame calls

<span class="c-green">✓ Interactive SVG flamegraph exported to ./flamegraph.svg</span>`
  }
]

const activeTab = ref(0)
const activeCmd = computed(() => commands[activeTab.value])
const copied = ref(false)

function copyCommand() {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(activeCmd.value.command)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }
}
</script>

<style scoped>
.terminal-wrapper {
  margin: 36px 0;
  background: #05030a;
  border: 1px solid rgba(244, 241, 255, 0.1);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.7);
}

.terminal-tabs {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: #0d0a18;
  border-bottom: 1px solid rgba(244, 241, 255, 0.08);
}

.window-controls {
  display: flex;
  gap: 6px;
}

.ctrl {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.ctrl.close { background: #ff5f56; }
.ctrl.min { background: #ffbd2e; }
.ctrl.max { background: #27c93f; }

.tabs-list {
  display: flex;
  gap: 6px;
  flex-grow: 1;
  overflow-x: auto;
}

.term-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.term-tab:hover {
  background: rgba(244, 241, 255, 0.04);
  color: var(--paper);
}

.term-tab.active {
  background: rgba(139, 92, 246, 0.12);
  border-color: rgba(139, 92, 246, 0.3);
  color: var(--paper);
}

.tab-badge {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(244, 241, 255, 0.08);
  color: var(--cyan);
}

.term-tab.active .tab-badge {
  background: var(--violet);
  color: #ffffff;
}

.copy-btn {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  padding: 5px 10px;
  border-radius: 6px;
  background: rgba(244, 241, 255, 0.05);
  border: 1px solid rgba(244, 241, 255, 0.1);
  color: var(--muted);
  cursor: pointer;
  transition: all 0.2s ease;
}

.copy-btn:hover {
  background: rgba(244, 241, 255, 0.1);
  color: var(--paper);
  border-color: var(--cyan);
}

.terminal-body {
  padding: 20px;
  font-family: var(--font-mono);
  font-size: 0.82rem;
  line-height: 1.6;
}

.prompt-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.prompt-user {
  color: var(--cyan);
  font-weight: 600;
}

.prompt-path {
  color: var(--violet);
}

.prompt-symbol {
  color: var(--faint);
}

.prompt-cmd {
  color: var(--paper);
  font-weight: 600;
}

.terminal-output {
  color: #d1cfe2;
  white-space: pre-wrap;
  word-break: break-word;
}

:deep(.c-cyan) { color: #22d3ee; }
:deep(.c-magenta) { color: #e879f9; }
:deep(.c-yellow) { color: #fbbf24; }
:deep(.c-green) { color: #34d399; }
:deep(.c-dim) { color: #6f6790; }
:deep(.c-bold) { font-weight: 700; color: #ffffff; }
</style>
