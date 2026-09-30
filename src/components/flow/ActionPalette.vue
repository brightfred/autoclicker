<template>
  <!-- Right-side panel: everything I can drag into the flow -->
  <aside class="palette">
    <div class="palette-head">
      <div class="head-row">
        <div class="panel-title">Add to flow</div>
        <!-- Forgot a target? Draw it now and come right back -->
        <button class="new-target" title="Draw a new target for this sequence's setup" @click="$emit('new-target')">+ New target</button>
      </div>
      <input v-model="search" class="input search" placeholder="Search…" />
    </div>

    <div class="palette-scroll">
      <!-- Built-in actions (not targets) -->
      <section v-if="builtIns.length" class="group">
        <div class="group-title">Actions</div>
        <div
          v-for="a in builtIns" :key="a.type"
          class="card" :class="{ locked: busy }" :style="{ '--c': ACTION_TYPES[a.type].color }"
          :draggable="!busy"
          @dragstart="$emit('drag-start', $event, () => ACTION_TYPES[a.type].create({ targets }))"
          @dragend="$emit('drag-end')"
          @click="!busy && $emit('add', ACTION_TYPES[a.type].create({ targets }))"
        >
          <span class="card-icon">{{ ACTION_TYPES[a.type].icon }}</span>
          <span class="card-text">
            <span class="card-name">{{ ACTION_TYPES[a.type].label }}</span>
            <span class="card-sub">{{ a.sub }}</span>
          </span>
        </div>
      </section>

      <!-- Logic: If / Go to (for "repeat until" loops) -->
      <section v-if="logic.length" class="group">
        <div class="group-title">Logic</div>
        <div
          v-for="a in logic" :key="a.type"
          class="card" :class="{ locked: busy }" :style="{ '--c': ACTION_TYPES[a.type].color }"
          :draggable="!busy"
          @dragstart="$emit('drag-start', $event, () => ACTION_TYPES[a.type].create({ targets }))"
          @dragend="$emit('drag-end')"
          @click="!busy && $emit('add', ACTION_TYPES[a.type].create({ targets }))"
        >
          <span class="card-icon">{{ ACTION_TYPES[a.type].icon }}</span>
          <span class="card-text">
            <span class="card-name">{{ ACTION_TYPES[a.type].label }}</span>
            <span class="card-sub">{{ a.sub }}</span>
          </span>
        </div>
      </section>

      <!-- Walk to a minimap spot / tile -->
      <section class="group">
        <div class="group-title">Walk to</div>
        <p v-if="walkTargets.length === 0" class="empty-hint">
          Draw a <strong>Minimap spot</strong> or <strong>Tile</strong> — <a href="#" @click.prevent="$emit('new-target')">+ New target</a>.
        </p>
        <div
          v-for="t in walkTargets" :key="t.id"
          class="card" :class="{ locked: busy }" :style="{ '--c': getKind(t.kind).color }"
          :draggable="!busy"
          @dragstart="$emit('drag-start', $event, () => ACTION_TYPES.walk.create({ targetId: t.id }))"
          @dragend="$emit('drag-end')"
          @click="!busy && $emit('add', ACTION_TYPES.walk.create({ targetId: t.id }))"
        >
          <span class="card-icon">{{ getKind(t.kind).icon }}</span>
          <span class="card-text">
            <span class="card-name">{{ t.name }}</span>
            <span class="card-sub">{{ getKind(t.kind).label }}</span>
          </span>
        </div>
      </section>

      <!-- Find & click things highlighted in a color (RuneLite markers) -->
      <section class="group">
        <div class="group-title">Find &amp; click</div>
        <p v-if="colorTargets.length === 0" class="empty-hint">
          Draw a <strong>Color finder</strong> over the game view (for RuneLite-marked trees…) — <a href="#" @click.prevent="$emit('new-target')">+ New target</a>.
        </p>
        <div
          v-for="t in colorTargets" :key="t.id"
          class="card" :class="{ locked: busy }" :style="{ '--c': getKind(t.kind).color }"
          :draggable="!busy"
          @dragstart="$emit('drag-start', $event, () => ACTION_TYPES.clickColor.create({ targetId: t.id, targets }))"
          @dragend="$emit('drag-end')"
          @click="!busy && $emit('add', ACTION_TYPES.clickColor.create({ targetId: t.id, targets }))"
        >
          <span class="card-icon">{{ getKind(t.kind).icon }}</span>
          <span class="card-text">
            <span class="card-name">{{ t.name }}</span>
            <span class="card-sub"><span class="swatch" :style="{ background: t.color }" /> nearest highlighted</span>
          </span>
        </div>
      </section>

      <!-- Wait until a "Check area" looks the same / changes -->
      <section class="group">
        <div class="group-title">Wait until</div>
        <p v-if="watchTargets.length === 0" class="empty-hint">
          Draw a <strong>Check area</strong> (bank open, slot empty…) — <a href="#" @click.prevent="$emit('new-target')">+ New target</a>.
        </p>
        <div
          v-for="t in watchTargets" :key="t.id"
          class="card" :class="{ locked: busy }" :style="{ '--c': getKind(t.kind).color }"
          :draggable="!busy"
          @dragstart="$emit('drag-start', $event, () => ACTION_TYPES.waitUntil.create({ targetId: t.id }))"
          @dragend="$emit('drag-end')"
          @click="!busy && $emit('add', ACTION_TYPES.waitUntil.create({ targetId: t.id }))"
        >
          <span class="card-icon">{{ getKind(t.kind).icon }}</span>
          <span class="card-text">
            <span class="card-name">{{ t.name }}</span>
            <span class="card-sub">{{ t.snapshot ? 'Check area' : 'Check area · no snapshot yet' }}</span>
          </span>
        </div>
      </section>

      <!-- Click a target -->
      <section class="group">
        <div class="group-title">Click</div>
        <p v-if="clickTargets.length === 0" class="empty-hint">
          No targets in this setup yet — <a href="#" @click.prevent="$emit('new-target')">+ New target</a>.
        </p>
        <div
          v-for="t in clickTargets" :key="t.id"
          class="card" :class="{ locked: busy }" :style="{ '--c': getKind(t.kind).color }"
          :draggable="!busy"
          @dragstart="$emit('drag-start', $event, () => ACTION_TYPES.click.create({ targetId: t.id, kind: t.kind }))"
          @dragend="$emit('drag-end')"
          @click="!busy && $emit('add', ACTION_TYPES.click.create({ targetId: t.id, kind: t.kind }))"
        >
          <span class="card-icon">{{ getKind(t.kind).icon }}</span>
          <span class="card-text">
            <span class="card-name">{{ t.name }}</span>
            <span class="card-sub">{{ getKind(t.kind).label }}</span>
          </span>
        </div>
      </section>
    </div>

    <p class="palette-hint">Drag onto the flow, or click to add at the end.</p>
  </aside>
</template>

<script setup>
import { ref, computed } from 'vue';
import { ACTION_TYPES } from '../../sequence/actionTypes.js';
import { getKind, WALK_KINDS, WATCH_KINDS } from '../../utils/targetGeometry.js';

const props = defineProps({
  targets: { type: Array, required: true },
  busy:    { type: Boolean, default: false },
});
defineEmits(['drag-start', 'drag-end', 'add', 'new-target']);

// Built-in actions that aren't tied to a target
const BUILT_INS = [
  { type: 'wait',       sub: 'Wait a set time' },
  { type: 'key',        sub: 'Esc, Space, 1–9, F-keys' },
  { type: 'breakpoint', sub: 'Where a break may happen' },
  { type: 'camera',     sub: 'North · top tilt · max zoom' },
];

// If / Go to — jumps between steps
const LOGIC = [
  { type: 'if',   sub: 'Check an area → jump if true' },
  { type: 'goto', sub: 'Jump to a step (repeat until…)' },
];

const search = ref('');
const matches = (text) => text.toLowerCase().includes(search.value.trim().toLowerCase());

const builtIns     = computed(() => BUILT_INS.filter(a => matches(ACTION_TYPES[a.type].label)));
const logic        = computed(() => LOGIC.filter(a => matches(ACTION_TYPES[a.type].label)));
const walkTargets  = computed(() => props.targets.filter(t => WALK_KINDS.includes(t.kind) && matches(t.name)));
const watchTargets = computed(() => props.targets.filter(t => WATCH_KINDS.includes(t.kind) && matches(t.name)));
const colorTargets = computed(() => props.targets.filter(t => t.kind === 'color' && matches(t.name)));
// Minimap spots are only for walking, check areas only for watching, color
// finders have their own section; tiles can be clicked too (e.g. the campfire)
const clickTargets = computed(() => props.targets.filter(t =>
  !['minimap', 'color'].includes(t.kind) && !WATCH_KINDS.includes(t.kind) && matches(t.name)));
</script>

<style scoped>
.palette {
  width: 236px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}
.palette-head { padding: 12px 12px 8px; display: flex; flex-direction: column; gap: 8px; border-bottom: 1px solid var(--color-border); }
.head-row { display: flex; align-items: center; justify-content: space-between; }
.new-target {
  padding: 3px 8px;
  background: transparent;
  border: 1px solid var(--color-accent);
  color: var(--color-accent);
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.new-target:hover { background: rgba(245, 166, 35, 0.12); }
.search { padding: 5px 8px; font-size: 13px; }
.palette-scroll { flex: 1; overflow-y: auto; padding: 8px 12px; display: flex; flex-direction: column; gap: 14px; }

.group { display: flex; flex-direction: column; gap: 6px; }
.group-title { font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-muted); }

.card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--c);
  cursor: grab;
  transition: all 0.15s;
}
.card:hover:not(.locked) { border-color: var(--c); background: color-mix(in srgb, var(--c) 8%, var(--color-panel)); transform: translateX(-2px); }
.card:active:not(.locked) { cursor: grabbing; }
.card.locked { opacity: 0.4; cursor: default; }
.card-icon { width: 20px; flex-shrink: 0; text-align: center; color: var(--c); font-size: 14px; }
.card-text { display: flex; flex-direction: column; min-width: 0; }
.card-name { font-size: 13px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-sub  { font-size: 11px; color: var(--color-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.swatch { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 3px; vertical-align: middle; }
.empty-hint { font-size: 12px; color: var(--color-muted); line-height: 1.45; }
.empty-hint a { color: var(--color-accent); }
.palette-hint { padding: 8px 12px 10px; font-size: 11px; color: var(--color-muted); border-top: 1px solid var(--color-border); }
</style>
