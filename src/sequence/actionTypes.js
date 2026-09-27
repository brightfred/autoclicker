// ── Action Types (UI side) ───────────────────────────────────────────────────
// How each step type looks in the editor and what a new one starts with.
// The matching classes that actually RUN them are in src/engine/sequence/actions.
// To add a new type: add it here + create/register its class in the engine.
// ─────────────────────────────────────────────────────────────────────────────

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
  wait: {
    label: 'Wait',
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
    create: () => ({
      id: newStepId(), type: 'camera',
      faceNorth: true, compassTargetId: null,
      pitchUp: true,
      zoomOut: true, viewTargetId: null,
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
