<template>
  <div class="recorder">

    <!-- Header -->
    <div class="rec-header">
      <h1 class="rec-title">New Recording</h1>
      <p class="rec-sub">Select a model, then click anywhere on screen. Every click will be captured.</p>
    </div>

    <!-- State: idle -->
    <div v-if="state === 'idle'" class="rec-body">

      <!-- Model selector -->
      <div class="model-select-wrap">
        <label class="model-label">Model</label>
        <select v-model="selectedModelId" class="model-select">
          <option v-for="model in allModels" :key="model.id" :value="model.id">
            {{ model.name }}
          </option>
        </select>
        <p class="model-description">{{ selectedModel?.description }}</p>
      </div>

      <!-- Legend — driven by selected model -->
      <div class="legend">
        <span
          v-for="(item, i) in selectedModel?.recorderConfig.legend"
          :key="i"
          class="legend-item"
          :class="`legend-type-${i}`"
        >
          {{ item.label }}
        </span>
      </div>

      <button @click="startCountdown" class="btn-primary" :disabled="!selectedModelId">
        ◉ Start Recording
      </button>

    </div>

    <!-- State: countdown -->
    <div v-if="state === 'countdown'" class="rec-body countdown-body">
      <div class="countdown-number">{{ countdown }}</div>
      <p class="countdown-label">Recording starts in...</p>
    </div>

    <!-- State: recording -->
    <div v-if="state === 'recording'" class="rec-body recording-body">
      <div class="rec-status">
        <span class="rec-dot animate-pulse-record">●</span>
        <span class="rec-model">{{ selectedModel?.name }}</span>
        <span class="rec-time">{{ elapsedFormatted }}</span>
        <span class="rec-count">{{ events.length }} clicks</span>
        <button @click="stopRecording" class="btn-stop">■ Stop</button>
      </div>

      <div class="event-log" ref="logEl">
        <div v-if="events.length === 0" class="log-empty">
          Waiting for clicks...
        </div>
        <div
          v-for="(ev, i) in events"
          :key="i"
          class="log-row"
          :class="`log-type-${ev.type}`"
        >
          <span class="log-index">#{{ i + 1 }}</span>
          <span class="log-type-label">{{ ev.type }}</span>
          <span class="log-pos">{{ ev.x }}, {{ ev.y }}</span>
          <span class="log-delta">+{{ ev.delta }}ms</span>
        </div>
      </div>
    </div>

    <!-- State: saving -->
    <div v-if="state === 'saving'" class="rec-body saving-body">
      <div class="save-card">
        <p class="save-info">
          {{ pendingStats?.clickCount }} clicks ·
          {{ durationFormatted(pendingStats?.totalDuration) }} ·
          <span class="save-model">{{ selectedModel?.name }}</span>
        </p>
        <input
          v-model="patternName"
          class="name-input"
          placeholder="Pattern name..."
          @keydown.enter="savePattern"
          ref="nameInputEl"
        />
        <div class="save-actions">
          <button @click="discardPattern" class="btn-ghost">Discard</button>
          <button @click="savePattern" class="btn-primary" :disabled="!patternName.trim()">
            Save Pattern
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { usePatternsStore } from '../stores/patterns.js';
import { getAllModels } from '../models/index.js';

const router = useRouter();
const store  = usePatternsStore();

// All available models for the dropdown
const allModels = getAllModels();

const state           = ref('idle');
const selectedModelId = ref(allModels[0]?.id ?? null);
const countdown       = ref(3);
const events          = ref([]);
const elapsedMs       = ref(0);
const pendingStats    = ref(null);
const patternName     = ref('');
const logEl           = ref(null);
const nameInputEl     = ref(null);

let elapsedTimer   = null;
let countdownTimer = null;

const selectedModel = computed(() =>
  allModels.find(m => m.id === selectedModelId.value) ?? null
);

const elapsedFormatted = computed(() => {
  const s  = Math.floor(elapsedMs.value / 1000);
  const ms = String(elapsedMs.value % 1000).padStart(3, '0');
  return `${s}.${ms}s`;
});

function durationFormatted(ms) {
  if (!ms) return '0s';
  return `${(ms / 1000).toFixed(1)}s`;
}

function startCountdown() {
  state.value    = 'countdown';
  countdown.value = 3;
  countdownTimer = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) {
      clearInterval(countdownTimer);
      beginRecording();
    }
  }, 1000);
}

async function beginRecording() {
  events.value   = [];
  elapsedMs.value = 0;
  state.value    = 'recording';

  window.electronAPI.onRecordingEvent((ev) => {
    events.value.push(ev);
    nextTick(() => {
      if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight;
    });
  });

  elapsedTimer = setInterval(() => { elapsedMs.value += 100; }, 100);

  // Pass modelId to main process so it loads the right model
  await window.electronAPI.startRecording(selectedModelId.value);
}

async function stopRecording() {
  clearInterval(elapsedTimer);
  window.electronAPI.offRecordingEvent();

  const stats    = await window.electronAPI.stopRecording();
  pendingStats.value = stats;
  patternName.value  = '';
  state.value        = 'saving';

  nextTick(() => nameInputEl.value?.focus());
}

function savePattern() {
  if (!patternName.value.trim()) return;
  store.addPattern({
    name: patternName.value.trim(),
    ...pendingStats.value,
  });
  router.push('/');
}

function discardPattern() {
  pendingStats.value = null;
  state.value        = 'idle';
}

onUnmounted(() => {
  clearInterval(elapsedTimer);
  clearInterval(countdownTimer);
  window.electronAPI.offRecordingEvent();
});
</script>

<style scoped>
.recorder {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 32px;
  gap: 24px;
  overflow: hidden;
}

.rec-title {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text);
}

.rec-sub {
  color: var(--color-muted);
  font-size: 13px;
  margin-top: 4px;
}

.rec-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

/* ── Model selector ── */
.model-select-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.model-label {
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-muted);
}

.model-select {
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  padding: 8px 32px 8px 14px;
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%2364748b' d='M6 8L0 0h12z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  min-width: 220px;
  transition: border-color 0.15s;
}
.model-select:focus { border-color: var(--color-accent); }

.model-description {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-muted);
  text-align: center;
  max-width: 320px;
}

/* ── Legend ── */
.legend {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.legend-item {
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 4px 12px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-muted);
}

/* First legend entry — accent purple */
.legend-type-0 { color: #a78bfa; border-color: #4c1d95; }
/* Second legend entry — accent green */
.legend-type-1 { color: #34d399; border-color: #064e3b; }

/* ── Buttons ── */
.btn-primary {
  padding: 12px 32px;
  background: var(--color-accent);
  color: #000;
  border: none;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-primary:hover:not(:disabled) { opacity: 0.85; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-stop {
  padding: 8px 20px;
  background: var(--color-red);
  color: white;
  border: none;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-stop:hover { opacity: 0.85; }

.btn-ghost {
  padding: 10px 24px;
  background: transparent;
  color: var(--color-muted);
  border: 1px solid var(--color-border);
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-ghost:hover { color: var(--color-text); border-color: var(--color-muted); }

/* ── Countdown ── */
.countdown-number {
  font-family: var(--font-mono);
  font-size: 96px;
  color: var(--color-accent);
  line-height: 1;
}
.countdown-label {
  color: var(--color-muted);
  font-size: 14px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* ── Recording state ── */
.recording-body {
  align-items: stretch;
  justify-content: flex-start;
  gap: 12px;
}

.rec-status {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.rec-dot   { color: var(--color-red); font-size: 16px; }
.rec-model { font-family: var(--font-display); font-size: 13px; font-weight: 700; color: var(--color-accent); letter-spacing: 0.08em; text-transform: uppercase; }
.rec-time  { font-family: var(--font-mono); font-size: 16px; color: var(--color-text); }
.rec-count { font-family: var(--font-mono); font-size: 13px; color: var(--color-muted); flex: 1; }

.event-log {
  flex: 1;
  overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: 8px 0;
}

.log-empty {
  text-align: center;
  color: var(--color-muted);
  font-size: 13px;
  padding: 32px;
}

.log-row {
  display: flex;
  gap: 16px;
  padding: 4px 16px;
  font-family: var(--font-mono);
  font-size: 12px;
  border-bottom: 1px solid var(--color-border);
  border-left: 2px solid var(--color-border);
}
.log-row:last-child { border-bottom: none; }

/* Dynamic type colors — first type purple, second green, fallback muted */
.log-type-spell, .log-type-slotA { border-left-color: #4c1d95; }
.log-type-item,  .log-type-slotB { border-left-color: #064e3b; }
.log-type-click                  { border-left-color: var(--color-accent); }

.log-index      { color: var(--color-muted); width: 32px; }
.log-type-label { width: 56px; color: var(--color-muted); }
.log-pos        { color: var(--color-text); width: 80px; }
.log-delta      { color: var(--color-accent); }

/* ── Saving state ── */
.saving-body { justify-content: center; }

.save-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 400px;
}

.save-info {
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: 13px;
  text-align: center;
}

.save-model {
  color: var(--color-accent);
  font-weight: 700;
}

.name-input {
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  padding: 10px 14px;
  font-family: var(--font-display);
  font-size: 15px;
  outline: none;
  transition: border-color 0.15s;
}
.name-input:focus { border-color: var(--color-accent); }
.name-input::placeholder { color: var(--color-muted); }

.save-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
</style>