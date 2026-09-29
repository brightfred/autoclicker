// ── WaitUntilAction ───────────────────────────────────────────────────────────
// Watch a "Check area" target until it looks the SAME as its snapshot
// (e.g. the bank window is open) or has CHANGED (e.g. an item left a slot),
// instead of waiting a fixed time. Gives up after a timeout.
//
// def: { type: 'waitUntil', targetId, state: 'same'|'changed',
//        threshold (0.5–1), timeoutMs, onTimeout: 'continue'|'stop' }
// ─────────────────────────────────────────────────────────────────────────────

import { Action } from './Action.js';
import { conditionProblems, conditionMet } from '../conditions.js';

// How often I look (ms) — a bit random, like glancing at the screen
const LOOK_EVERY_MS = [90, 180];

export class WaitUntilAction extends Action {
  validate({ targets }) {
    const problems = conditionProblems(this.def, targets, 'Wait until');
    if (!(this.def.timeoutMs > 0)) problems.push('Wait until: the timeout must be more than 0');
    return problems;
  }

  async execute({ engine, targets, sleep, shouldStop }) {
    const { targetId, state, threshold, timeoutMs, onTimeout } = this.def;
    const target = targets.get(targetId);
    const end = Date.now() + timeoutMs;

    while (!shouldStop()) {
      if (conditionMet(engine, target, { state, threshold })) return;

      if (Date.now() >= end) {
        if (onTimeout === 'stop') {
          const secs = timeoutMs < 10000 ? (timeoutMs / 1000).toFixed(1) : Math.round(timeoutMs / 1000);
          throw new Error(`"${target.name}" never ${state === 'same' ? 'looked the same' : 'changed'} (waited ${secs}s)`);
        }
        return; // 'continue': carry on with the next step
      }
      await sleep(LOOK_EVERY_MS[0] + Math.random() * (LOOK_EVERY_MS[1] - LOOK_EVERY_MS[0]));
    }
  }
}
