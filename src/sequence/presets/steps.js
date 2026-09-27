// ── Step builders for presets ─────────────────────────────────────────────────
// Short helpers so a preset reads like the real in-game routine:
//   click(bank), wait(0.8, 1.4), key('escape'), breakpoint()
// They create the exact same steps as dragging them in the editor.
// ─────────────────────────────────────────────────────────────────────────────

import { ACTION_TYPES } from '../actionTypes.js';

/** Click a target. For an inventory target, pass { slot } */
export function click(target, { slot, firstLoopOnly = false, button = 'left' } = {}) {
  const step = ACTION_TYPES.click.create({ targetId: target.id, kind: target.kind });
  if (slot) step.slot = slot;
  step.button = button;
  return withFlags(step, firstLoopOnly);
}

/** Wait a random time between min and max seconds */
export function wait(minSec, maxSec, { firstLoopOnly = false } = {}) {
  const step = ACTION_TYPES.wait.create();
  step.minMs = Math.round(minSec * 1000);
  step.maxMs = Math.round(maxSec * 1000);
  return withFlags(step, firstLoopOnly);
}

export function key(name) {
  const step = ACTION_TYPES.key.create();
  step.key = name;
  return step;
}

export function breakpoint() {
  return ACTION_TYPES.breakpoint.create();
}

function withFlags(step, firstLoopOnly) {
  if (firstLoopOnly) step.firstLoopOnly = true;
  return step;
}
