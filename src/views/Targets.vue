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

    <!-- Came here from a sequence to add a missing target → easy way back -->
    <div v-if="returnTo" class="return-bar">
      <span>Adding targets for <strong>{{ returnTo.name }}</strong> — they go in the <strong>{{ activeSetup?.name }}</strong> setup.</span>
      <button class="btn-primary" @click="router.push(returnTo.path)">← Back to sequence</button>
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
              <template v-if="t.kind === 'check'">
                <span v-if="!t.snapshot" class="stat warn">no snapshot yet</span>
                <span v-else-if="matchResult[t.id] != null" class="stat accent">looks {{ matchResult[t.id] }}% the same right now</span>
              </template>
            </div>
          </div>

          <SnapshotThumb v-if="t.kind === 'check' && t.snapshot" :snapshot="t.snapshot" />

          <div class="card-actions">
            <template v-if="t.kind === 'check'">
              <button class="btn-icon" @click="testMatch(t)" :disabled="!t.snapshot" title="Test — how much does it look like the snapshot right now?">%</button>
              <button class="btn-icon" @click="retakeSnapshot(t)" title="Retake snapshot — the game should show the state to wait for">📷</button>
            </template>
            <button v-else class="btn-icon" @click="testMove(t)" title="Test move — glide the mouse onto it (no click)">➚</button>
            <button
              v-if="t.kind === 'inventory'"
              class="btn-icon"
              title="Make an 'inventory full' check — slot 28 must be EMPTY right now"
              @click="makeFullCheck(t)"
            >👁</button>
            <button class="btn-icon" @click="locate(t)" title="Show on screen">◎</button>
            <button class="btn-icon" @click="redraw(t)" title="Redraw box">⬚</button>
            <button class="btn-icon" @click="openPrompt('rename-target', t)" title="Rename">✎</button>
            <button class="btn-icon btn-delete" @click="askDelete('target', t)" title="Delete">✕</button>
          </div>
        </div>
      </div>
    </section>

    <!-- Name prompt (new setup / rename) -->
    <ModalBackdrop v-if="prompt" @close="prompt = null">
      <form class="modal" @submit.prevent="submitPrompt">
        <p class="modal-title">{{ prompt.title }}</p>
        <input ref="promptInput" v-model="prompt.value" class="input" maxlength="40" />
        <div class="modal-actions">
          <button type="button" class="btn-ghost" @click="prompt = null">Cancel</button>
          <button type="submit" class="btn-primary" :disabled="!prompt.value.trim()">Save</button>
        </div>
      </form>
    </ModalBackdrop>

    <!-- Delete confirmation -->
    <ModalBackdrop v-if="toDelete" @close="toDelete = null">
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
    </ModalBackdrop>

    <!-- Small status message -->
    <transition name="fade">
      <div v-if="toast" class="toast" :class="toast.type">{{ toast.text }}</div>
    </transition>

  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useTargetsStore } from '../stores/targets';
import ModalBackdrop from '../components/ModalBackdrop.vue';
import SnapshotThumb from '../components/SnapshotThumb.vue';
import { useSequencesStore } from '../stores/sequences';
import { TARGET_KINDS, getKind, INV_COLS, INV_ROWS, inventorySlots } from '../utils/targetGeometry.js';

const store    = useTargetsStore();
const seqStore = useSequencesStore();
const route    = useRoute();
const router   = useRouter();

// ?from=/sequence/<id> → the sequence I came from (for the "Back" banner)
const returnTo = computed(() => {
  const from = route.query.from;
  if (typeof from !== 'string' || !from.startsWith('/sequence/')) return null;
  const seq = seqStore.getSequence(from.split('/')[2]);
  return seq ? { path: from, name: seq.name } : null;
});
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
  check:     'Bank is open',
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
      // A check area also remembers how it looks right now
      const snapshot = newKind.value === 'check' ? await window.electronAPI.snapshotArea(rect) : undefined;
      store.addTarget({ name, kind: newKind.value, rect, ...(snapshot && { snapshot }) });
      newName.value = '';
      showToast(snapshot ? `"${name}" saved with a snapshot of how it looks now` : `"${name}" saved`);
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
      // New box = new snapshot, or the old picture wouldn't match the new area
      const snapshot = target.kind === 'check' ? await window.electronAPI.snapshotArea(rect) : undefined;
      store.updateTarget(target.id, { rect, ...(snapshot && { snapshot }) });
      showToast(`"${target.name}" updated`);
    }
  } finally {
    busy.value = false;
  }
}

// ── Check areas ────────────────────────────────────────────────────────────
// Snapshot = how the area should look (e.g. with the bank open). I retake it
// whenever the game is showing the state I want to wait for.

const matchResult = ref({}); // target id → last tested match % (shown on the card)

async function retakeSnapshot(target) {
  const snapshot = await window.electronAPI.snapshotArea(JSON.parse(JSON.stringify(target.rect)));
  store.updateTarget(target.id, { snapshot });
  matchResult.value = { ...matchResult.value, [target.id]: null };
  showToast(`New snapshot of "${target.name}"`);
}

// Compare the area right now with its snapshot
async function testMatch(target) {
  const score = await window.electronAPI.matchTarget(JSON.parse(JSON.stringify(target)));
  matchResult.value = { ...matchResult.value, [target.id]: Math.round(score * 100) };
}

// One click "inventory full" check: a Check area on slot 28, snapped while it's
// empty. Later, "has changed" = something is in slot 28 = inventory full.
async function makeFullCheck(inventory) {
  const slot = inventorySlots(inventory.rect)[INV_COLS * INV_ROWS - 1];
  const rect = { x: slot.x, y: slot.y, w: slot.w, h: slot.h };
  const snapshot = await window.electronAPI.snapshotArea(rect);
  const name = `${inventory.name}: slot 28 empty`;
  store.addTarget({ name, kind: 'check', rect, snapshot });
  showToast(`"${name}" added — use "has changed" to mean inventory full`);
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

onMounted(async () => {
  if (!store.loaded) await store.load();
  if (!seqStore.loaded) await seqStore.load();

  // ?setup=<id> → open that setup, so new targets land where the sequence can use them
  const wanted = route.query.setup;
  if (typeof wanted === 'string' && store.setups.some(s => s.id === wanted) && store.activeSetupId !== wanted) {
    store.selectSetup(wanted);
  }
});
</script>

<style scoped>
/* ── Return banner ── */
.return-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  font-size: 13px;
  background: rgba(245, 166, 35, 0.08);
  border: 1px solid var(--color-accent);
}
.return-bar strong { color: var(--color-accent); }

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
  grid-template-columns: repeat(3, 1fr);
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
.stat.warn { color: var(--color-red); border-color: rgba(239, 68, 68, 0.4); }
.stat.accent { color: var(--kind); border-color: color-mix(in srgb, var(--kind) 40%, transparent); }

.card-actions { display: flex; gap: 6px; }

</style>
