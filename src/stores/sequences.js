// ── Sequences Store ───────────────────────────────────────────────────────────
// My action sequences. The real data lives in sequences.json (main process);
// this store keeps a copy for the UI and auto-saves shortly after any change.
//
// A sequence looks like:
//   { id, name, setupId, loops (0 = forever), actions: [step, step, ...], createdAt }
// ─────────────────────────────────────────────────────────────────────────────

import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

const SAVE_DELAY_MS = 300; // wait until I stop typing before writing the file

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const useSequencesStore = defineStore('sequences', () => {
  const sequences = ref([]);
  const loaded    = ref(false);
  let saveTimer   = null;

  // Plain copy — IPC can't send Vue reactive proxies
  function snapshot() {
    return JSON.parse(JSON.stringify({ sequences: sequences.value }));
  }

  async function load() {
    const data = await window.electronAPI.loadSequences();
    sequences.value = data.sequences;
    loaded.value = true;
  }

  function persistSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => window.electronAPI.saveSequences(snapshot()), SAVE_DELAY_MS);
  }

  // Any change anywhere (rename, add step, edit a wait...) gets saved
  watch(sequences, () => { if (loaded.value) persistSoon(); }, { deep: true });

  function getSequence(id) {
    return sequences.value.find(s => s.id === id);
  }

  function addSequence({ name, setupId }) {
    const seq = { id: newId(), name, setupId, loops: 0, actions: [], createdAt: new Date().toISOString() };
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
    if (res.ok) sequences.value = res.data.sequences;
    return res;
  }

  return { sequences, loaded, load, getSequence, addSequence, duplicateSequence, deleteSequence, exportAll, importAll };
});
