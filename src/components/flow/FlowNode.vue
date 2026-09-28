<template>
  <!-- One step of the flow, as a card: type + number on top, its settings below -->
  <div class="node" :class="{ active, skipped, invalid: !!issue }" :style="{ '--c': type.color }">
    <span
      class="handle"
      :class="{ locked: busy }"
      title="Drag to reorder"
      @mousedown="$emit('grab')"
      @mouseup="$emit('release')"
    >⋮⋮</span>

    <div class="node-icon">{{ type.icon }}</div>

    <div class="node-main">
      <div class="node-head">
        <span class="node-type">{{ type.label }}</span>
        <span class="node-num">#{{ index + 1 }}</span>
        <span v-if="mode !== 'always'" class="loop-badge" :title="LOOP_MODES[mode].title">{{ LOOP_MODES[mode].badge }}</span>
        <span class="spacer" />
        <!-- every loop → 1st loop only → from loop 2 -->
        <button class="mini" :class="{ on: mode !== 'always' }" :disabled="busy" :title="`${LOOP_MODES[mode].title} — click to change`" @click="cycleLoopMode(step)">{{ LOOP_MODES[mode].icon }}</button>
        <button class="mini" :disabled="busy" title="Duplicate" @click="$emit('duplicate')">⧉</button>
        <button class="mini danger" :disabled="busy" title="Remove" @click="$emit('remove')">✕</button>
      </div>

      <div class="node-body">
        <!-- Click a target (inventory → pick the slot) -->
        <template v-if="step.type === 'click'">
          <TargetSelect v-model="step.targetId" :targets="targets" :disabled="busy" @update:model-value="onTargetChange" />
          <template v-if="target?.kind === 'inventory'">
            <span class="word">slot</span>
            <select v-model.number="step.slot" class="select sm slot" :disabled="busy">
              <option v-for="n in SLOT_COUNT" :key="n" :value="n">{{ n }}</option>
            </select>
          </template>
          <button
            class="chip"
            :class="{ on: step.button === 'right' }"
            :disabled="busy"
            :title="`${step.button === 'right' ? 'Right' : 'Left'} click — click to switch`"
            @click="step.button = step.button === 'right' ? 'left' : 'right'"
          >{{ step.button === 'right' ? 'Right' : 'Left' }}</button>
        </template>

        <!-- Walk: click a minimap spot / tile, then wait while walking -->
        <template v-else-if="step.type === 'walk'">
          <TargetSelect v-model="step.targetId" :targets="targets" :disabled="busy" />
          <span class="word">then walk</span>
          <TimeRange v-model:min="step.minMs" v-model:max="step.maxMs" :disabled="busy" />
        </template>

        <!-- Pause -->
        <template v-else-if="step.type === 'wait'">
          <span class="word">for</span>
          <TimeRange v-model:min="step.minMs" v-model:max="step.maxMs" :disabled="busy" />
        </template>

        <!-- Press key -->
        <template v-else-if="step.type === 'key'">
          <select v-model="step.key" class="select sm" :disabled="busy">
            <option v-for="k in KEY_OPTIONS" :key="k.value" :value="k.value">{{ k.label }}</option>
          </select>
        </template>

        <!-- Reset camera: each part can be switched on/off -->
        <template v-else-if="step.type === 'camera'">
          <!-- Each part on its own line: switch + the target it needs -->
          <div class="cam-row">
            <button class="chip" :class="{ on: step.faceNorth }" :disabled="busy" title="Click the compass → face north" @click="step.faceNorth = !step.faceNorth">North</button>
            <template v-if="step.faceNorth">
              <span class="word">compass:</span>
              <TargetSelect v-model="step.compassTargetId" :targets="targets" placeholder="choose your compass target" :disabled="busy" />
            </template>
          </div>
          <div class="cam-row">
            <button class="chip" :class="{ on: step.pitchUp }" :disabled="busy" title="Hold the Up arrow → camera tilts to the top" @click="step.pitchUp = !step.pitchUp">Tilt</button>
            <span v-if="step.pitchUp" class="note">holds the ↑ key ~2s</span>
          </div>
          <div class="cam-row">
            <button class="chip" :class="{ on: step.zoomOut }" :disabled="busy" title="Scroll out over the game view → max zoom out" @click="step.zoomOut = !step.zoomOut">Zoom</button>
            <template v-if="step.zoomOut">
              <span class="word">scroll over:</span>
              <TargetSelect v-model="step.viewTargetId" :targets="targets" placeholder="choose a spot in the game view" :disabled="busy" />
            </template>
          </div>
        </template>

        <!-- Break point -->
        <template v-else-if="step.type === 'breakpoint'">
          <span class="note">{{ efficiency >= 1 ? 'No breaks at 100% efficiency' : 'A break may happen here' }}</span>
        </template>
      </div>

      <p v-if="issue" class="node-issue">⚠ {{ issue }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import TargetSelect from './TargetSelect.vue';
import TimeRange from './TimeRange.vue';
import { ACTION_TYPES, KEY_OPTIONS } from '../../sequence/actionTypes.js';
import { LOOP_MODES, loopMode, cycleLoopMode } from '../../sequence/loopModes.js';
import { stepIssue } from '../../sequence/stepIssues.js';
import { INV_COLS, INV_ROWS } from '../../utils/targetGeometry.js';

const SLOT_COUNT = INV_COLS * INV_ROWS;

// I edit fields of `step` directly — it's the store's object, which auto-saves
const props = defineProps({
  step:       { type: Object, required: true },
  index:      { type: Number, required: true },
  targets:    { type: Array, required: true },
  targetById: { type: Map, required: true },
  busy:       { type: Boolean, default: false },
  active:     { type: Boolean, default: false },
  skipped:    { type: Boolean, default: false },
  efficiency: { type: Number, default: 1 },
});
defineEmits(['remove', 'duplicate', 'grab', 'release']);

const type   = computed(() => ACTION_TYPES[props.step.type] ?? { label: props.step.type, icon: '?', color: '#64748b' });
const target = computed(() => props.targetById.get(props.step.targetId));
const mode   = computed(() => loopMode(props.step));
const issue  = computed(() => stepIssue(props.step, props.targetById));

// Switching a click to/from an inventory target needs a slot (or not)
function onTargetChange() {
  props.step.slot = target.value?.kind === 'inventory' ? (props.step.slot ?? 1) : null;
}
</script>

<style scoped>
.node {
  display: flex;
  align-items: stretch;
  gap: 10px;
  padding: 10px 12px 10px 6px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--c);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s;
}
.node:hover { border-color: #2e3850; border-left-color: var(--c); }
.node.invalid { border-color: rgba(239, 68, 68, 0.5); border-left-color: var(--color-red); }
.node.skipped { opacity: 0.4; }
.node.active {
  border-color: var(--color-green);
  border-left-color: var(--color-green);
  background: color-mix(in srgb, var(--color-green) 9%, var(--color-panel));
  box-shadow: 0 0 0 1px var(--color-green), 0 0 18px rgba(34, 197, 94, 0.25);
}

.handle { align-self: center; color: var(--color-muted); cursor: grab; letter-spacing: -2px; padding: 0 2px; }
.handle:hover:not(.locked) { color: var(--color-text); }
.handle.locked { opacity: 0.3; cursor: default; }

.node-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  color: var(--c);
  background: color-mix(in srgb, var(--c) 12%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--c) 35%, transparent);
}

.node-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.node-head { display: flex; align-items: center; gap: 8px; min-height: 22px; }
.node-type { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--c); }
.node-num  { font-family: var(--font-mono); font-size: 10px; color: var(--color-muted); }
.spacer { flex: 1; }
.loop-badge {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-accent);
  border: 1px dashed var(--color-accent);
  padding: 0 5px;
}

.node-body { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.cam-row { display: flex; align-items: center; gap: 6px; width: 100%; }
.cam-row .chip { width: 58px; }
.word { font-size: 12px; color: var(--color-muted); }
.note { font-size: 12px; color: var(--color-muted); font-style: italic; }
.node-issue { font-size: 12px; color: var(--color-red); font-weight: 600; }

.select.sm { padding: 4px 8px; font-size: 13px; }
.select.slot { width: 56px; }

.mini {
  width: 24px;
  height: 22px;
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  cursor: pointer;
  transition: all 0.15s;
}
.mini:hover:not(:disabled) { color: var(--color-text); border-color: var(--color-text); }
.mini.on { color: var(--color-accent); border-color: var(--color-accent); }
.mini.danger:hover:not(:disabled) { color: var(--color-red); border-color: var(--color-red); }
.mini:disabled { opacity: 0.4; cursor: default; }

.chip {
  height: 26px;
  padding: 0 9px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
}
.chip.on { color: var(--c); border-color: var(--c); background: color-mix(in srgb, var(--c) 10%, var(--color-surface)); }
.chip:disabled { opacity: 0.5; cursor: default; }
</style>
