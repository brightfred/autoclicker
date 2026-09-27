<template>
  <div class="page">

    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Targets</h1>
        <p class="page-sub">Name the things on screen the clicker will use — banker, tiles, bank items, inventory.</p>
      </div>
      <div class="header-actions">
        <button class="btn-ghost" @click="doImport" title="Import targets from a .json file">⤒ Import</button>
        <button class="btn-ghost" @click="doExport" title="Export all setups to a .json file">⤓ Export</button>
        <button class="btn-primary" :disabled="targets.length === 0" @click="showAll">◎ Show on screen</button>
      </div>
    </div>

    <!-- Setup bar -->
    <div class="setup-bar">
      <label class="field-label" for="setup-select">Setup</label>
      <select id="setup-select" class="select" :value="activeSetup?.id" @change="store.selectSetup($event.target.value)">
        <option v-for="s in setups" :key="s.id" :value="s.id">{{ s.name }} ({{ s.targets.length }})</option>
      </select>
      <button class="btn-small" @click="openPrompt('new-setup')">+ New</button>
      <button class="btn-small" @click="openPrompt('rename-setup', activeSetup)">Rename</button>
      <button class="btn-small danger" :disabled="setups.length <= 1" @click="askDelete('setup', activeSetup)">Delete</button>
    </div>

    <!-- Add a new target -->
    <section class="panel">
      <div class="panel-title">New target</div>

      <div class="kind-grid">
        <button
          v-for="k in TARGET_KINDS"
          :key="k.id"
          class="kind-card"
          :class="{ active: newKind === k.id }"
          :style="{ '--kind': k.color }"
          @click="newKind = k.id"
        >
          <span class="kind-icon">{{ k.icon }}</span>
          <span class="kind-label">{{ k.label }}</span>
          <span class="kind-hint">{{ k.hint }}</span>
        </button>
      </div>

      <div class="add-row">
        <input
          v-model="newName"
          class="input"
          :placeholder="`Name, e.g. ${placeholderFor(newKind)}`"
          maxlength="40"
          @keydown.enter="drawNew"
        />
        <button class="btn-primary" :disabled="busy" @click="drawNew">
          ⬚ Draw on screen
        </button>
      </div>
    </section>

    <!-- Target list -->
    <section class="list-section">
      <div class="panel-title">
        {{ activeSetup?.name }} <span class="count">{{ targets.length }} target{{ targets.length !== 1 ? 's' : '' }}</span>
      </div>

      <div v-if="targets.length === 0" class="empty">
        <div class="empty-icon">⬚</div>
        <p class="empty-title">No targets in this setup yet</p>
        <p class="empty-sub">Pick a type above, give it a name, then draw it on screen.</p>
      </div>

      <div v-else class="target-list">
        <div
          v-for="(t, i) in targets"
          :key="t.id"
          class="target-card"
          :style="{ '--kind': getKind(t.kind).color }"
        >
          <div class="order">
            <button class="order-btn" :disabled="i === 0" @click="store.moveTarget(t.id, -1)" title="Move up">▲</button>
            <button class="order-btn" :disabled="i === targets.length - 1" @click="store.moveTarget(t.id, 1)" title="Move down">▼</button>
          </div>

          <span class="card-icon">{{ getKind(t.kind).icon }}</span>

          <div class="card-body">
            <div class="card-name-row">
              <span class="card-name">{{ t.name }}</span>
              <span class="badge" :style="{ '--badge': getKind(t.kind).color }">{{ getKind(t.kind).label }}</span>
            </div>
            <div class="card-meta">
              <span class="stat">x {{ t.rect.x }} · y {{ t.rect.y }}</span>
              <span class="stat">{{ t.rect.w }} × {{ t.rect.h }} px</span>
              <span v-if="t.kind === 'inventory'" class="stat accent">28 slots · {{ slotSize(t.rect) }}</span>
            </div>
          </div>

          <div class="card-actions">
            <button class="btn-icon" @click="testMove(t)" title="Test move — glide the mouse onto it (no click)">➚</button>
            <button class="btn-icon" @click="locate(t)" title="Show on screen">◎</button>
            <button class="btn-icon" @click="redraw(t)" title="Redraw box">⬚</button>
            <button class="btn-icon" @click="openPrompt('rename-target', t)" title="Rename">✎</button>
            <button class="btn-icon btn-delete" @click="askDelete('target', t)" title="Delete">✕</button>
          </div>
        </div>
      </div>
    </section>

    <!-- Name prompt (new setup / rename) -->
    <div v-if="prompt" class="modal-backdrop" @click.self="prompt = null">
      <form class="modal" @submit.prevent="submitPrompt">
        <p class="modal-title">{{ prompt.title }}</p>
        <input ref="promptInput" v-model="prompt.value" class="input" maxlength="40" />
        <div class="modal-actions">
          <button type="button" class="btn-ghost" @click="prompt = null">Cancel</button>
          <button type="submit" class="btn-primary" :disabled="!prompt.value.trim()">Save</button>
        </div>
      </form>
    </div>

    <!-- Delete confirmation -->
    <div v-if="toDelete" class="modal-backdrop" @click.self="toDelete = null">
      <div class="modal">
        <p class="modal-title">
          Delete {{ toDelete.type }} "<strong>{{ toDelete.item.name }}</strong>"?
          <span v-if="toDelete.type === 'setup'" class="modal-sub">All {{ toDelete.item.targets.length }} targets inside it will be deleted too.</span>
        </p>
        <div class="modal-actions">
          <button class="btn-ghost" @click="toDelete = null">Cancel</button>
          <button class="btn-danger" @click="doDelete">Delete</button>
        </div>
      </div>
    </div>

    <!-- Small status message -->
    <transition name="fade">
      <div v-if="toast" class="toast" :class="toast.type">{{ toast.text }}</div>
    </transition>

  </div>
</template>

<script setup>
import { ref, nextTick, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useTargetsStore } from '../stores/targets';
import { TARGET_KINDS, getKind, INV_COLS, INV_ROWS } from '../utils/targetGeometry.js';

const store = useTargetsStore();
const { setups, activeSetup, targets } = storeToRefs(store);

const newKind     = ref('zone');
const newName     = ref('');
const busy        = ref(false);   // true while the overlay is open
const prompt      = ref(null);    // { mode, title, value, item }
const promptInput = ref(null);
const toDelete    = ref(null);    // { type: 'setup'|'target', item }
const toast       = ref(null);
let toastTimer    = null;

const PLACEHOLDERS = {
  zone:      'GE Banker',
  tile:      'Fire tile',
  item:      'Bank: Logs',
  inventory: 'Inventory',
  minimap:   'Minimap: back to bank',
};

function placeholderFor(kindId) {
  return PLACEHOLDERS[kindId] ?? 'Target';
}

function slotSize(rect) {
  return `${Math.round(rect.w / INV_COLS)}×${Math.round(rect.h / INV_ROWS)} each`;
}

function showToast(text, type = 'ok') {
  clearTimeout(toastTimer);
  toast.value = { text, type };
  toastTimer = setTimeout(() => (toast.value = null), 2800);
}

// Everything else in this setup, drawn faintly while I draw a new box
function otherTargets(exceptId = null) {
  return JSON.parse(JSON.stringify(targets.value.filter(t => t.id !== exceptId)));
}

// ── Drawing ────────────────────────────────────────────────────────────────

async function drawNew() {
  if (busy.value) return;
  const name = newName.value.trim() || placeholderFor(newKind.value);

  busy.value = true;
  try {
    const rect = await window.electronAPI.selectOnScreen({
      kind: newKind.value,
      label: name,
      targets: otherTargets(),
    });
    if (rect) {
      store.addTarget({ name, kind: newKind.value, rect });
      newName.value = '';
      showToast(`"${name}" saved`);
    }
  } finally {
    busy.value = false;
  }
}

async function redraw(target) {
  if (busy.value) return;
  busy.value = true;
  try {
    const rect = await window.electronAPI.selectOnScreen({
      kind: target.kind,
      label: target.name,
      targets: otherTargets(target.id),
    });
    if (rect) {
      store.updateTarget(target.id, { rect });
      showToast(`"${target.name}" updated`);
    }
  } finally {
    busy.value = false;
  }
}

// Glide the real mouse onto the target with the natural movement engine (no click)
async function testMove(target) {
  await window.electronAPI.testMoveToTarget(JSON.parse(JSON.stringify(target)));
}

function locate(target) {
  window.electronAPI.showOnScreen({
    targets: JSON.parse(JSON.stringify(targets.value)),
    highlightId: target.id,
  });
}

function showAll() {
  window.electronAPI.showOnScreen({
    targets: JSON.parse(JSON.stringify(targets.value)),
  });
}

// ── Name prompt ────────────────────────────────────────────────────────────

async function openPrompt(mode, item = null) {
  const titles = {
    'new-setup':     'Name the new setup',
    'rename-setup':  'Rename setup',
    'rename-target': 'Rename target',
  };
  prompt.value = {
    mode,
    item,
    title: titles[mode],
    value: mode === 'new-setup' ? '' : item?.name ?? '',
  };
  await nextTick();
  promptInput.value?.focus();
  promptInput.value?.select();
}

function submitPrompt() {
  const value = prompt.value.value.trim();
  if (!value) return;

  const { mode, item } = prompt.value;
  if (mode === 'new-setup')     store.addSetup(value);
  if (mode === 'rename-setup')  store.renameSetup(item.id, value);
  if (mode === 'rename-target') store.updateTarget(item.id, { name: value });
  prompt.value = null;
}

// ── Delete ─────────────────────────────────────────────────────────────────

function askDelete(type, item) {
  if (item) toDelete.value = { type, item };
}

function doDelete() {
  const { type, item } = toDelete.value;
  if (type === 'setup')  store.deleteSetup(item.id);
  if (type === 'target') store.deleteTarget(item.id);
  toDelete.value = null;
}

// ── Import / export ────────────────────────────────────────────────────────

async function doExport() {
  const res = await store.exportAll();
  if (res.ok) showToast('Targets exported');
}

async function doImport() {
  const res = await store.importAll();
  if (res.ok) showToast('Targets imported');
  else if (res.error) showToast(res.error, 'error');
}

onMounted(() => {
  if (!store.loaded) store.load();
});
</script>

<style scoped>
/* ── Setup bar ── */
.setup-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}
.setup-bar .field-label { margin-right: 4px; }
.select { min-width: 220px; }
.input { flex: 1; }

.count { color: var(--color-accent); margin-left: 6px; }

.kind-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}
.kind-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 10px 12px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-top: 2px solid transparent;
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
  font-family: var(--font-display);
  transition: all 0.15s;
}
.kind-card:hover  { border-color: #2e3850; }
.kind-card.active { border-top-color: var(--kind); background: color-mix(in srgb, var(--kind) 8%, var(--color-panel)); }
.kind-icon  { font-size: 18px; color: var(--kind); }
.kind-label { font-size: 14px; font-weight: 700; }
.kind-hint  { font-size: 11px; color: var(--color-muted); line-height: 1.3; }

.add-row { display: flex; gap: 8px; }

/* ── Target list ── */
.list-section { display: flex; flex-direction: column; gap: 10px; }
.target-list  { display: flex; flex-direction: column; gap: 6px; }

.target-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px 12px 10px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--kind);
  transition: border-color 0.15s;
}
.target-card:hover { border-color: #2e3850; border-left-color: var(--kind); }

.order { display: flex; flex-direction: column; gap: 2px; }
.order-btn {
  width: 18px;
  height: 14px;
  font-size: 8px;
  line-height: 1;
  background: transparent;
  border: none;
  color: var(--color-muted);
  cursor: pointer;
}
.order-btn:hover:not(:disabled) { color: var(--color-accent); }
.order-btn:disabled { opacity: 0.2; cursor: default; }

.card-icon { font-size: 20px; color: var(--kind); width: 22px; text-align: center; }
.card-body { flex: 1; display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.card-name-row { display: flex; align-items: center; gap: 10px; }
.card-name { font-weight: 700; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.card-meta { display: flex; gap: 8px; flex-wrap: wrap; }
.stat.accent { color: var(--kind); border-color: color-mix(in srgb, var(--kind) 40%, transparent); }

.card-actions { display: flex; gap: 6px; }

</style>
