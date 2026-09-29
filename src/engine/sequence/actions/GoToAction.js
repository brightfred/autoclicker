// ── GoToAction ────────────────────────────────────────────────────────────────
// Always jump: to another step, the next loop, or stop.
// Used with If to build "repeat until" loops:
//   1 Click tree · 2 Pause · 3 If inventory full → go to 5 · 4 Go to 1 · 5 Bank…
//
// def: { type: 'goto', then }   then = a step id, '@next-loop' or '@stop'
// ─────────────────────────────────────────────────────────────────────────────

import { Action } from './Action.js';
import { jumpSignal, jumpProblems } from '../flow.js';

export class GoToAction extends Action {
  validate(ctx) {
    return jumpProblems(this.def.then, { stepIds: ctx.stepIds, selfId: this.def.id }, 'Go to');
  }

  async execute() {
    return jumpSignal(this.def.then, 'a Go to step');
  }
}
