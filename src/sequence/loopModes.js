// ── Loop modes ────────────────────────────────────────────────────────────────
// Which loops a step runs on. Saved as two flags on the step so the engine
// stays simple: firstLoopOnly (loop 1 only) / skipFirstLoop (loop 2 and after).
// ─────────────────────────────────────────────────────────────────────────────

export const LOOP_MODES = {
  always: { icon: '∞',  badge: '',              title: 'Runs on every loop' },
  first:  { icon: '1×', badge: '1st loop only', title: 'Only on the first loop (e.g. withdraw a tinderbox)' },
  rest:   { icon: '2+', badge: 'from loop 2',   title: 'Skipped on the first loop (e.g. deposit what the last loop made)' },
};

const ORDER = ['always', 'first', 'rest'];

export function loopMode(step) {
  if (step.firstLoopOnly) return 'first';
  if (step.skipFirstLoop) return 'rest';
  return 'always';
}

/** every loop → 1st loop only → from loop 2 → every loop */
export function cycleLoopMode(step) {
  const next = ORDER[(ORDER.indexOf(loopMode(step)) + 1) % ORDER.length];
  step.firstLoopOnly = next === 'first';
  step.skipFirstLoop = next === 'rest';
}

export function isSkipped(step, loop) {
  return (step.firstLoopOnly && loop > 1) || (step.skipFirstLoop && loop === 1);
}
