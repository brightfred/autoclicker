// ── BreakPointAction ──────────────────────────────────────────────────────────
// A spot in the sequence where a break is ALLOWED (not forced).
// The efficiency policy decides if I actually take one here, and how long.
// def: { type: 'breakpoint' }
// ─────────────────────────────────────────────────────────────────────────────

import { Action } from './Action.js';

export class BreakPointAction extends Action {
  async execute({ breakPoint }) {
    await breakPoint();
  }
}
