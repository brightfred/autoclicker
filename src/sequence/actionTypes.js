// ── Action Types (UI side) ───────────────────────────────────────────────────
// How each step type looks in the editor and what a new one starts with.
// The matching classes that actually RUN them are in src/engine/sequence/actions.
// To add a new type: add it here + create/register its class in the engine.
// ─────────────────────────────────────────────────────────────────────────────

// Id of the first target whose name matches, or null
function findByName(targets, pattern) {
  return targets.find(t => pattern.test(t.name))?.id ?? null;
}

function newStepId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const ACTION_TYPES = {
  click: {
    label: 'Click',
    icon:  '➚',
    color: '#f5a623',
    // A click is always created from a target (dragged from the Targets list)
    create: ({ targetId, kind }) => ({
      id: newStepId(),
      type: 'click',
      targetId,
      slot: kind === 'inventory' ? 1 : null,
      button: 'left',
    }),
  },
  // Created from a minimap spot / tile dragged from the "Walk to" list
  walk: {
    label: 'Walk to',
    icon:  '➜',
    color: '#2dd4bf',
    create: ({ targetId }) => ({ id: newStepId(), type: 'walk', targetId, minMs: 2500, maxMs: 4500 }),
  },
  // Created from a "Check area" target: wait until it looks the same / changes
  waitUntil: {
    label: 'Wait until',
    icon:  '⏳',
    color: '#e879f9',
    create: ({ targetId }) => ({
      id: newStepId(), type: 'waitUntil', targetId,
      state: 'same', threshold: 0.9, timeoutMs: 10000, onTimeout: 'continue',
    }),
  },
  // Look at a Check area once: if true → jump (step / next loop / stop)
  if: {
    label: 'If',
    icon:  '⑂',
    color: '#fbbf24',
    create: ({ targets = [] } = {}) => ({
      id: newStepId(), type: 'if',
      targetId: targets.find(t => t.kind === 'check')?.id ?? null,
      state: 'changed', threshold: 0.9, then: null,
    }),
  },
  // Always jump — with If, makes "repeat until" loops
  goto: {
    label: 'Go to',
    icon:  '↩',
    color: '#fbbf24',
    create: () => ({ id: newStepId(), type: 'goto', then: null }),
  },
  wait: {
    label: 'Pause',
    icon:  '◷',
    color: '#38bdf8',
    create: () => ({ id: newStepId(), type: 'wait', minMs: 600, maxMs: 1200 }),
  },
  key: {
    label: 'Press key',
    icon:  '⌨',
    color: '#a78bfa',
    create: () => ({ id: newStepId(), type: 'key', key: 'escape' }),
  },
  // Compass (north) + hold Up (top tilt) + scroll out (max zoom) = same view every time
  camera: {
    label: 'Reset camera',
    icon:  '🧭',
    color: '#f472b6',
    // Pre-fills targets named like "Compass" / "Game view" so it usually works right away
    create: ({ targets = [] } = {}) => ({
      id: newStepId(), type: 'camera',
      faceNorth: true, compassTargetId: findByName(targets, /compass/i),
      pitchUp: true,
      zoomOut: true, viewTargetId: findByName(targets, /view|game|screen|world/i),
    }),
  },
  // A spot where a break is allowed — the efficiency slider decides if/how long
  breakpoint: {
    label: 'Break point',
    icon:  '☕',
    color: '#22c55e',
    create: () => ({ id: newStepId(), type: 'breakpoint' }),
  },
};

// Keys I can pick for a "Press key" step (value = robotjs key name)
export const KEY_OPTIONS = [
  { value: 'escape', label: 'Esc' },
  { value: 'space',  label: 'Space' },
  { value: 'enter',  label: 'Enter' },
  { value: 'tab',    label: 'Tab' },
  ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map(k => ({ value: k, label: k })),
  ...Array.from({ length: 12 }, (_, i) => ({ value: `f${i + 1}`, label: `F${i + 1}` })),
];

export function keyLabel(value) {
  return KEY_OPTIONS.find(k => k.value === value)?.label ?? value;
}

/** Copy of a step with a fresh id (for the duplicate button) */
export function cloneStep(step) {
  return { ...JSON.parse(JSON.stringify(step)), id: newStepId() };
}
