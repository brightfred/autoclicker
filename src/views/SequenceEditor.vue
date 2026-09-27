<template>
  <div v-if="seq" class="editor">

    <!-- Header: name + run controls -->
    <header class="editor-header">
      <button class="btn-ghost back" @click="router.push('/')">←</button>
      <input v-model="seq.name" class="name-input" maxlength="40" :disabled="busy" />

      <div class="status-pill" :class="[`is-${run.state}`, { 'is-break': run.onBreak }]">
        <template v-if="run.state === 'countdown'">Starting in {{ run.countdown }}…</template>
        <template v-else-if="run.state === 'running' && run.onBreak">
          ☕ {{ run.onBreak.label }} · {{ breakLeft }}
        </template>
        <template v-else-if="run.state === 'running'">
          Loop {{ run.loop }}{{ seq.loops > 0 ? ` / ${seq.loops}` : '' }} · Step {{ run.step + 1 }} / {{ seq.actions.length }}
        </template>
        <template v-else>Idle</template>
      </div>

      <button v-if="!busy" class="btn-primary run-btn" :disabled="seq.actions.length === 0" @click="beginCountdown">
        ▶ Start <kbd>F6</kbd>
      </button>
      <button v-else class="btn-stop run-btn" @click="stop">
        ■ {{ run.state === 'countdown' ? 'Cancel' : 'Stop' }} <kbd>F6</kbd>
      </button>
    </header>

    <!-- Settings bar -->
    <div class="settings-bar">
      <label class="setting">
        <span class="field-label">Setup</span>
        <select v-model="seq.setupId" class="select" :disabled="busy">
          <option v-for="s in setups" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </label>

      <label class="setting">
        <span class="field-label">Loops</span>
        <input
          type="number" min="1" max="100000"
          class="input num"
          :value="seq.loops > 0 ? seq.loops : ''"
          :placeholder="seq.loops > 0 ? '' : '∞'"
          :disabled="busy || seq.loops === 0"
          @change="setLoops($event.target.value)"
        />
      </label>
      <label class="check">
        <input type="checkbox" :checked="seq.loops === 0" :disabled="busy" @change="seq.loops = $event.target.checked ? 0 : 10" />
        <span>Forever</span>
      </label>

      <span class="settings-spacer" />
      <span class="stat">{{ seq.actions.length }} step{{ seq.actions.length !== 1 ? 's' : '' }}</span>
      <span class="stat" title="Rough time for one loop, using the middle of each wait">≈ {{ loopEstimate }} / loop</span>
    </div>

    <!-- Efficiency: how often / how long I take breaks -->
    <div class="efficiency-bar">
      <div class="eff-row">
        <span class="field-label">Efficiency</span>
        <input
          type="range" min="50" max="100" step="1"
          class="slider"
          :value="Math.round(seq.efficiency * 100)"
          :disabled="busy"
          :style="{ '--fill': `${(seq.efficiency * 100 - 50) * 2}%` }"
          @input="seq.efficiency = Number($event.target.value) / 100"
        />
        <span class="eff-value">{{ Math.round(seq.efficiency * 100) }}%</span>
        <span class="eff-mood">{{ mood }}</span>

        <label class="setting">
          <span class="field-label">Profile</span>
          <select v-model="seq.breakProfile" class="select sm" :disabled="busy || seq.efficiency >= 1">
            <option v-for="(p, id) in profiles" :key="id" :value="id">{{ p.label }}</option>
          </select>
        </label>
        <button class="btn-icon sm" title="Edit break profiles (efficiency.json)" @click="openProfiles">⚙</button>
      </div>

      <!-- Live numbers while running, last run's numbers after, otherwise a hint -->
      <div class="eff-info">
        <template v-if="stats">
          <span class="stat" title="Time spent working">▶ working {{ fmtTime(stats.activeMs) }}</span>
          <span class="stat" title="Time spent on breaks">☕ {{ stats.breaks }} break{{ stats.breaks !== 1 ? 's' : '' }} · {{ fmtTime(stats.breakMs) }}</span>
          <span class="stat accent" title="Real efficiency so far">real {{ realEfficiency }}</span>
        </template>
        <span v-else class="eff-hint">{{ efficiencyHint }}</span>
      </div>
    </div>

    <!-- Problems found when I tried to start -->
    <div v-if="problems.length" class="problems">
      <div class="problems-head">
        <span>Can't start — fix these first:</span>
        <button class="btn-small" @click="problems = []">Dismiss</button>
      </div>
      <p v-for="(p, i) in problems" :key="i">• {{ p }}</p>
    </div>

    <div class="editor-body">

      <!-- The flow: Start → steps (in order) → back to Start -->
      <section
        class="canvas"
        :class="{ dragging: dropIndex !== null }"
        @dragover.prevent="onCanvasDragOver"
        @drop.prevent="onDrop"
      >
        <div class="flow">
          <div class="terminal start">
            <span class="terminal-icon">▶</span>
            <span>Start</span>
            <span class="terminal-sub">{{ seq.loops > 0 ? `${seq.loops} loop${seq.loops !== 1 ? 's' : ''}` : 'loops forever' }}</span>
          </div>

          <template v-for="(step, i) in seq.actions" :key="step.id">
            <!-- Connector: a drop slot between two steps -->
            <div class="link" :class="{ hot: dropIndex === i }" @dragover.prevent.stop="dropIndex = i">
              <span class="link-plus">+</span>
            </div>

            <FlowNode
              :step="step"
              :index="i"
              :targets="targets"
              :target-by-id="targetById"
              :busy="busy"
              :efficiency="seq.efficiency"
              :active="run.state === 'running' && run.stepId === step.id"
              :skipped="run.state === 'running' && isSkipped(step, run.loop)"
              :class="{ moving: dragFrom === i }"
              :draggable="!busy && handleIndex === i"
              @dragstart="startNodeDrag($event, i)"
              @dragend="endDrag"
              @dragover.prevent.stop="onNodeDragOver($event, i)"
              @grab="handleIndex = i"
              @release="handleIndex = null"
              @duplicate="duplicateStep(i)"
              @remove="seq.actions.splice(i, 1)"
            />
          </template>

          <!-- Last slot (or the big empty drop zone) -->
          <div
            v-if="seq.actions.length === 0"
            class="drop-zone"
            :class="{ hot: dropIndex === 0 }"
            @dragover.prevent.stop="dropIndex = 0"
          >
            <span class="drop-icon">⇣</span>
            <span class="drop-title">Drag an action here</span>
            <span class="drop-sub">from the panel on the right — steps run top to bottom, then loop</span>
          </div>
          <div
            v-else
            class="link"
            :class="{ hot: dropIndex === seq.actions.length }"
            @dragover.prevent.stop="dropIndex = seq.actions.length"
          >
            <span class="link-plus">+</span>
          </div>

          <div class="terminal end">
            <span class="terminal-icon">↻</span>
            <span>{{ seq.loops === 1 ? 'Done' : 'Back to Start' }}</span>
          </div>
        </div>
      </section>

      <!-- Right panel: actions + targets to drag in -->
      <ActionPalette
        :targets="targets"
        :busy="busy"
        @drag-start="startPaletteDrag"
        @drag-end="endDrag"
        @add="append"
      />
    </div>

    <transition name="fade">
      <div v-if="toast" class="toast" :class="toast.type">{{ toast.text }}</div>
    </transition>
  </div>

  <!-- Sequence not found (deleted / bad link) -->
  <div v-else-if="seqStore.loaded" class="page">
    <div class="empty">
      <p class="empty-title">This sequence doesn't exist anymore</p>
      <button class="btn-primary" @click="router.push('/')">← Back to sequences</button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useSequencesStore } from '../stores/sequences';
import { useTargetsStore } from '../stores/targets';
import { cloneStep } from '../sequence/actionTypes.js';
import { isSkipped } from '../sequence/loopModes.js';
import { stepDurationMs } from '../sequence/stepIssues.js';
import FlowNode from '../components/flow/FlowNode.vue';
import ActionPalette from '../components/flow/ActionPalette.vue';

const COUNTDOWN_SEC = 3;

const route       = useRoute();
const router      = useRouter();
const seqStore    = useSequencesStore();
const targetStore = useTargetsStore();
const { setups }  = storeToRefs(targetStore);

// I edit the store's object directly — the store auto-saves every change
const seq        = computed(() => seqStore.getSequence(route.params.id));
const setup      = computed(() => setups.value.find(s => s.id === seq.value?.setupId));
const targets    = computed(() => setup.value?.targets ?? []);
const targetById = computed(() => new Map(targets.value.map(t => [t.id, t])));

// ── Run state ────────────────────────────────────────────────────────────────

const run = reactive({ state: 'idle', countdown: 0, loop: 0, step: 0, stepId: null, onBreak: null, breakEndsAt: 0 });
const stats    = ref(null);      // { activeMs, breakMs, breaks } — live, then last run's
const profiles = ref({});        // break profiles from efficiency.json
const now      = ref(Date.now()); // ticks while running, for the break countdown
let ticker = null;
const busy     = computed(() => run.state !== 'idle');
const problems = ref([]);
let countdownTimer = null;

// ── Efficiency ───────────────────────────────────────────────────────────────

const MOODS = [
  [1.00, 'No breaks'],
  [0.93, 'Locked in'],
  [0.85, 'Focused'],
  [0.75, 'Relaxed'],
  [0.65, 'Casual'],
  [0,    'Distracted'],
];

const mood = computed(() => MOODS.find(([min]) => seq.value.efficiency >= min)[1]);

const breakPointCount = computed(() => seq.value.actions.filter(a => a.type === 'breakpoint').length);

const efficiencyHint = computed(() => {
  if (seq.value.efficiency >= 1) return 'Never takes a break';
  const perHour = Math.round(60 * (1 - seq.value.efficiency));
  const where = breakPointCount.value > 0
    ? `at ${breakPointCount.value} break point${breakPointCount.value !== 1 ? 's' : ''}`
    : 'at the end of each loop';
  return `≈ ${perHour} min of breaks / hour, ${where}`;
});

const realEfficiency = computed(() => {
  const { activeMs, breakMs } = stats.value;
  const total = activeMs + breakMs;
  return total > 0 ? `${((activeMs / total) * 100).toFixed(1)}%` : '—';
});

const breakLeft = computed(() => fmtTime(Math.max(0, run.breakEndsAt - now.value)));

// Open efficiency.json in my editor, then reload it when I come back
async function openProfiles() {
  await window.electronAPI.openEfficiencyFile();
}

async function reloadProfiles() {
  profiles.value = (await window.electronAPI.loadEfficiency()).profiles;
}

function fmtTime(ms) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${String(m % 60).padStart(2, '0')}m`;
  return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const toast = ref(null);
let toastTimer = null;
function showToast(text, type = 'ok') {
  clearTimeout(toastTimer);
  toast.value = { text, type };
  toastTimer = setTimeout(() => (toast.value = null), 3200);
}

function setLoops(value) {
  const n = Math.round(Number(value));
  seq.value.loops = n >= 1 ? n : 1;
}

// Rough duration of one loop (middle of each wait + ~0.7s per click/key)
const loopEstimate = computed(() => {
  const ms = (seq.value?.actions ?? []).reduce((sum, step) => sum + stepDurationMs(step), 0);
  return ms >= 60000 ? `${(ms / 60000).toFixed(1)} min` : `${(ms / 1000).toFixed(1)} s`;
});

function append(step) {
  seq.value.actions.push(step);
}

function duplicateStep(i) {
  seq.value.actions.splice(i + 1, 0, cloneStep(seq.value.actions[i]));
}

// ── Drag and drop ────────────────────────────────────────────────────────────
// I keep what's being dragged in memory (the browser's dataTransfer can only be
// read on drop). Palette cards insert a new step; nodes move an existing one.
// dropIndex = the connector slot that lights up (0 = before the first step).

const dropIndex   = ref(null);  // slot that's lit up
const dragFrom    = ref(null);  // index of the node being moved (null = from palette)
const handleIndex = ref(null);  // node whose ⋮⋮ handle is held (only then it's draggable)
let makeStep      = null;       // creates the new step when dragging from the palette

function startPaletteDrag(e, factory) {
  makeStep = factory;
  dragFrom.value = null;
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('text/plain', 'step');
}

function startNodeDrag(e, index) {
  makeStep = null;
  dragFrom.value = index;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', 'step');
}

// Over a node: top half → slot above it, bottom half → slot below it
function onNodeDragOver(e, index) {
  const box = e.currentTarget.getBoundingClientRect();
  dropIndex.value = e.clientY < box.top + box.height / 2 ? index : index + 1;
}

// Empty canvas space → drop at the end
function onCanvasDragOver(e) {
  if (!e.target.closest('.node, .link, .drop-zone')) {
    dropIndex.value = seq.value.actions.length;
  }
}

function onDrop() {
  const list = seq.value.actions;
  const to = dropIndex.value ?? list.length;

  if (makeStep) {
    list.splice(to, 0, makeStep());
  } else if (dragFrom.value !== null) {
    const from = dragFrom.value;
    const [moved] = list.splice(from, 1);
    list.splice(from < to ? to - 1 : to, 0, moved);
  }
  endDrag();
}

function endDrag() {
  dropIndex.value   = null;
  dragFrom.value    = null;
  handleIndex.value = null;
  makeStep = null;
}

// ── Running ──────────────────────────────────────────────────────────────────

function plainCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

async function beginCountdown() {
  if (busy.value) return;

  // Check everything BEFORE the countdown, so I don't wait 3s for an error
  problems.value = await window.electronAPI.validateSequence(plainCopy(seq.value), plainCopy(targets.value));
  if (problems.value.length) return;

  run.state = 'countdown';
  run.countdown = COUNTDOWN_SEC;
  countdownTimer = setInterval(() => {
    run.countdown--;
    if (run.countdown <= 0) {
      clearInterval(countdownTimer);
      start();
    }
  }, 1000);
}

async function start() {
  stats.value = null;
  run.state = 'running';
  run.loop = 1;
  run.step = 0;
  run.stepId = null;
  const ok = await window.electronAPI.startSequence(plainCopy(seq.value), plainCopy(targets.value));
  if (!ok) {
    run.state = 'idle';
    showToast('Another sequence is already running', 'error');
  }
}

function stop() {
  if (run.state === 'countdown') {
    clearInterval(countdownTimer);
    run.state = 'idle';
    return;
  }
  window.electronAPI.stopSequence();
}

function onStatus(status) {
  if ('activeMs' in status) {
    stats.value = { activeMs: status.activeMs, breakMs: status.breakMs, breaks: status.breaks };
  }
  if (status.running) {
    run.state   = 'running';
    run.loop    = status.loop;
    run.step    = status.step;
    run.stepId  = status.stepId;
    run.onBreak = status.onBreak ?? null;
    if (status.onBreak) run.breakEndsAt = Date.now() + status.onBreak.ms;
    return;
  }
  if (status.done) {
    run.state   = 'idle';
    run.stepId  = null;
    run.onBreak = null;
    if (status.problems) problems.value = status.problems;
    else if (status.error) showToast(`Stopped: ${status.error}`, 'error');
    else showToast(status.stopped ? 'Stopped' : 'Finished all loops');
  }
}

// Keep the running step on screen in long flows (e.g. 27 logs = 80+ steps)
watch(() => run.stepId, async (id) => {
  if (!id) return;
  await nextTick();
  document.querySelector('.canvas .node.active')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

// F6 when idle → start countdown, during countdown → cancel.
// (While running, main stops it directly on F6.)
function onHotkey() {
  if (run.state === 'countdown') stop();
  else if (run.state === 'idle' && seq.value?.actions.length) beginCountdown();
}

onMounted(async () => {
  if (!seqStore.loaded) await seqStore.load();
  if (!targetStore.loaded) await targetStore.load();

  await reloadProfiles();
  window.addEventListener('focus', reloadProfiles); // picks up my edits to efficiency.json
  ticker = setInterval(() => { now.value = Date.now(); }, 250);

  window.electronAPI.onSequenceStatus(onStatus);
  window.electronAPI.onHotkeyPlay(onHotkey);
  window.electronAPI.registerHotkey('F6');
});

onBeforeUnmount(() => {
  clearInterval(countdownTimer);
  clearInterval(ticker);
  window.removeEventListener('focus', reloadProfiles);
  if (run.state === 'running') window.electronAPI.stopSequence();
  window.electronAPI.offSequenceStatus();
  window.electronAPI.offHotkeyPlay();
  window.electronAPI.unregisterHotkey('F6');
});
</script>

<style scoped>
.editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 20px 28px 16px;
  gap: 12px;
}

/* ── Header ── */
.editor-header { display: flex; align-items: center; gap: 10px; }
.back { padding: 8px 12px; }
.name-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: 1px solid transparent;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 4px 8px;
  outline: none;
  user-select: text;
  -webkit-user-select: text;
}
.name-input:hover:not(:disabled) { border-color: var(--color-border); }
.name-input:focus { border-color: var(--color-accent); background: var(--color-panel); }

.status-pill {
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  color: var(--color-muted);
  white-space: nowrap;
}
.status-pill.is-countdown { color: var(--color-accent); border-color: var(--color-accent); }
.status-pill.is-running   { color: var(--color-green); border-color: var(--color-green); }
.status-pill.is-break     { color: var(--color-accent); border-color: var(--color-accent); }

.run-btn { display: flex; align-items: center; gap: 8px; }
.run-btn kbd {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 1px 4px;
  border: 1px solid currentColor;
  opacity: 0.7;
}
.btn-stop {
  background: var(--color-red);
  color: white;
  border: none;
  padding: 9px 18px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
}
.btn-stop:hover { background: #dc2626; }

/* ── Settings ── */
.settings-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 14px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}
.setting { display: flex; align-items: center; gap: 8px; }
.check { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--color-muted); cursor: pointer; }
.check input { accent-color: var(--color-accent); }
.settings-spacer { flex: 1; }

/* ── Efficiency ── */
.efficiency-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 14px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}
.eff-row  { display: flex; align-items: center; gap: 12px; white-space: nowrap; }
.eff-info { display: flex; align-items: center; gap: 8px; min-height: 22px; }
.slider {
  -webkit-appearance: none;
  appearance: none;
  flex: 1;
  min-width: 120px;
  height: 4px;
  background: linear-gradient(to right, var(--color-accent) var(--fill), var(--color-border) var(--fill));
  outline: none;
  cursor: pointer;
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  background: var(--color-accent);
  border: 2px solid var(--color-bg);
  box-shadow: 0 0 0 1px var(--color-accent);
  cursor: pointer;
}
.slider:disabled { opacity: 0.5; cursor: default; }
.eff-value { font-family: var(--font-mono); font-size: 14px; color: var(--color-accent); width: 40px; }
.eff-mood  { font-size: 12px; font-weight: 700; color: var(--color-muted); text-transform: uppercase; letter-spacing: 0.08em; width: 84px; }
.eff-hint  { font-size: 12px; color: var(--color-muted); }
.stat.accent { color: var(--color-accent); border-color: #7c4f0a; }
.step.skipped { opacity: 0.4; }
.chip {
  height: 26px;
  padding: 0 8px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
}
.chip.on { color: var(--c); border-color: var(--c); background: color-mix(in srgb, var(--c) 10%, var(--color-surface)); }
.chip:disabled { opacity: 0.5; cursor: default; }
.first-badge {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-accent);
  border: 1px dashed var(--color-accent);
  padding: 1px 5px;
}
.btn-icon.once { font-family: var(--font-mono); font-size: 10px; }
.btn-icon.once.on { color: var(--color-accent); border-color: var(--color-accent); background: rgba(245, 166, 35, 0.1); }
.step-note { font-size: 12px; color: var(--color-muted); font-style: italic; }

/* ── Problems ── */
.problems {
  border: 1px solid var(--color-red);
  background: rgba(239, 68, 68, 0.08);
  padding: 10px 14px;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.problems-head { display: flex; justify-content: space-between; align-items: center; font-weight: 700; color: var(--color-red); }

/* ── Body ── */
.editor-body { flex: 1; display: flex; gap: 12px; min-height: 0; }

/* The canvas: dotted background like a flow builder */
.canvas {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 20px 16px 40px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg);
  background-image: radial-gradient(circle, #1a2130 1px, transparent 1.2px);
  background-size: 18px 18px;
}
.flow { max-width: 560px; margin: 0 auto; display: flex; flex-direction: column; align-items: stretch; }

.terminal {
  align-self: center;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 16px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}
.terminal.start { color: var(--color-green); border-color: rgba(34, 197, 94, 0.5); }
.terminal.end   { color: var(--color-muted); }
.terminal-icon { font-size: 12px; }
.terminal-sub { font-family: var(--font-mono); font-size: 11px; font-weight: 400; letter-spacing: 0; text-transform: none; color: var(--color-muted); }

/* Connector between steps — a vertical line with a + that lights up on drag */
.link {
  position: relative;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: height 0.15s;
}
.link::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  background: var(--color-border);
}
.link-plus {
  position: relative;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 12px;
  line-height: 1;
  color: var(--color-muted);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  opacity: 0;
  transition: all 0.15s;
}
.canvas.dragging .link { height: 34px; }
.canvas.dragging .link-plus { opacity: 1; }
.link.hot::before { background: var(--color-accent); box-shadow: 0 0 6px var(--color-accent); }
.link.hot .link-plus { opacity: 1; width: 24px; height: 24px; color: #0a0c0f; background: var(--color-accent); border-color: var(--color-accent); }

.moving { opacity: 0.35; }

/* Empty flow */
.drop-zone {
  margin: 14px 0;
  padding: 34px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  border: 2px dashed var(--color-border);
  color: var(--color-muted);
  background: rgba(17, 19, 24, 0.6);
  transition: all 0.15s;
}
.drop-zone.hot { border-color: var(--color-accent); background: rgba(245, 166, 35, 0.06); color: var(--color-text); }
.drop-icon  { font-size: 26px; }
.drop-title { font-size: 15px; font-weight: 700; color: var(--color-text); }
.drop-sub   { font-size: 12px; }
</style>
