<template>
  <div class="recorder">

    <!-- Header -->
    <div class="rec-header">
      <h1 class="rec-title">New Recording</h1>
      <p class="rec-sub">Click anywhere on screen. Every click will be captured.</p>
    </div>

    <!-- State: idle -->
    <div v-if="state === 'idle'" class="rec-body">
      <button @click="startCountdown" class="btn-primary">
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
        <span class="rec-time">{{ elapsedFormatted }}</span>
        <span class="rec-count">{{ events.length }} clicks</span>
        <button @click="stopRecording" class="btn-stop">■ Stop</button>
      </div>

      <div class="event-log" ref="logEl">
        <div v-if="events.length === 0" class="log-empty">
          Waiting for clicks...
        </div>
        <div v-for="(ev, i) in events" :key="i" class="log-row">
          <span class="log-index">#{{ i + 1 }}</span>
          <span class="log-pos">{{ ev.x }}, {{ ev.y }}</span>
          <span class="log-delta">+{{ ev.delta }}ms</span>
        </div>
      </div>
    </div>

    <!-- State: saving -->
    <div v-if="state === 'saving'" class="rec-body saving-body">
      <div class="save-card">
        <p class="save-info">{{ pendingStats?.clickCount }} clicks · {{ durationFormatted(pendingStats?.totalDuration) }}</p>
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

const router = useRouter();
const store = usePatternsStore();

const state = ref('idle'); // idle | countdown | recording | saving
const countdown = ref(3);
const events = ref([]);
const elapsedMs = ref(0);
const pendingStats = ref(null);
const patternName = ref('');
const logEl = ref(null);
const nameInputEl = ref(null);

let elapsedTimer = null;
let countdownTimer = null;

const elapsedFormatted = computed(() => {
  const s = Math.floor(elapsedMs.value / 1000);
  const ms = String(elapsedMs.value % 1000).padStart(3, '0');
  return `${s}.${ms}s`;
});

function durationFormatted(ms) {
  if (!ms) return '0s';
  const s = (ms / 1000).toFixed(1);
  return `${s}s`;
}

function startCountdown() {
  state.value = 'countdown';
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
  events.value = [];
  elapsedMs.value = 0;
  state.value = 'recording';

  window.electronAPI.onRecordingEvent((ev) => {
    events.value.push(ev);
    nextTick(() => {
      if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight;
    });
  });

  elapsedTimer = setInterval(() => { elapsedMs.value += 100; }, 100);

  await window.electronAPI.startRecording();
}

async function stopRecording() {
  clearInterval(elapsedTimer);
  window.electronAPI.offRecordingEvent();

  const stats = await window.electronAPI.stopRecording();
  pendingStats.value = stats;
  patternName.value = '';
  state.value = 'saving';

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
  state.value = 'idle';
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
.btn-primary:hover { opacity: 0.85; }
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

.rec-dot { color: var(--color-red); font-size: 16px; }
.rec-time { font-family: var(--font-mono); font-size: 16px; color: var(--color-accent); }
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
}
.log-row:last-child { border-bottom: none; }
.log-index { color: var(--color-muted); width: 32px; }
.log-pos { color: var(--color-text); width: 80px; }
.log-delta { color: var(--color-accent); }

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

.saving-body { justify-content: center; }

.save-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
</style>