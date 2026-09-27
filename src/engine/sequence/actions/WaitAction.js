// ── WaitAction ────────────────────────────────────────────────────────────────
// Wait a random time between min and max (e.g. while the logs burn).
// def: { type: 'wait', minMs, maxMs }
// ─────────────────────────────────────────────────────────────────────────────

import { Action } from './Action.js';

export class WaitAction extends Action {
  validate() {
    const { minMs, maxMs } = this.def;
    if (!(minMs >= 0) || !(maxMs >= 0)) return ['Wait: min and max must be 0 or more'];
    if (minMs > maxMs) return ['Wait: min is bigger than max'];
    return [];
  }

  async execute({ sleep }) {
    const { minMs, maxMs } = this.def;
    await sleep(minMs + Math.random() * (maxMs - minMs));
  }
}
