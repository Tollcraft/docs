<template>
  <div class="tollcraft-grid">
    <a class="tollcraft-card tier-1" :href="withBase('/cost-linter/')">
      <div class="card-badge">Tier 1: Prevent</div>
      <h3>Cost Linter</h3>
      <p>A static analysis shield for Soroban smart contracts. Hooks directly into rustc to catch expensive patterns before compilation.</p>
      <div class="card-link">Explore Cost Linter →</div>
    </a>

    <a class="tollcraft-card tier-2" :href="withBase('/budget-assert/')">
      <div class="card-badge">Tier 2: Detect</div>
      <h3>Budget Assert</h3>
      <p>An empirical runtime test harness. Measures network-simulated resource consumption and fails CI when budget limits are breached.</p>
      <div class="card-link">Explore Budget Assert →</div>
    </a>

    <a class="tollcraft-card tier-3" :href="withBase('/cost-profiler/')">
      <div class="card-badge">Tier 3: Diagnose</div>
      <h3>Cost Profiler</h3>
      <p>Runs one contract export under a traced engine and names its frames from the binary's DWARF line tables, writing collapsed-stack text speedscope.app and flamegraph.pl read.</p>
      <div class="card-link">Explore Cost Profiler →</div>
    </a>
  </div>
</template>

<script setup lang="ts">
import { withBase } from 'vitepress'
</script>
