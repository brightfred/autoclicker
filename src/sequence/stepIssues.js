// ── Step issues ───────────────────────────────────────────────────────────────
// Quick check shown on each step while I edit (red ⚠ text on the card).
// The engine does the real check on Start — this is just instant feedback.
// ─────────────────────────────────────────────────────────────────────────────

import { INV_COLS, INV_ROWS } from '../utils/targetGeometry.js';

const SLOT_COUNT = INV_COLS * INV_ROWS;

/**
 * @param {object} step
 * @param {Map<string, object>} targetById - targets of the sequence's setup
 * @returns {string|null} short problem text, or null if the step is fine
 */
export function stepIssue(step, targetById) {
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
  return sequence.actions
    .map((step, index) => ({ index, text: stepIssue(step, targetById) }))
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
    default:           return 700;
  }
}
