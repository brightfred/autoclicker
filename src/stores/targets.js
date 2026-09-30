// ── Targets Store ─────────────────────────────────────────────────────────────
// My named screen areas (banker, fire tile, bank item, inventory...),
// grouped into setups (e.g. "GE Firemaking").
// The real data lives in targets.json (main process) — this store keeps a copy
// for the UI and writes back every time I change something.
// ─────────────────────────────────────────────────────────────────────────────

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const useTargetsStore = defineStore('targets', () => {
  const setups        = ref([]);
  const activeSetupId = ref(null);
  const loaded        = ref(false);

  const activeSetup = computed(() =>
    setups.value.find(s => s.id === activeSetupId.value) ?? setups.value[0] ?? null
  );
  const targets = computed(() => activeSetup.value?.targets ?? []);

  // Plain copy of everything — IPC can't send Vue reactive proxies
  function snapshot() {
    return JSON.parse(JSON.stringify({
      activeSetupId: activeSetupId.value,
      setups: setups.value,
    }));
  }

  function apply(data) {
    setups.value        = data.setups;
    activeSetupId.value = data.activeSetupId ?? data.setups[0]?.id ?? null;
  }

  async function load() {
    const data = await window.electronAPI.loadTargets();
    apply(data);
    loaded.value = true;
  }

  async function persist() {
    await window.electronAPI.saveTargets(snapshot());
  }

  // ── Setups ────────────────────────────────────────────────────────────────

  function selectSetup(id) {
    activeSetupId.value = id;
    persist();
  }

  function addSetup(name) {
    const setup = { id: newId(), name, targets: [] };
    setups.value.push(setup);
    activeSetupId.value = setup.id;
    persist();
    return setup;
  }

  function renameSetup(id, name) {
    const s = setups.value.find(s => s.id === id);
    if (s) { s.name = name; persist(); }
  }

  function deleteSetup(id) {
    // I always keep at least one setup so the UI never ends up empty
    if (setups.value.length <= 1) return;
    setups.value = setups.value.filter(s => s.id !== id);
    if (activeSetupId.value === id) activeSetupId.value = setups.value[0].id;
    persist();
  }

  // ── Targets (always inside the active setup) ──────────────────────────────

  // extra: kind-specific fields — snapshot (Check area), color + tolerance (Color finder)
  function addTarget({ name, kind, rect, ...extra }) {
    if (!activeSetup.value) return null;
    const target = { id: newId(), name, kind, rect, createdAt: new Date().toISOString() };
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined) target[key] = value;
    }
    activeSetup.value.targets.push(target);
    persist();
    return target;
  }

  function updateTarget(id, changes) {
    const t = targets.value.find(t => t.id === id);
    if (t) { Object.assign(t, changes); persist(); }
  }

  function deleteTarget(id) {
    if (!activeSetup.value) return;
    activeSetup.value.targets = activeSetup.value.targets.filter(t => t.id !== id);
    persist();
  }

  // Move a target up/down in the list (so I can keep them in a logical order)
  function moveTarget(id, direction) {
    const list = activeSetup.value?.targets;
    if (!list) return;
    const i = list.findIndex(t => t.id === id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    persist();
  }

  // ── Import / export ───────────────────────────────────────────────────────

  function exportAll() {
    return window.electronAPI.exportTargets(snapshot());
  }

  async function importAll() {
    const res = await window.electronAPI.importTargets();
    if (res.ok) {
      apply(res.data);
      await persist();
    }
    return res;
  }

  return {
    setups, activeSetupId, activeSetup, targets, loaded,
    load, selectSetup, addSetup, renameSetup, deleteSetup,
    addTarget, updateTarget, deleteTarget, moveTarget,
    exportAll, importAll, snapshot,
  };
});
