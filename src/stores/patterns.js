// ── Patterns Store ────────────────────────────────────────────────────────────
// Stores recorded patterns with their model type and stats.
// Each pattern is model-agnostic — model-specific logic lives in the model file.
// ─────────────────────────────────────────────────────────────────────────────

import { defineStore } from 'pinia';
import { ref } from 'vue';

const STORAGE_KEY = 'autoclicker-patterns';

export const usePatternsStore = defineStore('patterns', () => {
  const patterns = ref([]);

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) patterns.value = JSON.parse(raw);
    } catch {}
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns.value));
  }

  /**
   * Add a new pattern to the store.
   *
   * Expected fields in `pattern`:
   * @param {object} pattern
   * @param {string}   pattern.name            - user-defined name
   * @param {string}   pattern.modelId         - which model was used (e.g. 'high-alch')
   * @param {object[]} pattern.events          - cleaned click events from recording
   * @param {Array[]}  pattern.mousePaths      - recorded mouse movement paths (may be empty)
   * @param {number}   pattern.itemsPerCycle   - how many items consumed per click cycle
   * @param {number}   pattern.totalDuration   - duration of the recording session in ms
   * @param {number}   pattern.avgInterval     - average ms between clicks
   * @param {number}   pattern.stdDevInterval  - std deviation of intervals
   * @param {number}   pattern.minInterval     - min interval recorded
   * @param {number}   pattern.maxInterval     - max interval recorded
   */
  function addPattern(pattern) {
    patterns.value.push({
      id:             Date.now().toString(),
      name:           pattern.name,
      modelId:        pattern.modelId,
      createdAt:      new Date().toISOString(),
      events:         pattern.events,
      mousePaths:     pattern.mousePaths     ?? [],
      itemsPerCycle:  pattern.itemsPerCycle  ?? 1,
      clickCount:     pattern.events.length,
      totalDuration:  pattern.totalDuration,
      avgInterval:    pattern.avgInterval,
      stdDevInterval: pattern.stdDevInterval,
      minInterval:    pattern.minInterval,
      maxInterval:    pattern.maxInterval,
    });
    save();
  }

  function deletePattern(id) {
    patterns.value = patterns.value.filter(p => p.id !== id);
    save();
  }

  function getPattern(id) {
    return patterns.value.find(p => p.id === id);
  }

  function renamePattern(id, name) {
    const p = patterns.value.find(p => p.id === id);
    if (p) { p.name = name; save(); }
  }

  load();

  return { patterns, addPattern, deletePattern, getPattern, renamePattern };
});