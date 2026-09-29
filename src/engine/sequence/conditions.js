// ── Conditions ────────────────────────────────────────────────────────────────
// "Does this Check area look the same as its snapshot / has it changed?"
// Shared by Wait until (keep looking until true) and If (look once).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Problems with a condition's settings (checked before running).
 * @param {object} def     - step with { targetId, threshold }
 * @param {Map} targets
 * @param {string} label   - step name for the messages, e.g. 'If'
 */
export function conditionProblems(def, targets, label) {
  if (!def.targetId) return [`${label}: choose which area to check`];
  const target = targets.get(def.targetId);
  if (!target) return [`${label}: the area was deleted or is in another setup`];
  if (!target.snapshot) return [`${label} "${target.name}": the area has no snapshot yet — take one in Targets`];
  if (!(def.threshold > 0 && def.threshold <= 1)) return [`${label}: match level must be between 1% and 100%`];
  return [];
}

/** Look at the screen once: is the condition true right now? */
export function conditionMet(engine, target, { state, threshold }) {
  const score = engine.matchScore(target);
  return state === 'same' ? score >= threshold : score < threshold;
}
