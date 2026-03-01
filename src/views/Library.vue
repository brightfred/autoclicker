<template>
  <div class="library">

    <!-- Header -->
    <div class="header">
      <div>
        <h1 class="title">Pattern Library</h1>
        <p class="sub">{{ patterns.length }} pattern{{ patterns.length !== 1 ? 's' : '' }} saved</p>
      </div>
      <router-link to="/record" class="btn-primary">◉ New Recording</router-link>
    </div>

    <!-- Empty state -->
    <div v-if="patterns.length === 0" class="empty">
      <div class="empty-icon">⚗</div>
      <p class="empty-title">No patterns yet</p>
      <p class="empty-sub">Record a pattern to get started</p>
    </div>

    <!-- Pattern list -->
    <div v-else class="pattern-list">
      <div v-for="pattern in patterns" :key="pattern.id" class="pattern-card">

        <div class="card-left">
          <div class="card-name-row">
            <span class="card-name">{{ pattern.name }}</span>
            <span class="model-badge">{{ getModelName(pattern.modelId) }}</span>
          </div>
          <div class="card-meta">
            <span class="card-stat">{{ pattern.clickCount }} clicks</span>
            <span class="card-stat accent">{{ pattern.itemsPerCycle ?? 1 }} item{{ (pattern.itemsPerCycle ?? 1) > 1 ? 's' : '' }} / cycle</span>
            <span class="card-stat">{{ formatDuration(pattern.totalDuration) }}</span>
            <span class="card-stat">avg {{ pattern.avgInterval }}ms</span>
            <span class="card-stat">±{{ pattern.stdDevInterval }}ms</span>
          </div>
        </div>

        <div class="card-actions">
          <button class="btn-icon btn-export" @click="exportPattern(pattern)" title="Export log">⬇</button>
          <button class="btn-icon btn-delete" @click="confirmDelete(pattern)" title="Delete">✕</button>
          <router-link :to="`/play/${pattern.id}`" class="btn-icon btn-play" title="Play">▶</router-link>
        </div>

      </div>
    </div>

    <!-- Delete confirmation -->
    <div v-if="deleteTarget" class="modal-backdrop" @click.self="deleteTarget = null">
      <div class="modal">
        <p class="modal-title">Delete "<strong>{{ deleteTarget.name }}</strong>"?</p>
        <div class="modal-actions">
          <button class="btn-ghost" @click="deleteTarget = null">Cancel</button>
          <button class="btn-danger" @click="doDelete">Delete</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { usePatternsStore } from '../stores/patterns';
import { getModel } from '../models/index.js';

const store = usePatternsStore();
const { patterns } = storeToRefs(store);
const deleteTarget = ref(null);

function getModelName(modelId) {
  return getModel(modelId)?.name ?? modelId ?? 'Unknown';
}

function confirmDelete(pattern) { deleteTarget.value = pattern; }
function doDelete() {
  store.deletePattern(deleteTarget.value.id);
  deleteTarget.value = null;
}

function formatDuration(ms) {
  if (!ms) return '0s';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function exportPattern(pattern) {
  const modelName = getModelName(pattern.modelId);
  const lines = [];

  lines.push(`PATTERN: ${pattern.name}`);
  lines.push(`MODEL: ${modelName}`);
  lines.push(`RECORDED: ${new Date(pattern.createdAt).toLocaleString()}`);
  lines.push(`CLICKS: ${pattern.clickCount}`);
  lines.push(`ITEMS PER CYCLE: ${pattern.itemsPerCycle ?? 1}`);
  lines.push(`DURATION: ${formatDuration(pattern.totalDuration)}`);
  lines.push(`AVG INTERVAL: ${pattern.avgInterval}ms`);
  lines.push(`STD DEV: ${pattern.stdDevInterval}ms`);
  lines.push(`MIN: ${pattern.minInterval}ms  MAX: ${pattern.maxInterval}ms`);
  lines.push('');
  lines.push('─'.repeat(70));
  lines.push('  #   | TYPE  |    X    |    Y    |  DELTA   |  ELAPSED ');
  lines.push('─'.repeat(70));

  pattern.events.forEach((ev, i) => {
    const num     = String(i + 1).padStart(4);
    const type    = String(ev.type ?? '?').padEnd(5);
    const x       = String(ev.x).padStart(7);
    const y       = String(ev.y).padStart(7);
    const delta   = i === 0 ? '       —' : `${String(ev.delta).padStart(6)}ms`;
    const elapsed = `${(ev.elapsed / 1000).toFixed(3)}s`;
    lines.push(`${num}  | ${type} | ${x} | ${y} | ${delta} | ${elapsed}`);
  });

  lines.push('─'.repeat(70));

  const deltas = pattern.events.map(e => e.delta).slice(1);
  const buckets = { '<500': 0, '500-800': 0, '800-1200': 0, '1200-1800': 0, '>1800': 0 };
  deltas.forEach(d => {
    if (d < 500)       buckets['<500']++;
    else if (d < 800)  buckets['500-800']++;
    else if (d < 1200) buckets['800-1200']++;
    else if (d < 1800) buckets['1200-1800']++;
    else               buckets['>1800']++;
  });

  lines.push('');
  lines.push('INTERVAL DISTRIBUTION:');
  Object.entries(buckets).forEach(([range, count]) => {
    const pct = Math.round((count / deltas.length) * 100);
    const bar = '█'.repeat(Math.round(pct / 2));
    lines.push(`  ${range.padEnd(12)} ${String(count).padStart(4)}  ${bar} ${pct}%`);
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${pattern.name.replace(/\s+/g, '_')}_pattern.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<style scoped>
.library {
  padding: 28px;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.title {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.sub {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-muted);
  margin-top: 4px;
}

.btn-primary {
  background: var(--color-accent);
  color: #0a0c0f;
  border: none;
  padding: 10px 20px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s;
}
.btn-primary:hover { background: #f8b84e; }

.empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--color-muted);
}
.empty-icon  { font-size: 48px; margin-bottom: 8px; }
.empty-title { font-size: 18px; font-weight: 600; color: var(--color-text); }
.empty-sub   { font-size: 13px; }

.pattern-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pattern-card {
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: border-color 0.15s;
}
.pattern-card:hover { border-color: #2e3850; }

.card-left {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.card-name-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-name {
  font-weight: 700;
  font-size: 15px;
}

.model-badge {
  background: var(--color-surface);
  border: 1px solid var(--color-accent);
  color: var(--color-accent);
  padding: 1px 6px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.card-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.card-stat {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-muted);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: 2px 6px;
}

.card-stat.accent { color: var(--color-accent); border-color: #7c4f0a; }

.card-actions { display: flex; gap: 8px; }

.btn-icon {
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  text-decoration: none;
  transition: all 0.15s;
}

.btn-export { color: var(--color-muted); }
.btn-export:hover { color: var(--color-accent); border-color: var(--color-accent); background: rgba(245,166,35,0.1); }

.btn-delete { color: var(--color-red); }
.btn-delete:hover { background: rgba(239,68,68,0.1); border-color: var(--color-red); }

.btn-play { color: var(--color-green); }
.btn-play:hover { background: rgba(34,197,94,0.1); border-color: var(--color-green); }

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  padding: 28px;
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.modal-title { font-size: 15px; line-height: 1.5; }

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.btn-ghost {
  padding: 8px 16px;
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-muted);
  cursor: pointer;
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s;
}
.btn-ghost:hover { border-color: var(--color-text); color: var(--color-text); }

.btn-danger {
  padding: 8px 16px;
  background: var(--color-red);
  border: none;
  color: white;
  cursor: pointer;
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
  transition: background 0.15s;
}
.btn-danger:hover { background: #dc2626; }
</style>