<template>
  <!-- One of these runs full-screen on each monitor, on top of the game -->
  <div
    v-if="data"
    class="overlay"
    :class="[`mode-${data.mode}`]"
    @mousedown.left="onDown"
    @mousemove="onMove"
    @mouseup.left="onUp"
    @contextmenu.prevent="cancel"
    @click="data.mode === 'show' && cancel()"
  >

    <!-- Instruction banner -->
    <div class="banner" :style="{ '--kind': kindColor }">
      <template v-if="data.mode === 'select'">
        <span class="banner-icon">{{ kind.icon }}</span>
        <span>Drag a box over <strong>{{ data.label || kind.label }}</strong></span>
        <span v-if="data.kind === 'inventory'" class="banner-hint">cover all 28 slots, edge to edge</span>
        <span v-else-if="data.kind === 'tile'" class="banner-hint">one tile, zoomed out fully</span>
        <span class="banner-keys"><kbd>Esc</kbd> or right-click to cancel</span>
      </template>
      <template v-else>
        <span class="banner-icon">◎</span>
        <span>Showing <strong>{{ visibleTargets.length }}</strong> target{{ visibleTargets.length !== 1 ? 's' : '' }}</span>
        <span class="banner-keys">click anywhere or <kbd>Esc</kbd> to close</span>
      </template>
    </div>

    <!-- Saved targets -->
    <div
      v-for="t in visibleTargets"
      :key="t.id"
      class="target"
      :class="{ faint: data.mode === 'select' }"
      :style="boxStyle(t.rect, colorOf(t.kind))"
    >
      <span class="target-label" :style="{ background: colorOf(t.kind) }">{{ t.name }}</span>
      <template v-if="t.kind === 'inventory'">
        <div
          v-for="s in localSlots(t.rect)"
          :key="s.slot"
          class="slot"
          :style="slotStyle(s, t.rect)"
        ><span v-if="data.mode === 'show'" class="slot-num">{{ s.slot }}</span></div>
      </template>
    </div>

    <!-- Crosshair that follows my mouse (select mode) -->
    <template v-if="data.mode === 'select' && mouse">
      <div class="guide guide-h" :style="{ top: `${mouse.y}px` }" />
      <div class="guide guide-v" :style="{ left: `${mouse.x}px` }" />
      <div class="coords" :style="{ left: `${mouse.x + 14}px`, top: `${mouse.y + 14}px` }">
        {{ Math.round(mouse.x + data.display.x) }}, {{ Math.round(mouse.y + data.display.y) }}
      </div>
    </template>

    <!-- The box I'm currently dragging -->
    <div v-if="dragRect" class="drag" :style="boxStyle(absolute(dragRect), kindColor)">
      <span class="drag-size" :style="{ background: kindColor }">{{ dragRect.w }} × {{ dragRect.h }}</span>
      <template v-if="data.kind === 'inventory'">
        <div
          v-for="s in inventorySlots(dragRect)"
          :key="s.slot"
          class="slot"
          :style="slotStyle(s, dragRect)"
        />
      </template>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { getKind, inventorySlots, rectFromPoints } from '../utils/targetGeometry.js';

const data     = ref(null);  // { mode, kind, label, highlightId, display, targets }
const start    = ref(null);  // drag start point (local to this monitor)
const current  = ref(null);  // drag current point
const mouse    = ref(null);  // live mouse position for the crosshair

const MIN_SIZE = 4; // anything smaller is a misclick, not a box

const kind      = computed(() => getKind(data.value?.kind));
const kindColor = computed(() => kind.value.color);

// In 'show' mode with a highlight, I only draw that single target
const visibleTargets = computed(() => {
  if (!data.value) return [];
  const { targets, highlightId } = data.value;
  return highlightId ? targets.filter(t => t.id === highlightId) : targets;
});

// Drag rect in local (this monitor) coordinates
const dragRect = computed(() => {
  if (!start.value || !current.value) return null;
  return rectFromPoints(start.value, current.value);
});

function colorOf(kindId) {
  return getKind(kindId).color;
}

// Local rect → absolute desktop rect (what main expects)
function absolute(r) {
  return { ...r, x: r.x + data.value.display.x, y: r.y + data.value.display.y };
}

// Saved targets are absolute → position them relative to this monitor
function boxStyle(rect, color) {
  return {
    left:   `${rect.x - data.value.display.x}px`,
    top:    `${rect.y - data.value.display.y}px`,
    width:  `${rect.w}px`,
    height: `${rect.h}px`,
    '--c':  color,
  };
}

// Inventory slots positioned inside their parent box.
// I subtract the parent's 2px border, since children are placed inside the border.
const BORDER = 2;
function slotStyle(slot, parent) {
  return {
    left:   `${slot.x - parent.x - BORDER}px`,
    top:    `${slot.y - parent.y - BORDER}px`,
    width:  `${slot.w}px`,
    height: `${slot.h}px`,
  };
}

function localSlots(rect) {
  return inventorySlots(rect);
}

// ── Mouse handling (select mode) ───────────────────────────────────────────

function onDown(e) {
  if (data.value?.mode !== 'select') return;
  start.value   = { x: e.clientX, y: e.clientY };
  current.value = { ...start.value };
}

function onMove(e) {
  mouse.value = { x: e.clientX, y: e.clientY };
  if (start.value) current.value = { x: e.clientX, y: e.clientY };
}

function onUp() {
  if (data.value?.mode !== 'select' || !dragRect.value) return;
  const rect = dragRect.value;
  start.value = current.value = null;

  // Too small = I probably just clicked; keep waiting for a real drag
  if (rect.w < MIN_SIZE || rect.h < MIN_SIZE) return;
  window.electronAPI.sendOverlayResult(absolute(rect));
}

function cancel() {
  window.electronAPI.sendOverlayResult(null);
}

function onKey(e) {
  if (e.key === 'Escape') cancel();
}

onMounted(async () => {
  // The overlay window must be see-through — override the app's dark background
  document.documentElement.style.background = 'transparent';
  document.body.style.background = 'transparent';

  data.value = await window.electronAPI.getOverlayData();
  window.addEventListener('keydown', onKey);
});

onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  overflow: hidden;
  font-family: var(--font-display);
}

/* A light dim so I can see the overlay is active (and so it catches my clicks) */
.mode-select { background: rgba(5, 7, 10, 0.28); cursor: crosshair; }
.mode-show   { background: rgba(5, 7, 10, 0.18); cursor: pointer; }

.banner {
  position: absolute;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
  background: rgba(17, 19, 24, 0.94);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--kind);
  color: var(--color-text);
  font-size: 15px;
  letter-spacing: 0.03em;
  white-space: nowrap;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  pointer-events: none;
  z-index: 10;
}
.banner strong     { color: var(--kind); }
.banner-icon       { color: var(--kind); font-size: 18px; }
.banner-hint       { color: var(--color-muted); font-size: 13px; }
.banner-keys       { color: var(--color-muted); font-size: 12px; border-left: 1px solid var(--color-border); padding-left: 12px; }
kbd {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 1px 5px;
  border: 1px solid var(--color-border);
  background: var(--color-panel);
  color: var(--color-text);
}

.target, .drag {
  position: absolute;
  border: 2px solid var(--c);
  background: color-mix(in srgb, var(--c) 14%, transparent);
  box-sizing: border-box;
  pointer-events: none;
}
.target.faint { opacity: 0.45; border-style: dashed; }
.drag { background: color-mix(in srgb, var(--c) 20%, transparent); }

.target-label, .drag-size {
  position: absolute;
  top: -22px;
  left: -2px;
  padding: 2px 7px;
  color: #0a0c0f;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.drag-size { font-family: var(--font-mono); font-weight: 400; }

.slot {
  position: absolute;
  box-sizing: border-box;
  border: 1px solid color-mix(in srgb, var(--c) 55%, transparent);
}
.slot-num {
  position: absolute;
  top: 1px;
  left: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--c);
  text-shadow: 0 0 3px #000;
}

.guide {
  position: absolute;
  background: rgba(245, 166, 35, 0.35);
  pointer-events: none;
}
.guide-h { left: 0; right: 0; height: 1px; }
.guide-v { top: 0; bottom: 0; width: 1px; }

.coords {
  position: absolute;
  padding: 2px 6px;
  background: rgba(17, 19, 24, 0.9);
  border: 1px solid var(--color-border);
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  pointer-events: none;
}
</style>
