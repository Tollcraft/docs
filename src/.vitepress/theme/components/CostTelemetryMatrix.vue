<template>
  <div class="matrix-container">
    <div class="matrix-header">
      <div class="matrix-badge">SOROBAN METERING MATRIX</div>
      <h3 class="matrix-title">Operation Cost Telemetry</h3>
      <p class="matrix-sub">Inspect how common contract operations translate into protocol-level resource consumption and fees.</p>
    </div>

    <!-- Operation Selector Tabs -->
    <div class="op-tabs" role="tablist">
      <button
        v-for="(op, idx) in operations"
        :key="op.id"
        role="tab"
        :aria-selected="selectedOpIndex === idx"
        :class="['op-tab', { active: selectedOpIndex === idx }]"
        @click="selectedOpIndex = idx"
      >
        <span class="op-tab-index">0{{ idx + 1 }}.</span>
        <span class="op-tab-title">{{ op.title }}</span>
      </button>
    </div>

    <!-- Telemetry Display Card -->
    <div class="telemetry-card">
      <div class="card-top">
        <div class="op-badge-row">
          <span class="category-badge">{{ currentOp.category }}</span>
          <span :class="['tier-badge', currentOp.tierClass]">{{ currentOp.tierLabel }}</span>
        </div>
        <h4 class="op-title">{{ currentOp.title }}</h4>
        <p class="op-explanation">{{ currentOp.description }}</p>
      </div>

      <!-- Resource Telemetry Grid -->
      <div class="resource-grid">
        <div class="metric-box">
          <div class="metric-label">CPU INSTRUCTIONS</div>
          <div class="metric-val cpu">{{ currentOp.cpu }}</div>
          <div class="metric-sub">{{ currentOp.cpuDetail }}</div>
        </div>

        <div class="metric-box">
          <div class="metric-label">MEMORY FOOTPRINT</div>
          <div class="metric-val memory">{{ currentOp.memory }}</div>
          <div class="metric-sub">{{ currentOp.memoryDetail }}</div>
        </div>

        <div class="metric-box">
          <div class="metric-label">LEDGER I/O</div>
          <div class="metric-val io">{{ currentOp.io }}</div>
          <div class="metric-sub">{{ currentOp.ioDetail }}</div>
        </div>

        <div class="metric-box">
          <div class="metric-label">RENT / TTL</div>
          <div class="metric-val rent">{{ currentOp.rent }}</div>
          <div class="metric-sub">{{ currentOp.rentDetail }}</div>
        </div>
      </div>

      <!-- Code Comparison Split -->
      <div class="code-compare-grid">
        <div class="code-box hazardous">
          <div class="code-header">
            <span class="status-indicator fail">●</span>
            <span class="code-label">HAZARDOUS PATTERN</span>
          </div>
          <pre class="code-pre"><code>{{ currentOp.badCode }}</code></pre>
        </div>

        <div class="code-box optimal">
          <div class="code-header">
            <span class="status-indicator pass">●</span>
            <span class="code-label">OPTIMAL TOLLCRAFT PATTERN</span>
          </div>
          <pre class="code-pre"><code>{{ currentOp.goodCode }}</code></pre>
        </div>
      </div>

      <div class="protection-callout">
        <span class="protect-badge">GUARD</span>
        <div class="protect-content">
          <strong>Tollcraft Protection:</strong>
          <span>{{ currentOp.tollcraftGuard }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Operation {
  id: string
  title: string
  category: string
  tierLabel: string
  tierClass: string
  description: string
  cpu: string
  cpuDetail: string
  memory: string
  memoryDetail: string
  io: string
  ioDetail: string
  rent: string
  rentDetail: string
  badCode: string
  goodCode: string
  tollcraftGuard: string
}

const operations: Operation[] = [
  {
    id: 'storage-loop',
    title: 'Storage Write in Loop',
    category: 'Storage & I/O',
    tierLabel: 'Tier 1 Caught',
    tierClass: 't1',
    description: 'Mutating instance or persistent storage on every loop iteration re-serializes entries and consumes non-refundable write fees per cycle.',
    cpu: '~25,000 / iter',
    cpuDetail: 'Host storage invocation & XDR serialization overhead',
    memory: '~512 B / iter',
    memoryDetail: 'Intermediate host Val and key allocation',
    io: '1 Write / iter',
    ioDetail: 'Ledger key modified N times per transaction',
    rent: 'Repeated TTL hits',
    rentDetail: 'Increases state contention on ledger entries',
    badCode: `for item in items.iter() {
    // [HAZARD] Incurs N writes and N host cross-calls
    env.storage().instance().set(&item.key, &item.val);
}`,
    goodCode: `let mut batch = env.storage().instance().get(&BATCH_KEY).unwrap_or(...);
for item in items.iter() {
    batch.push_back(item);
}
// [OPTIMAL] Commit once at loop completion
env.storage().instance().set(&BATCH_KEY, &batch);`,
    tollcraftGuard: 'Linted at build-time by instance_storage_write_in_loop and asserted in tests via #[budget_write_bytes_lt].'
  },
  {
    id: 'cross-contract',
    title: 'Cross-Contract Invocation',
    category: 'Inter-Contract',
    tierLabel: 'Tier 2 & 3 Profiled',
    tierClass: 't2',
    description: 'Invoking other contracts (e.g. SEP-41 token transfer) requires host context switching, WASM validation, and parameter marshaling.',
    cpu: '150k - 500k+',
    cpuDetail: 'Context switch, stack frame setup, authorization checks',
    memory: '1 - 4 KB',
    memoryDetail: 'Parameter serialization and returned Val deserialization',
    io: '2-4 Reads, 1 Write',
    ioDetail: 'Target contract instance read + balance mutation',
    rent: 'Entry TTL dependent',
    rentDetail: 'User balance entry TTL extended if configured',
    badCode: `for recipient in recipients.iter() {
    // [HAZARD] Individual subcall per recipient in loop
    token_client.transfer(&admin, &recipient, &amount);
}`,
    goodCode: `// [OPTIMAL] Batch into multi-transfer or pre-validate authorization
token_client.batch_transfer(&admin, &recipients, &amount);
// Profile subcalls to verify host overhead:
// soroban-cost-profiler --wasm router.wasm --fn batch_transfer`,
    tollcraftGuard: 'Contract call inside loop detected by contract_call_in_loop lint; subcall frame traced by soroban-cost-profiler.'
  },
  {
    id: 'crypto-hashing',
    title: 'Crypto Hash Operations',
    category: 'Host Functions',
    tierLabel: 'Tier 3 Hotspot',
    tierClass: 't3',
    description: 'Host crypto operations (SHA-256, Keccak-256, Ed25519) execute natively inside the host environment. Efficient, but repeated invocations dominate compute budgets.',
    cpu: '15,000 - 80,000',
    cpuDetail: 'Base invocation fee + byte length scale factor',
    memory: '~128 B',
    memoryDetail: 'Bytes allocation for digest output',
    io: '0 Ledger I/O',
    ioDetail: 'Pure computation; no ledger state modified',
    rent: 'None',
    rentDetail: 'Transient computation',
    badCode: `// [HAZARD] Hashing identical invariant data inside inner loop:
for item in dataset.iter() {
    let hash = env.crypto().sha256(&static_header);
    verify_item(&hash, item);
}`,
    goodCode: `// [OPTIMAL] Pre-compute hash outside loop scope:
let hash = env.crypto().sha256(&static_header);
for item in dataset.iter() {
    verify_item(&hash, item);
}`,
    tollcraftGuard: 'crypto_hash_of_constant lint flags build-time invariants; flamegraph highlights exclusive CPU time in host::crypto.'
  },
  {
    id: 'unbounded-vec',
    title: 'Unbounded Vec Appends',
    category: 'Memory & CPU',
    tierLabel: 'Tier 1 & 2 Guarded',
    tierClass: 't1',
    description: 'Soroban collections (Vec, Map) live on the host. Every push or realloc invokes host boundary transitions and allocates quadratic memory if capacity is exceeded.',
    cpu: 'O(N) host cycles',
    cpuDetail: 'Host Val copying and index resolution',
    memory: 'Grows per item',
    memoryDetail: 'Exceeding 40 MB hard limit aborts execution',
    io: 'O(N) serialized bytes',
    ioDetail: 'When written to ledger storage',
    rent: 'Proportional to size',
    rentDetail: 'Larger state entries pay higher continuous rent',
    badCode: `let mut list = Vec::new(&env);
// [HAZARD] Unbounded external loop parameter
for i in 0..user_count {
    list.push_back(i);
}`,
    goodCode: `// [OPTIMAL] Enforce bounded cap and pre-allocate if possible
assert!(user_count <= MAX_BATCH_SIZE, "batch limit exceeded");
let mut list = Vec::new(&env);
for i in 0..user_count {
    list.push_back(i);
}`,
    tollcraftGuard: 'unbounded_input_loop lint alerts on missing guardrails; #[budget_memory_lt(N)] pins RAM ceiling in tests.'
  }
]

const selectedOpIndex = ref(0)
const currentOp = computed(() => operations[selectedOpIndex.value])
</script>

<style scoped>
.matrix-container {
  margin: 48px 0;
  padding: 32px;
  background: radial-gradient(120% 120% at 50% 0%, #100d1e 0%, #07050d 100%);
  border: 1px solid rgba(244, 241, 255, 0.08);
  border-radius: 24px;
}

.matrix-header {
  text-align: center;
  margin-bottom: 28px;
}

.matrix-badge {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--magenta);
  background: rgba(232, 121, 249, 0.1);
  border: 1px solid rgba(232, 121, 249, 0.25);
  padding: 4px 12px;
  border-radius: 9999px;
  margin-bottom: 12px;
}

.matrix-title {
  font-family: var(--font-display);
  font-size: 1.75rem;
  margin: 0 0 8px 0;
  color: var(--paper);
}

.matrix-sub {
  color: var(--muted);
  font-size: 0.95rem;
  margin: 0 auto;
  max-width: 600px;
}

/* Operation Tabs */
.op-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  margin-bottom: 28px;
}

.op-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 12px;
  background: var(--void-2);
  border: 1px solid rgba(244, 241, 255, 0.08);
  color: var(--muted);
  font-family: var(--font-display);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.op-tab:hover {
  color: var(--paper);
  border-color: rgba(244, 241, 255, 0.2);
  background: #161226;
}

.op-tab.active {
  color: var(--paper);
  background: rgba(232, 121, 249, 0.1);
  border-color: var(--magenta);
  box-shadow: 0 0 15px rgba(232, 121, 249, 0.2);
}

/* Telemetry Card */
.telemetry-card {
  background: var(--void-2);
  border: 1px solid rgba(244, 241, 255, 0.1);
  border-radius: 20px;
  padding: 28px;
}

.card-top {
  margin-bottom: 24px;
}

.op-badge-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.category-badge {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--faint);
  background: rgba(244, 241, 255, 0.04);
  padding: 2px 8px;
  border-radius: 6px;
}

.tier-badge {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
}

.tier-badge.t1 {
  color: var(--cyan);
  background: rgba(34, 211, 238, 0.1);
}

.tier-badge.t2 {
  color: var(--violet);
  background: rgba(139, 92, 246, 0.1);
}

.tier-badge.t3 {
  color: var(--magenta);
  background: rgba(232, 121, 249, 0.1);
}

.op-title {
  font-family: var(--font-display);
  font-size: 1.4rem;
  color: var(--paper);
  margin: 0 0 8px 0;
}

.op-explanation {
  color: var(--muted);
  font-size: 0.95rem;
  line-height: 1.6;
  margin: 0;
}

/* Resource Grid */
.resource-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin: 24px 0;
}

@media (max-width: 800px) {
  .resource-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 500px) {
  .resource-grid {
    grid-template-columns: 1fr;
  }
}

.metric-box {
  background: #06040b;
  border: 1px solid rgba(244, 241, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
}

.metric-label {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--faint);
  margin-bottom: 8px;
}

.metric-val {
  font-family: var(--font-mono);
  font-size: 1.25rem;
  font-weight: 800;
  margin-bottom: 4px;
}

.metric-val.cpu { color: var(--cyan); }
.metric-val.memory { color: var(--amber); }
.metric-val.io { color: var(--magenta); }
.metric-val.rent { color: var(--violet); }

.metric-sub {
  font-size: 0.78rem;
  color: var(--muted);
  line-height: 1.4;
}

/* Code Compare */
.code-compare-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin: 24px 0;
}

@media (max-width: 850px) {
  .code-compare-grid {
    grid-template-columns: 1fr;
  }
}

.code-box {
  background: #040308;
  border: 1px solid rgba(244, 241, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
}

.code-box.hazardous {
  border-color: rgba(248, 113, 113, 0.3);
}

.code-box.optimal {
  border-color: rgba(52, 211, 153, 0.3);
}

.code-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: #0d0a18;
  border-bottom: 1px solid rgba(244, 241, 255, 0.06);
}

.status-indicator.fail { color: #f87171; font-size: 0.75rem; }
.status-indicator.pass { color: #34d399; font-size: 0.75rem; }

.code-label {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.code-pre {
  margin: 0;
  padding: 14px;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  line-height: 1.5;
  color: #e2e0ed;
  overflow-x: auto;
  white-space: pre;
}

/* Protection Callout */
.protection-callout {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 18px;
  border-radius: 12px;
  background: rgba(34, 211, 238, 0.05);
  border: 1px solid rgba(34, 211, 238, 0.2);
  margin-top: 16px;
}

.protect-badge {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--cyan);
  background: rgba(34, 211, 238, 0.15);
  border: 1px solid rgba(34, 211, 238, 0.3);
  padding: 2px 6px;
  border-radius: 4px;
  margin-top: 2px;
}

.op-tab-index {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--faint);
}

.op-tab.active .op-tab-index {
  color: var(--magenta);
}

.protect-content {
  font-size: 0.88rem;
  line-height: 1.5;
  color: var(--paper);
}

.protect-content strong {
  color: var(--cyan);
  margin-right: 6px;
}
</style>
