// ── WalkAction ────────────────────────────────────────────────────────────────
// Walk somewhere: click a minimap spot (or a tile), then wait while the
// character gets there. One step instead of "click + wait".
//
// Minimap spots work from anywhere: the minimap is centered on my character
// and north-up (after a compass click), so the same spot always means
// "walk this far in this direction from where I am now".
//
// def: { type: 'walk', targetId, minMs, maxMs }
// ─────────────────────────────────────────────────────────────────────────────

import { Action } from './Action.js';

export class WalkAction extends Action {
  validate({ targets }) {
    const { targetId, minMs, maxMs } = this.def;
    if (!targets.get(targetId)) return ['Walk: the target was deleted or is not in this setup'];
    if (!(minMs >= 0) || !(maxMs >= 0)) return ['Walk: the walking time must be 0 or more'];
    if (minMs > maxMs) return ['Walk: min walking time is bigger than max'];
    return [];
  }

  async execute({ engine, targets, shouldStop, sleep }) {
    const { targetId, minMs, maxMs } = this.def;
    const reached = await engine.clickTarget(targets.get(targetId), { shouldStop });
    if (reached) await sleep(minMs + Math.random() * (maxMs - minMs));
  }
}
