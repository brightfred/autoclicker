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

      <!-- Palette: things I can drag into the sequence -->
      <aside class="palette">
        <div class="panel-title">Actions</div>
        <div
          v-for="type in ['wait', 'key', 'breakpoint']"
          :key="type"
          class="palette-item"
          :class="{ locked: busy }"
          :style="{ '--c': ACTION_TYPES[type].color }"
          :draggable="!busy"
          @dragstart="startPaletteDrag($event, () => ACTION_TYPES[type].create())"
          @dragend="endDrag"
          @click="!busy && append(ACTION_TYPES[type].create())"
        >
          <span class="p-icon">{{ ACTION_TYPES[type].icon }}</span>
          <span class="p-name">{{ ACTION_TYPES[type].label }}</span>
          <span class="p-add">+</span>
        </div>

        <div class="panel-title palette-gap">Click a target</div>
        <div v-if="targets.length === 0" class="palette-empty">
          This setup has no targets yet.<br />
          <router-link to="/targets">Draw some in Targets →</router-link>
        </div>
        <div
          v-for="t in targets"
          :key="t.id"
          class="palette-item"
          :class="{ locked: busy }"
          :style="{ '--c': getKind(t.kind).color }"
          :draggable="!busy"
          :title="getKind(t.kind).hint"
          @dragstart="startPaletteDrag($event, () => ACTION_TYPES.click.create({ targetId: t.id, kind: t.kind }))"
          @dragend="endDrag"
          @click="!busy && append(ACTION_TYPES.click.create({ targetId: t.id, kind: t.kind }))"
        >
          <span class="p-icon">{{ getKind(t.kind).icon }}</span>
          <span class="p-name">{{ t.name }}</span>
          <span class="p-add">+</span>
        </div>

        <p class="palette-hint">Drag into the list, or click to add at the end.</p>
      </aside>

      <!-- The steps, in order -->
      <section
        class="steps"
        :class="{ 'drag-over': dropIndex !== null }"
        @dragover.prevent="onListDragOver"
        @drop.prevent="onDrop"
      >
        <div v-if="seq.actions.length === 0" class="steps-empty" :class="{ hot: dropIndex !== null }">
          <div class="empty-icon">⇣</div>
          <p class="empty-title">Drop steps here</p>
          <p class="empty-sub">They run top to bottom, then loop back to the first one.</p>
        </div>

        <template v-for="(step, i) in seq.actions" :key="step.id">
          <div v-if="dropIndex === i" class="drop-line" />

          <div
            class="step"
            :class="{
              active: run.state === 'running' && run.stepId === step.id,
              dragging: dragFrom === i,
              invalid: !!stepIssue(step),
              skipped: step.firstLoopOnly && run.state === 'running' && run.loop > 1,
            }"
            :style="{ '--c': ACTION_TYPES[step.type]?.color }"
            :draggable="!busy && handleIndex === i"
            @dragstart="startRowDrag($event, i)"
            @dragend="endDrag"
            @dragover.prevent.stop="onRowDragOver($event, i)"
          >
            <span
              class="handle"
              :class="{ locked: busy }"
              title="Drag to reorder"
              @mousedown="handleIndex = i"
              @mouseup="handleIndex = null"
            >⋮⋮</span>
            <span class="step-num">{{ i + 1 }}</span>
            <span class="step-icon">{{ ACTION_TYPES[step.type]?.icon }}</span>

            <div class="step-main">
              <!-- Click -->
              <template v-if="step.type === 'click'">
                <span class="step-verb">Click</span>
                <select v-model="step.targetId" class="select sm" :disabled="busy" @change="onTargetChange(step)">
                  <option v-if="!targetById.get(step.targetId)" :value="step.targetId" disabled>— missing target —</option>
                  <option v-for="t in targets" :key="t.id" :value="t.id">{{ getKind(t.kind).icon }} {{ t.name }}</option>
                </select>
                <template v-if="targetById.get(step.targetId)?.kind === 'inventory'">
                  <span class="step-verb">slot</span>
                  <select v-model.number="step.slot" class="select sm slot" :disabled="busy">
                    <option v-for="n in SLOT_COUNT" :key="n" :value="n">{{ n }}</option>
                  </select>
                </template>
                <!-- Compact left/right toggle so a whole click step fits on one line -->
                <button
                  class="btn-mouse"
                  :class="{ right: step.button === 'right' }"
                  :disabled="busy"
                  :title="`${step.button === 'right' ? 'Right' : 'Left'} click — click to switch`"
                  @click="step.button = step.button === 'right' ? 'left' : 'right'"
                >{{ step.button === 'right' ? 'R' : 'L' }}</button>
              </template>

              <!-- Wait -->
              <template v-else-if="step.type === 'wait'">
                <span class="step-verb">Wait</span>
                <input
                  type="number" min="0" step="0.1" class="input num sm"
                  :value="toSec(step.minMs)" :disabled="busy"
                  @change="step.minMs = fromSec($event.target.value)"
                />
                <span class="step-verb">to</span>
                <input
                  type="number" min="0" step="0.1" class="input num sm"
                  :value="toSec(step.maxMs)" :disabled="busy"
                  @change="step.maxMs = fromSec($event.target.value)"
                />
                <span class="step-verb">sec</span>
              </template>

              <!-- Press key -->
              <template v-else-if="step.type === 'key'">
                <span class="step-verb">Press</span>
                <select v-model="step.key" class="select sm" :disabled="busy">
                  <option v-for="k in KEY_OPTIONS" :key="k.value" :value="k.value">{{ k.label }}</option>
                </select>
              </template>

              <!-- Break point -->
              <template v-else-if="step.type === 'breakpoint'">
                <span class="step-verb">Break point</span>
                <span class="step-note">
                  {{ seq.efficiency >= 1 ? 'no breaks at 100% efficiency' : 'a break may happen here' }}
                </span>
              </template>

              <span v-if="step.firstLoopOnly" class="first-badge" title="Skipped after the first loop">1st loop only</span>
              <span v-if="stepIssue(step)" class="step-issue">⚠ {{ stepIssue(step) }}</span>
            </div>

            <div class="step-actions">
              <button
                class="btn-icon sm once"
                :class="{ on: step.firstLoopOnly }"
                :disabled="busy"
                title="Only do this on the first loop (e.g. withdraw a tinderbox)"
                @click="step.firstLoopOnly = !step.firstLoopOnly"
              >1×</button>
              <button class="btn-icon sm" :disabled="busy" @click="duplicateStep(i)" title="Duplicate">⧉</button>
              <button class="btn-icon sm btn-delete" :disabled="busy" @click="seq.actions.splice(i, 1)" title="Remove">✕</button>
            </div>
          </div>
        </template>

        <div v-if="dropIndex !== null && dropIndex === seq.actions.length && seq.actions.length > 0" class="drop-line" />

        <div v-if="seq.actions.length > 0" class="loop-marker">
          ↻ {{ seq.loops > 0 ? `back to step 1 — ${seq.loops} loop${seq.loops !== 1 ? 's' : ''} total` : 'back to step 1, forever' }}
        </div>
      </section>
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
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useSequencesStore } from '../stores/sequences';
import { useTargetsStore } from '../stores/targets';
import { ACTION_TYPES, KEY_OPTIONS, cloneStep } from '../sequence/actionTypes.js';
import { getKind, INV_COLS, INV_ROWS } from '../utils/targetGeometry.js';

const SLOT_COUNT    = INV_COLS * INV_ROWS;
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

function toSec(ms) {
  return Math.round(ms / 100) / 10;
}

function fromSec(value) {
  return Math.max(0, Math.round(Number(value || 0) * 1000));
}

function setLoops(value) {
  const n = Math.round(Number(value));
  seq.value.loops = n >= 1 ? n : 1;
}

// Quick check shown on each step while editing (the engine does the real check on start)
function stepIssue(step) {
  if (step.type === 'click') {
    const t = targetById.value.get(step.targetId);
    if (!t) return 'target not in this setup';
    if (t.kind === 'inventory' && !(step.slot >= 1 && step.slot <= SLOT_COUNT)) return 'pick a slot';
  }
  if (step.type === 'wait' && step.minMs > step.maxMs) return 'min is bigger than max';
  return null;
}

// Switching a click to/from an inventory target needs a slot (or not)
function onTargetChange(step) {
  const t = targetById.value.get(step.targetId);
  step.slot = t?.kind === 'inventory' ? (step.slot ?? 1) : null;
}

// Rough duration of one loop: middle of each wait + ~0.7s per click/key
const loopEstimate = computed(() => {
  const ms = (seq.value?.actions ?? []).reduce((sum, s) => {
    if (s.type === 'wait') return sum + (s.minMs + s.maxMs) / 2;
    return sum + 700;
  }, 0);
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
// read on drop). Palette items insert a new step; rows move an existing one.

const dropIndex   = ref(null);  // where the blue line is shown
const dragFrom    = ref(null);  // index of the row being moved (null = from palette)
const handleIndex = ref(null);  // row whose ⋮⋮ handle is held (only then it's draggable)
let makeStep      = null;       // creates the new step when dragging from the palette

function startPaletteDrag(e, factory) {
  makeStep = factory;
  dragFrom.value = null;
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('text/plain', 'step');
}

function startRowDrag(e, index) {
  makeStep = null;
  dragFrom.value = index;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', 'step');
}

// Above the middle of a row → insert before it, below → after it
function onRowDragOver(e, index) {
  const box = e.currentTarget.getBoundingClientRect();
  dropIndex.value = e.clientY < box.top + box.height / 2 ? index : index + 1;
}

// Empty space under the last row → drop at the end
function onListDragOver(e) {
  if (e.target === e.currentTarget || seq.value.actions.length === 0) {
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

.palette {
  width: 210px;
  flex-shrink: 0;
  overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.palette-gap { margin-top: 10px; }
.palette-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--c);
  cursor: grab;
  transition: all 0.15s;
}
.palette-item:hover:not(.locked) { border-color: var(--c); background: color-mix(in srgb, var(--c) 8%, var(--color-panel)); }
.palette-item:active:not(.locked) { cursor: grabbing; }
.palette-item.locked { opacity: 0.4; cursor: default; }
.p-icon { color: var(--c); width: 20px; flex-shrink: 0; text-align: center; font-size: 13px; }
.p-name { flex: 1; font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.p-add  { color: var(--color-muted); font-size: 14px; }
.palette-empty { font-size: 12px; color: var(--color-muted); line-height: 1.5; }
.palette-empty a, .palette-hint a { color: var(--color-accent); }
.palette-hint { margin-top: auto; padding-top: 10px; font-size: 11px; color: var(--color-muted); line-height: 1.4; }

/* ── Steps ── */
.steps {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 4px 24px;
  min-width: 0;
}
.steps-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px dashed var(--color-border);
  color: var(--color-muted);
  transition: all 0.15s;
}
.steps-empty.hot { border-color: var(--color-accent); background: rgba(245, 166, 35, 0.05); }

.step {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--c);
  transition: border-color 0.15s, background 0.15s, opacity 0.15s;
}
.step:hover { border-color: #2e3850; border-left-color: var(--c); }
.step.dragging { opacity: 0.35; }
.step.invalid { border-color: rgba(239, 68, 68, 0.5); border-left-color: var(--color-red); }
.step.active {
  border-color: var(--color-green);
  border-left-color: var(--color-green);
  background: color-mix(in srgb, var(--color-green) 10%, var(--color-panel));
  box-shadow: 0 0 0 1px var(--color-green);
}

.handle { color: var(--color-muted); cursor: grab; letter-spacing: -2px; padding: 0 2px; }
.handle:hover:not(.locked) { color: var(--color-text); }
.handle.locked { opacity: 0.3; cursor: default; }
.step-num { font-family: var(--font-mono); font-size: 11px; color: var(--color-muted); width: 20px; text-align: right; }
.step-icon { color: var(--c); width: 20px; flex-shrink: 0; text-align: center; font-size: 14px; }
.step-main { flex: 1; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; min-width: 0; }
.step-verb { font-size: 12px; font-weight: 700; color: var(--color-muted); text-transform: uppercase; letter-spacing: 0.06em; }
.step-issue { font-size: 12px; color: var(--color-red); font-weight: 600; }
.step-actions { display: flex; gap: 4px; }

.select.sm, .input.sm { padding: 4px 8px; font-size: 13px; }
.select.sm { max-width: 160px; }
.select.slot { width: 58px; }
.btn-mouse {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-mouse:hover:not(:disabled) { border-color: var(--color-text); color: var(--color-text); }
.btn-mouse.right { color: var(--color-accent); border-color: var(--color-accent); }
.input.num.sm { width: 64px; }
.btn-icon.sm { width: 26px; height: 26px; font-size: 11px; }

.drop-line {
  height: 2px;
  background: var(--color-accent);
  box-shadow: 0 0 6px var(--color-accent);
  margin: -1px 0;
}

.loop-marker {
  margin-top: 4px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-muted);
  border: 1px dashed var(--color-border);
  text-align: center;
}
</style>
