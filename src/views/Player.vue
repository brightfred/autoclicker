<template>
  <div class="player">

    <!-- Header -->
    <div class="player-header">
      <button @click="router.push('/')" class="btn-back">← Back</button>
      <div>
        <h1 class="player-title">{{ pattern?.name }}</h1>
        <p class="player-sub">{{ pattern?.clickCount }} clicks · {{ durationFmt(pattern?.totalDuration) }} · avg {{ pattern?.avgInterval }}ms</p>
      </div>
    </div>

    <div class="player-body">

      <!-- Left: Config -->
      <div class="config-panel">

        <!-- Repetitions -->
        <section class="config-section">
          <h2 class="section-title">Repetitions</h2>
          <div class="reps-row">
            <button @click="reps = Math.max(1, reps - 1)" :disabled="playing" class="btn-counter">−</button>
            <span class="reps-value">{{ reps }}</span>
            <button @click="reps++" :disabled="playing" class="btn-counter">+</button>
          </div>
          <p class="config-label">{{ reps * (pattern?.clickCount || 0) }} total clicks</p>
        </section>

        <!-- Timing Variance -->
        <section class="config-section">
          <h2 class="section-title">Timing Variance</h2>
          <div class="slider-row">
            <label class="config-label">Factor: {{ varianceFactor.toFixed(1) }}x</label>
            <input type="range" v-model.number="varianceFactor" min="0.5" max="2.0" step="0.1" :disabled="playing" class="slider" />
          </div>
          <p class="config-label hint">1.0 = your natural timing. Higher = more variation.</p>
        </section>

        <!-- AFK Pauses -->
        <section class="config-section">
          <h2 class="section-title">AFK Pauses</h2>
          <div class="slider-row">
            <label class="config-label">Chance: {{ Math.round(afkChance * 100) }}% per cast</label>
            <input type="range" v-model.number="afkChance" min="0" max="0.1" step="0.005" :disabled="playing" class="slider" />
          </div>
          <div class="slider-row">
            <label class="config-label">Min: {{ afkMinSec }}s</label>
            <input type="range" v-model.number="afkMinSec" min="1" max="30" :disabled="playing" class="slider" />
          </div>
          <div class="slider-row">
            <label class="config-label">Max: {{ afkMaxSec }}s</label>
            <input type="range" v-model.number="afkMaxSec" min="1" max="60" :disabled="playing" class="slider" />
          </div>
        </section>

        <!-- Hotkey -->
        <section class="config-section">
          <h2 class="section-title">Hotkey</h2>
          <p class="config-label">F6 — toggle start / stop</p>
        </section>

      </div>

      <!-- Right: Dashboard -->
      <div class="dashboard">

        <div class="dash-stats">
          <div class="stat-card">
            <span class="stat-label">Status</span>
            <span class="stat-value" :class="afkActive ? 'text-yellow' : playing ? 'text-green' : 'text-muted'">
              {{ afkActive ? 'AFK' : playing ? 'RUNNING' : 'IDLE' }}
            </span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Rep</span>
            <span class="stat-value">{{ currentRep }} / {{ reps }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Casts</span>
            <span class="stat-value font-mono">{{ totalCasts }}</span>
          </div>
        </div>

        <div class="progress-bar-wrap">
          <div class="progress-bar" :style="{ width: progressPct + '%' }"></div>
        </div>
        <p class="progress-label">{{ totalCasts }} / {{ reps * (pattern?.clickCount || 0) }}</p>

        <div class="dash-controls">
          <button v-if="!playing" @click="startPlayback" class="btn-play">
            ▶ Start (F6)
          </button>
          <button v-else @click="stopPlayback" class="btn-stop-play">
            ■ Stop (F6)
          </button>
        </div>

        <p class="hotkey-hint">Press F6 anytime to toggle playback</p>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePatternsStore } from '../stores/patterns.js';

const route = useRoute();
const router = useRouter();
const store = usePatternsStore();

const pattern = computed(() => store.getPattern(route.params.id));

// Config
const reps = ref(10);
const varianceFactor = ref(1.0);
const afkChance = ref(0.01);
const afkMinSec = ref(3);
const afkMaxSec = ref(15);

// State
const playing = ref(false);
const currentRep = ref(0);
const totalCasts = ref(0);
const afkActive = ref(false);

const progressPct = computed(() => {
  const total = reps.value * (pattern.value?.clickCount || 0);
  if (total === 0) return 0;
  return Math.min(100, (totalCasts.value / total) * 100);
});

function durationFmt(ms) {
  if (!ms) return '0s';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function buildConfig() {
  return {
    reps: reps.value,
    varianceFactor: varianceFactor.value,
    afkChance: afkChance.value,
    afkMinMs: afkMinSec.value * 1000,
    afkMaxMs: afkMaxSec.value * 1000,
  };
}

import { toRaw } from 'vue'

async function startPlayback() {
  if (!pattern.value) return
  totalCasts.value = 0
  currentRep.value = 0
  playing.value = true
  await window.electronAPI.registerHotkey()
  window.electronAPI.startPlayback(toRaw(pattern.value), buildConfig())
}
async function stopPlayback() {
  await window.electronAPI.stopPlayback();
  await window.electronAPI.unregisterHotkey();
  playing.value = false;
}

onMounted(() => {
  window.electronAPI.onPlaybackStatus((status) => {
    playing.value = status.playing;
    if (status.cast !== undefined) totalCasts.value = status.cast;
    if (status.rep !== undefined) currentRep.value = status.rep;
    if (status.afk !== undefined) afkActive.value = status.afk;
    if (status.done) {
      playing.value = false;
      window.electronAPI.unregisterHotkey();
    }
  });

  window.electronAPI.onHotkeyPlay(async () => {
    if (!playing.value) await startPlayback();
  });
});

onUnmounted(() => {
  window.electronAPI.offPlaybackStatus();
  window.electronAPI.offHotkeyPlay();
  if (playing.value) window.electronAPI.stopPlayback();
  window.electronAPI.unregisterHotkey();
});
</script>

<style scoped>
.player {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.player-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.btn-back {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-muted);
  padding: 6px 12px;
  font-family: var(--font-display);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-back:hover { color: var(--color-text); border-color: var(--color-muted); }

.player-title {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.player-sub {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-muted);
  margin-top: 2px;
}

.player-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.config-panel {
  width: 240px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.config-section {
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border);
}
.config-section:last-child { border-bottom: none; }

.section-title {
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-muted);
  margin-bottom: 10px;
}

.config-label {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-muted);
}

.hint {
  margin-top: 4px;
  font-size: 10px;
  opacity: 0.7;
}

.slider-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}

.slider {
  width: 100%;
  accent-color: var(--color-accent);
}

.reps-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.btn-counter {
  width: 28px;
  height: 28px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-counter:hover:not(:disabled) { border-color: var(--color-accent); }
.btn-counter:disabled { opacity: 0.4; cursor: not-allowed; }

.reps-value {
  font-family: var(--font-mono);
  font-size: 18px;
  color: var(--color-accent);
  min-width: 32px;
  text-align: center;
}

.dashboard {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  gap: 24px;
}

.dash-stats {
  display: flex;
  gap: 16px;
}

.stat-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 100px;
}

.stat-label {
  font-family: var(--font-display);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-muted);
}

.stat-value {
  font-family: var(--font-mono);
  font-size: 20px;
  color: var(--color-text);
}

.text-green { color: var(--color-green); }
.text-yellow { color: var(--color-accent); }
.text-muted { color: var(--color-muted); }
.font-mono { font-family: var(--font-mono); }

.progress-bar-wrap {
  width: 100%;
  max-width: 400px;
  height: 4px;
  background: var(--color-border);
}

.progress-bar {
  height: 100%;
  background: var(--color-accent);
  transition: width 0.3s ease;
}

.progress-label {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-muted);
}

.dash-controls { display: flex; gap: 12px; }

.btn-play {
  padding: 14px 40px;
  background: var(--color-accent);
  color: #000;
  border: none;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-play:hover { opacity: 0.85; }

.btn-stop-play {
  padding: 14px 40px;
  background: var(--color-red);
  color: white;
  border: none;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-stop-play:hover { opacity: 0.85; }

.hotkey-hint {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-muted);
}
</style>