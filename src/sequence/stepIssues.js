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
      const t = targetById.get(step.targetId);
      if (!t) return 'target not in this setup';
      if (t.kind === 'inventory' && !(step.slot >= 1 && step.slot <= SLOT_COUNT)) return 'pick a slot';
      return null;
    }
    case 'walk':
      if (!targetById.get(step.targetId)) return 'target not in this setup';
      return step.minMs > step.maxMs ? 'min is bigger than max' : null;
    case 'wait':
      return step.minMs > step.maxMs ? 'min is bigger than max' : null;
    case 'camera':
      if (!step.faceNorth && !step.pitchUp && !step.zoomOut) return 'turn on North, Tilt or Zoom';
      if (step.faceNorth && !targetById.get(step.compassTargetId)) return 'North: choose which target is your compass';
      if (step.zoomOut && !targetById.get(step.viewTargetId)) return 'Zoom: choose a spot in the game view to scroll over';
      return null;
    default:
      return null;
  }
}

/** Rough time a step takes (ms), for the "≈ per loop" estimate */
export function stepDurationMs(step) {
  switch (step.type) {
    case 'wait':       return (step.minMs + step.maxMs) / 2;
    case 'walk':       return 700 + (step.minMs + step.maxMs) / 2;
    case 'camera':     return 4000;
    case 'breakpoint': return 0; // breaks are counted by the efficiency slider
    default:           return 700;
  }
}
