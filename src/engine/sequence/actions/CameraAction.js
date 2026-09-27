// ── CameraAction ──────────────────────────────────────────────────────────────
// Put the OSRS camera back to the exact same view, so world targets
// (bank counter, campfire, tiles) line up with where I drew them:
//   1. click the compass       → camera faces north   (rotation)
//   2. hold the Up arrow       → camera tilts to top  (pitch)
//   3. scroll out over the view → max zoom out        (zoom)
// Each part can be turned off.
//
// def: { type: 'camera', faceNorth, compassTargetId, pitchUp, zoomOut, viewTargetId }
// ─────────────────────────────────────────────────────────────────────────────

import { Action } from './Action.js';

export const CAMERA_TIMING = {
  pitchHoldMs: [1800, 2600], // full tilt takes ~1.5s from the lowest angle
  zoomNotches: [18, 24],     // more than enough to reach max zoom-out from anywhere
  settleMs:    [150, 400],   // tiny pause between the parts
};

const between = ([min, max]) => min + Math.random() * (max - min);

export class CameraAction extends Action {
  validate({ targets }) {
    const { faceNorth, compassTargetId, pitchUp, zoomOut, viewTargetId } = this.def;
    const problems = [];
    if (!faceNorth && !pitchUp && !zoomOut) problems.push('Reset camera: turn on at least one part (north, tilt or zoom)');
    if (faceNorth && !targets.get(compassTargetId)) problems.push('Reset camera: pick the compass target');
    if (zoomOut && !targets.get(viewTargetId)) problems.push('Reset camera: pick a spot in the game view to scroll over');
    return problems;
  }

  async execute({ engine, targets, shouldStop, sleep }) {
    const { faceNorth, compassTargetId, pitchUp, zoomOut, viewTargetId } = this.def;

    if (faceNorth && !shouldStop()) {
      await engine.clickTarget(targets.get(compassTargetId), { shouldStop });
      await sleep(between(CAMERA_TIMING.settleMs));
    }

    if (pitchUp && !shouldStop()) {
      await engine.holdKey('up', between(CAMERA_TIMING.pitchHoldMs), { shouldStop });
      await sleep(between(CAMERA_TIMING.settleMs));
    }

    // Scrolling only zooms when the mouse is over the game view (not the side panel)
    if (zoomOut && !shouldStop()) {
      await engine.moveToTarget(targets.get(viewTargetId), { shouldStop });
      await engine.scroll(-Math.round(between(CAMERA_TIMING.zoomNotches)), { shouldStop });
    }
  }
}
