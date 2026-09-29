// ── Flow signals ──────────────────────────────────────────────────────────────
// What an action can return to change which step runs next.
// Returning nothing = just go on to the next step.
// ─────────────────────────────────────────────────────────────────────────────

export const Flow = {
  /** Jump to another step (by its id) */
  goTo:      (stepId) => ({ goTo: stepId }),
  /** Skip the rest of this loop and start the next one */
  nextLoop:  ()       => ({ nextLoop: true }),
  /** End the whole run (like finishing all loops) */
  stopRun:   (reason) => ({ stopRun: true, reason }),
};

// Where an If / Go to step can send me (besides a specific step)
export const JUMP_SPECIAL = {
  NEXT_LOOP: '@next-loop',
  STOP:      '@stop',
};

/** Turn a saved destination ('@next-loop', '@stop' or a step id) into a flow signal */
export function jumpSignal(destination, reason) {
  if (destination === JUMP_SPECIAL.NEXT_LOOP) return Flow.nextLoop();
  if (destination === JUMP_SPECIAL.STOP) return Flow.stopRun(reason);
  return Flow.goTo(destination);
}

/** Problems with a saved destination */
export function jumpProblems(destination, { stepIds, selfId }, label) {
  if (!destination) return [`${label}: choose where to go`];
  if (destination === JUMP_SPECIAL.NEXT_LOOP || destination === JUMP_SPECIAL.STOP) return [];
  if (destination === selfId) return [`${label}: can't go to itself`];
  if (!stepIds.has(destination)) return [`${label}: the step it goes to was removed`];
  return [];
}
