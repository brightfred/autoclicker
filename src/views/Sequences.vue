<template>
  <div class="page">

    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Sequences</h1>
        <p class="page-sub">Chain your targets into steps that run in order — click, wait, press a key, repeat.</p>
      </div>
      <div class="header-actions">
        <button class="btn-ghost" @click="doImport" title="Import sequences from a .json file">⤒ Import</button>
        <button class="btn-ghost" :disabled="sequences.length === 0" @click="doExport" title="Export all sequences">⤓ Export</button>
        <button class="btn-ghost" @click="showPresets = true">✦ From preset</button>
        <button class="btn-primary" @click="openNew">+ New sequence</button>
      </div>
    </div>

    <!-- Empty state: explain the 2-step workflow -->
    <div v-if="sequences.length === 0" class="empty getting-started">
      <div class="empty-icon">⛓</div>
      <p class="empty-title">No sequences yet</p>
      <div class="steps">
        <div class="how-step">
          <span class="how-num">1</span>
          <div>
            <p class="how-title">Draw your targets</p>
            <p class="how-sub">Banker, tile, bank item, inventory — in the <router-link to="/targets">Targets</router-link> tab.</p>
          </div>
        </div>
        <div class="how-step">
          <span class="how-num">2</span>
          <div>
            <p class="how-title">Build a sequence</p>
            <p class="how-sub">Drag targets, waits and key presses into order, then press F6.</p>
          </div>
        </div>
      </div>
      <div class="start-buttons">
        <button class="btn-ghost" @click="showPresets = true">✦ From preset</button>
        <button class="btn-primary" @click="openNew">+ New sequence</button>
      </div>
    </div>

    <!-- Sequence list -->
    <div v-else class="seq-list">
      <!-- Clicking anywhere on the card opens it (buttons on the right do their own thing) -->
      <div v-for="seq in sequences" :key="seq.id" class="seq-card" title="Open to edit or run" @click="edit(seq)">
        <span class="seq-icon">⛓</span>

        <div class="seq-body">
          <div class="seq-name-row">
            <span class="seq-name">{{ seq.name }}</span>
            <span class="badge" :class="{ missing: !setupName(seq) }">{{ setupName(seq) ?? 'setup deleted' }}</span>
            <!-- Saved but not ready to run yet (missing targets, empty steps...) -->
            <span
              v-if="issuesOf(seq).length"
              class="unfinished"
              :title="issuesOf(seq).slice(0, 5).map(i => (i.index !== null ? `Step ${i.index + 1}: ` : '') + i.text).join('\n')"
            >⚠ Unfinished · {{ issuesOf(seq).length }} to fix</span>
          </div>
          <div class="seq-meta">
            <span class="stat">{{ seq.actions.length }} step{{ seq.actions.length !== 1 ? 's' : '' }}</span>
            <span class="stat">{{ seq.loops > 0 ? `${seq.loops} loop${seq.loops !== 1 ? 's' : ''}` : 'loops forever' }}</span>
            <span class="stat" title="Efficiency">☕ {{ Math.round((seq.efficiency ?? 1) * 100) }}%</span>
            <span class="stat preview">{{ preview(seq) }}</span>
          </div>
        </div>

        <div class="seq-actions" @click.stop>
          <button class="btn-icon" @click="duplicate(seq)" title="Duplicate">⧉</button>
          <button class="btn-icon btn-delete" @click="toDelete = seq" title="Delete">✕</button>
          <button class="btn-edit" @click="edit(seq)" title="Open to edit or run">✎ Edit</button>
        </div>
      </div>
    </div>

    <!-- New sequence -->
    <ModalBackdrop v-if="creating" @close="creating = null">
      <form class="modal" @submit.prevent="create">
        <p class="modal-title">New sequence</p>
        <label class="field">
          <span class="field-label">Name</span>
          <input ref="nameInput" v-model="creating.name" class="input" maxlength="40" placeholder="e.g. GE Campfire logs" />
        </label>
        <label class="field">
          <span class="field-label">Setup (where its targets come from)</span>
          <select v-model="creating.setupId" class="select">
            <option v-for="s in setups" :key="s.id" :value="s.id">{{ s.name }} ({{ s.targets.length }} targets)</option>
          </select>
        </label>
        <div class="modal-actions">
          <button type="button" class="btn-ghost" @click="creating = null">Cancel</button>
          <button type="submit" class="btn-primary" :disabled="!creating.name.trim() || !creating.setupId">Create</button>
        </div>
      </form>
    </ModalBackdrop>

    <!-- Build from a preset (Forester's campfire, manual firemaking...) -->
    <PresetWizard v-if="showPresets" @close="showPresets = false" @created="onPresetCreated" />

    <!-- Delete confirmation -->
    <ModalBackdrop v-if="toDelete" @close="toDelete = null">
      <div class="modal">
        <p class="modal-title">Delete sequence "<strong>{{ toDelete.name }}</strong>"?</p>
        <div class="modal-actions">
          <button class="btn-ghost" @click="toDelete = null">Cancel</button>
          <button class="btn-danger" @click="doDelete">Delete</button>
        </div>
      </div>
    </ModalBackdrop>

    <transition name="fade">
      <div v-if="toast" class="toast" :class="toast.type">{{ toast.text }}</div>
    </transition>

  </div>
</template>

<script setup>
import { ref, nextTick, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useSequencesStore } from '../stores/sequences';
import { useTargetsStore } from '../stores/targets';
import { ACTION_TYPES, keyLabel } from '../sequence/actionTypes.js';
import { sequenceIssues } from '../sequence/stepIssues.js';
import PresetWizard from '../components/PresetWizard.vue';
import ModalBackdrop from '../components/ModalBackdrop.vue';

const router      = useRouter();
const seqStore    = useSequencesStore();
const targetStore = useTargetsStore();
const { sequences } = storeToRefs(seqStore);
const { setups }    = storeToRefs(targetStore);

const creating  = ref(null);   // { name, setupId } while the "new" modal is open
const nameInput = ref(null);
const toDelete  = ref(null);
const showPresets = ref(false);
const toast     = ref(null);
let toastTimer  = null;

function showToast(text, type = 'ok') {
  clearTimeout(toastTimer);
  toast.value = { text, type };
  toastTimer = setTimeout(() => (toast.value = null), 2800);
}

function setupOf(seq) {
  return setups.value.find(s => s.id === seq.setupId);
}

function setupName(seq) {
  return setupOf(seq)?.name ?? null;
}

// What's left to finish before this sequence can run
function issuesOf(seq) {
  const targetById = new Map((setupOf(seq)?.targets ?? []).map(t => [t.id, t]));
  return sequenceIssues(seq, targetById);
}

// Short "Banker → Wait → Esc → ..." summary of the first steps
function preview(seq) {
  const targets = setupOf(seq)?.targets ?? [];
  const names = seq.actions.slice(0, 5).map(step => {
    if (step.type === 'click') {
      const t = targets.find(t => t.id === step.targetId);
      if (!t) return '?';
      return t.kind === 'inventory' ? `${t.name} #${step.slot}` : t.name;
    }
    if (step.type === 'walk') {
      const t = targets.find(t => t.id === step.targetId);
      return `➜ ${t ? t.name : '?'}`;
    }
    if (step.type === 'waitUntil') {
      const t = targets.find(t => t.id === step.targetId);
      return `⏳ ${t ? t.name : '?'}`;
    }
    if (step.type === 'clickColor') {
      const t = targets.find(t => t.id === step.targetId);
      return `🎯 ${t ? t.name : '?'}`;
    }
    if (step.type === 'if') return '⑂ If';
    if (step.type === 'goto') return '↩';
    if (step.type === 'key') return keyLabel(step.key);
    if (step.type === 'breakpoint') return '☕';
    if (step.type === 'camera') return '🧭';
    return ACTION_TYPES[step.type]?.label ?? step.type;
  });
  if (names.length === 0) return 'empty';
  return names.join(' → ') + (seq.actions.length > 5 ? ' → …' : '');
}

async function openNew() {
  creating.value = { name: '', setupId: targetStore.activeSetup?.id ?? setups.value[0]?.id ?? null };
  await nextTick();
  nameInput.value?.focus();
}

function create() {
  const seq = seqStore.addSequence({ name: creating.value.name.trim(), setupId: creating.value.setupId });
  creating.value = null;
  edit(seq);
}

function onPresetCreated(seq) {
  showPresets.value = false;
  edit(seq);
}

function edit(seq) {
  router.push(`/sequence/${seq.id}`);
}

function duplicate(seq) {
  seqStore.duplicateSequence(seq.id);
  showToast(`"${seq.name}" duplicated`);
}

function doDelete() {
  seqStore.deleteSequence(toDelete.value.id);
  toDelete.value = null;
}

async function doExport() {
  const res = await seqStore.exportAll();
  if (res.ok) showToast('Sequences exported');
}

async function doImport() {
  const res = await seqStore.importAll();
  if (res.ok) showToast('Sequences imported');
  else if (res.error) showToast(res.error, 'error');
}

onMounted(() => {
  if (!seqStore.loaded) seqStore.load();
  if (!targetStore.loaded) targetStore.load();
});
</script>

<style scoped>
.getting-started { gap: 12px; padding: 40px 16px; }
.steps { display: flex; gap: 16px; margin: 8px 0; }
.how-step {
  display: flex;
  gap: 12px;
  text-align: left;
  width: 240px;
  padding: 12px 14px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
}
.how-num {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent);
  color: #0a0c0f;
  font-weight: 700;
}
.how-title { font-weight: 700; color: var(--color-text); font-size: 14px; }
.how-sub   { font-size: 12px; line-height: 1.4; margin-top: 2px; }
.how-sub a { color: var(--color-accent); }

.start-buttons { display: flex; gap: 8px; }

.seq-list { display: flex; flex-direction: column; gap: 6px; }
.seq-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-accent);
  transition: border-color 0.15s;
}
.seq-card:hover { border-color: #2e3850; border-left-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 4%, var(--color-panel)); }
.seq-card { cursor: pointer; }
.btn-edit {
  height: 32px;
  padding: 0 12px;
  background: transparent;
  border: 1px solid var(--color-accent);
  color: var(--color-accent);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-edit:hover { background: rgba(245, 166, 35, 0.12); }
.seq-icon { font-size: 20px; color: var(--color-accent); width: 22px; text-align: center; }
.seq-body { flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.seq-name-row { display: flex; align-items: center; gap: 10px; }
.seq-name { font-weight: 700; font-size: 15px; }
.badge.missing { --badge: var(--color-red); }
.unfinished {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-accent);
  border: 1px dashed var(--color-accent);
  padding: 1px 6px;
  white-space: nowrap;
}
.seq-meta { display: flex; gap: 8px; flex-wrap: nowrap; min-width: 0; }
.seq-meta .stat { white-space: nowrap; flex-shrink: 0; }
.stat.preview { flex-shrink: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.seq-actions { display: flex; gap: 6px; }

.field { display: flex; flex-direction: column; gap: 6px; }
</style>
