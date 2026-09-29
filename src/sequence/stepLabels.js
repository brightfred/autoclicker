// ── Step labels ───────────────────────────────────────────────────────────────
// A short human name for a step, e.g. "Click Magic tree" or "Wait until Bank
// is open" — used in the If / Go to "go to step…" dropdowns.
// ─────────────────────────────────────────────────────────────────────────────

import { ACTION_TYPES, keyLabel } from './actionTypes.js';

export function stepLabel(step, targetById) {
  const type = ACTION_TYPES[step.type]?.label ?? step.type;
  const target = targetById.get(step.targetId)?.name;

  switch (step.type) {
    case 'click':     return `Click ${target ?? '?'}${step.slot ? ` #${step.slot}` : ''}`;
    case 'walk':      return `Walk to ${target ?? '?'}`;
    case 'waitUntil': return `Wait until ${target ?? '?'}`;
    case 'if':        return `If ${target ?? '?'}`;
    case 'clickColor': return `Click nearest ${target ?? '?'}`;
    case 'key':       return `Press ${keyLabel(step.key)}`;
    default:          return type;
  }
}
