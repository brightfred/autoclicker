// ── Sequences Store ───────────────────────────────────────────────────────────
// My action sequences. The real data lives in sequences.json (main process);
// this store keeps a copy for the UI and auto-saves shortly after any change.
//
// A sequence looks like:
//   { id, name, setupId, loops (0 = forever), actions: [step, step, ...],
//     efficiency (0.5..1), breakProfile ('general', 'high-alch'...), createdAt }
// ─────────────────────────────────────────────────────────────────────────────

import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { DEFAULT_EFFICIENCY, DEFAULT_PROFILE_ID } from '../engine/efficiency/defaults.js';

const SAVE_DELAY_MS = 300; // wait until I stop typing before writing the file

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Sequences saved before the efficiency slider existed get the defaults
function withDefaults(seq) {
  return { efficiency: DEFAULT_EFFICIENCY, breakProfile: DEFAULT_PROFILE_ID, ...seq };
}

export const useSequencesStore = defineStore('sequences', () => {
  const sequences = ref([]);
  const loaded    = ref(false);
  const saveState = ref('saved');  // 'saving' while a change waits to be written, then 'saved'
  let saveTimer   = null;

  // Plain copy — IPC can't send Vue reactive proxies
  function snapshot() {
    return JSON.parse(JSON.stringify({ sequences: sequences.value }));
  }

  async function load() {
    const data = await window.electronAPI.loadSequences();
    sequences.value = data.sequences.map(withDefaults);
    loaded.value = true;
  }

  function persistSoon() {
    saveState.value = 'saving';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await window.electronAPI.saveSequences(snapshot());
        saveState.value = 'saved';
      } catch (err) {
        console.error('[SEQUENCES] Save failed:', err);
        saveState.value = 'error';
      }
    }, SAVE_DELAY_MS);
  }

  // Any change anywhere (rename, add step, edit a wait...) gets saved
  watch(sequences, () => { if (loaded.value) persistSoon(); }, { deep: true });

  function getSequence(id) {
    return sequences.value.find(s => s.id === id);
  }

  // Empty by default; presets pass their steps + efficiency/profile
  function addSequence({
    name, setupId, actions = [], loops = 0,
    efficiency = DEFAULT_EFFICIENCY, breakProfile = DEFAULT_PROFILE_ID,
  }) {
    const seq = {
      id: newId(), name, setupId, loops, actions,
      efficiency, breakProfile,
      createdAt: new Date().toISOString(),
    };
    sequences.value.push(seq);
    return seq;
  }

  function duplicateSequence(id) {
    const original = getSequence(id);
    if (!original) return null;
    const copy = { ...JSON.parse(JSON.stringify(original)), id: newId(), name: `${original.name} (copy)`, createdAt: new Date().toISOString() };
    sequences.value.push(copy);
    return copy;
  }

  function deleteSequence(id) {
    sequences.value = sequences.value.filter(s => s.id !== id);
  }

  function exportAll() {
    return window.electronAPI.exportSequences(snapshot());
  }

  async function importAll() {
    const res = await window.electronAPI.importSequences();
    if (res.ok) sequences.value = res.data.sequences.map(withDefaults);
    return res;
  }

  return { sequences, loaded, saveState, load, getSequence, addSequence, duplicateSequence, deleteSequence, exportAll, importAll };
});
