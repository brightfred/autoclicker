// ── Step issues ───────────────────────────────────────────────────────────────
// Quick check shown on each step while I edit (red ⚠ text on the card).
// The engine does the real check on Start — this is just instant feedback.
// ─────────────────────────────────────────────────────────────────────────────

import { INV_COLS, INV_ROWS } from '../utils/targetGeometry.js';

const SLOT_COUNT = INV_COLS * INV_ROWS;

// Where If / Go to can jump besides a step (same values as the engine's flow.js)
const SPECIAL_JUMPS = ['@next-loop', '@stop'];

function jumpIssue(step, stepIds) {
  if (!step.then) return 'choose where to go';
  if (SPECIAL_JUMPS.includes(step.then)) return null;
  if (step.then === step.id) return "can't go to itself";
  if (stepIds && !stepIds.has(step.then)) return 'the step it goes to was removed';
  return null;
}

/**
 * @param {object} step
 * @param {Map<string, object>} targetById - targets of the sequence's setup
 * @param {Set<string>} [stepIds]          - ids of all steps (for If / Go to)
 * @returns {string|null} short problem text, or null if the step is fine
 */
export function stepIssue(step, targetById, stepIds) {
  switch (step.type) {
    case 'click': {
      if (!step.targetId) return 'choose a target';
      const t = targetById.get(step.targetId);
      if (!t) return 'target was deleted or is in another setup';
      if (t.kind === 'inventory' && !(step.slot >= 1 && step.slot <= SLOT_COUNT)) return 'pick a slot';
      return null;
    }
    case 'walk':
      if (!step.targetId) return 'choose where to walk';
      if (!targetById.get(step.targetId)) return 'target was deleted or is in another setup';
      return step.minMs > step.maxMs ? 'min is bigger than max' : null;
    case 'wait':
      return step.minMs > step.maxMs ? 'min is bigger than max' : null;
    case 'if': {
      if (!step.targetId) return 'choose which area to check';
      const t = targetById.get(step.targetId);
      if (!t) return 'area was deleted or is in another setup';
      if (!t.snapshot) return 'this area has no snapshot yet — take one in Targets';
      return jumpIssue(step, stepIds);
    }
    case 'goto':
      return jumpIssue(step, stepIds);
    case 'clickColor': {
      if (!step.targetId) return 'choose a color finder';
      const t = targetById.get(step.targetId);
      if (!t) return 'target was deleted or is in another setup';
      if (t.kind !== 'color') return 'that target is not a color finder';
      if (step.waitGone && step.alsoCheckId) {
        const c = targetById.get(step.alsoCheckId);
        if (!c) return 'the extra check area was deleted';
        if (!c.snapshot) return 'the extra check area has no snapshot yet';
      }
      return null;
    }
    case 'waitUntil': {
      if (!step.targetId) return 'choose which area to watch';
      const t = targetById.get(step.targetId);
      if (!t) return 'area was deleted or is in another setup';
      if (!t.snapshot) return 'this area has no snapshot yet — take one in Targets';
      return step.timeoutMs > 0 ? null : 'timeout must be more than 0';
    }
    case 'camera':
      if (!step.faceNorth && !step.pitchUp && !step.zoomOut) return 'turn on North, Tilt or Zoom';
      if (step.faceNorth && !targetById.get(step.compassTargetId)) return 'North: choose which target is your compass';
      if (step.zoomOut && !targetById.get(step.viewTargetId)) return 'Zoom: choose a spot in the game view to scroll over';
      return null;
    default:
      return null;
  }
}

/**
 * Everything left to finish in a sequence (empty → ready to run).
 * @returns {{ index: number|null, text: string }[]}  index = step (0-based), null = whole sequence
 */
export function sequenceIssues(sequence, targetById) {
  if (!sequence.actions.length) return [{ index: null, text: 'no steps yet' }];
  const stepIds = new Set(sequence.actions.map(a => a.id));
  return sequence.actions
    .map((step, index) => ({ index, text: stepIssue(step, targetById, stepIds) }))
    .filter(issue => issue.text);
}

/** Rough time a step takes (ms), for the "≈ per loop" estimate */
export function stepDurationMs(step) {
  switch (step.type) {
    case 'wait':       return (step.minMs + step.maxMs) / 2;
    case 'walk':       return 700 + (step.minMs + step.maxMs) / 2;
    case 'camera':     return 4000;
    case 'waitUntil':  return Math.min(step.timeoutMs, 2000); // usually done well before the timeout
    case 'breakpoint': return 0; // breaks are counted by the efficiency slider
    case 'if':
    case 'goto':       return 0; // just a quick look / a jump
    case 'clickColor': return step.waitGone ? 30000 : 900; // a tree usually lasts a while
    default:           return 700;
  }
}
