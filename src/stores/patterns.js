import { defineStore } from 'pinia';
import { ref } from 'vue';

export const usePatternsStore = defineStore('patterns', () => {
  const patterns = ref([]);

  function load() {
    try {
      const raw = localStorage.getItem('alch-patterns');
      if (raw) patterns.value = JSON.parse(raw);
    } catch {}
  }

  function save() {
    localStorage.setItem('alch-patterns', JSON.stringify(patterns.value));
  }

  function addPattern(pattern) {
    patterns.value.push({
      id: Date.now().toString(),
      name: pattern.name,
      createdAt: new Date().toISOString(),
      events: pattern.events,
      totalDuration: pattern.totalDuration,
      clickCount: pattern.events.length,
      avgInterval: pattern.avgInterval,
      stdDevInterval: pattern.stdDevInterval,
      minInterval: pattern.minInterval,
      maxInterval: pattern.maxInterval,
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