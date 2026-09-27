// ── Step builders for presets ─────────────────────────────────────────────────
// Short helpers so a preset reads like the real in-game routine:
//   click(bank), wait(0.8, 1.4), key('escape'), breakpoint()
// They create the exact same steps as dragging them in the editor.
//
// Loop flags (any step):  { firstLoopOnly: true }  only on loop 1
//                         { skipFirstLoop: true }  only from loop 2 on
// ─────────────────────────────────────────────────────────────────────────────

import { ACTION_TYPES } from '../actionTypes.js';

/** Click a target. For an inventory target, pass { slot } */
export function click(target, { slot, button = 'left', ...flags } = {}) {
  const step = ACTION_TYPES.click.create({ targetId: target.id, kind: target.kind });
  if (slot) step.slot = slot;
  step.button = button;
  return withFlags(step, flags);
}

/** Walk: click a minimap spot / tile, then wait minSec–maxSec while walking */
export function walk(target, minSec, maxSec, flags = {}) {
  const step = ACTION_TYPES.walk.create({ targetId: target.id });
  step.minMs = Math.round(minSec * 1000);
  step.maxMs = Math.round(maxSec * 1000);
  return withFlags(step, flags);
}

/** Wait a random time between min and max seconds */
export function wait(minSec, maxSec, flags = {}) {
  const step = ACTION_TYPES.wait.create();
  step.minMs = Math.round(minSec * 1000);
  step.maxMs = Math.round(maxSec * 1000);
  return withFlags(step, flags);
}

export function key(name) {
  const step = ACTION_TYPES.key.create();
  step.key = name;
  return step;
}

export function breakpoint() {
  return ACTION_TYPES.breakpoint.create();
}

/** Apply the same loop flag to several steps at once */
export function onLoops(flags, steps) {
  return steps.map(step => withFlags(step, flags));
}

function withFlags(step, { firstLoopOnly = false, skipFirstLoop = false } = {}) {
  if (firstLoopOnly) step.firstLoopOnly = true;
  if (skipFirstLoop) step.skipFirstLoop = true;
  return step;
}
