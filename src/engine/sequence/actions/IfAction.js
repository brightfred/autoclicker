// ── IfAction ──────────────────────────────────────────────────────────────────
// Look at a Check area ONCE. If the condition is true, jump somewhere
// (another step, the next loop, or stop). If not, just carry on.
//   e.g. "If [Inventory: slot 28 empty] has changed → go to step 'Bank'"
//
// def: { type: 'if', targetId, state: 'same'|'changed', threshold, then }
//      then = a step id, '@next-loop' or '@stop'
// ─────────────────────────────────────────────────────────────────────────────

import { Action } from './Action.js';
import { conditionProblems, conditionMet } from '../conditions.js';
import { jumpSignal, jumpProblems } from '../flow.js';

export class IfAction extends Action {
  validate(ctx) {
    return [
      ...conditionProblems(this.def, ctx.targets, 'If'),
      ...jumpProblems(this.def.then, { stepIds: ctx.stepIds, selfId: this.def.id }, 'If'),
    ];
  }

  async execute({ engine, targets }) {
    const target = targets.get(this.def.targetId);
    if (!conditionMet(engine, target, this.def)) return undefined; // carry on
    const how = this.def.state === 'same' ? 'looked the same' : 'changed';
    return jumpSignal(this.def.then, `"${target.name}" ${how}`);
  }
}
