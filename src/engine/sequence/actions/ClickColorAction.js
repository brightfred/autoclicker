// ── ClickColorAction ──────────────────────────────────────────────────────────
// Find the things highlighted in a color (e.g. RuneLite-marked trees), click the
// nearest (or a random) one, and optionally wait until its highlight is gone
// (the tree became a stump) — or until a check area changes (inventory full).
//
// def: {
//   type: 'clickColor', targetId, pick: 'nearest'|'random', button,
//   appearTimeoutMs, onNone: 'continue'|'stop',       // none highlighted yet
//   waitGone, goneTimeoutMs,                           // then watch it disappear
//   alsoCheckId, alsoState: 'same'|'changed', alsoThreshold  // …or stop watching when this happens
// }
// ─────────────────────────────────────────────────────────────────────────────

import { Action } from './Action.js';
import { conditionMet } from '../conditions.js';

const LOOK_EVERY_MS = [120, 260];
const GONE_BELOW    = 0.25; // highlight "gone" when under 25% of what it was

const lookPause = () => LOOK_EVERY_MS[0] + Math.random() * (LOOK_EVERY_MS[1] - LOOK_EVERY_MS[0]);

export class ClickColorAction extends Action {
  validate({ targets }) {
    const { targetId, appearTimeoutMs, waitGone, goneTimeoutMs, alsoCheckId } = this.def;
    if (!targetId) return ['Click color: choose a color finder target'];
    const t = targets.get(targetId);
    if (!t) return ['Click color: the target was deleted or is in another setup'];
    if (t.kind !== 'color') return [`Click color: "${t.name}" is not a color finder`];
    if (!(appearTimeoutMs >= 0)) return ['Click color: the waiting time must be 0 or more'];
    if (waitGone && !(goneTimeoutMs > 0)) return ['Click color: the "until gone" time must be more than 0'];
    if (waitGone && alsoCheckId) {
      const c = targets.get(alsoCheckId);
      if (!c) return ['Click color: the extra check area was deleted'];
      if (!c.snapshot) return [`Click color: "${c.name}" has no snapshot yet`];
    }
    return [];
  }

  async execute(ctx) {
    const { engine, targets, sleep, shouldStop } = ctx;
    const finder = targets.get(this.def.targetId);

    // 1. Find something highlighted (wait for one to appear if needed)
    const end = Date.now() + this.def.appearTimeoutMs;
    let blob = null;
    while (!shouldStop()) {
      blob = this.#choose(engine.findColor(finder), finder.rect);
      if (blob || Date.now() >= end) break;
      await sleep(lookPause());
    }
    if (shouldStop()) return;
    if (!blob) {
      if (this.def.onNone === 'stop') throw new Error(`Nothing highlighted in "${finder.name}"`);
      return; // carry on
    }

    // 2. Click it
    const clicked = await engine.clickBlob(blob, { button: this.def.button ?? 'left', shouldStop, key: finder.id });
    if (!clicked || !this.def.waitGone) return;

    // 3. Watch until the highlight there is gone (or the extra check fires)
    await this.#waitGone(ctx, finder, blob);
  }

  // Nearest to the middle of the search area (where my character stands), or random
  #choose(blobs, rect) {
    if (!blobs.length) return null;
    if (this.def.pick === 'random') return blobs[Math.floor(Math.random() * blobs.length)];
    const mx = rect.x + rect.w / 2, my = rect.y + rect.h / 2;
    return blobs.reduce((best, b) =>
      Math.hypot(b.cx - mx, b.cy - my) < Math.hypot(best.cx - mx, best.cy - my) ? b : best);
  }

  async #waitGone({ engine, targets, sleep, shouldStop }, finder, blob) {
    // Watch a bit more than the blob's box, in case the outline shifts slightly
    const pad = 0.15;
    const area = {
      x: Math.round(blob.x - blob.w * pad), y: Math.round(blob.y - blob.h * pad),
      w: Math.round(blob.w * (1 + 2 * pad)), h: Math.round(blob.h * (1 + 2 * pad)),
    };
    const also = this.def.alsoCheckId ? targets.get(this.def.alsoCheckId) : null;
    const start = Math.max(1, engine.countColor(area, finder));
    const end = Date.now() + this.def.goneTimeoutMs;

    while (!shouldStop() && Date.now() < end) {
      await sleep(lookPause());
      if (engine.countColor(area, finder) < start * GONE_BELOW) return;
      if (also && conditionMet(engine, also, { state: this.def.alsoState, threshold: this.def.alsoThreshold ?? 0.9 })) return;
    }
  }
}
