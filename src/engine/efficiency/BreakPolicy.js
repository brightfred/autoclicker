// ── BreakPolicy (interface) ──────────────────────────────────────────────────
// Decides WHEN I take a break and HOW LONG, and how much my pace drags.
// The runner only asks these two questions — swap in a different policy class
// (e.g. a fixed schedule) without touching the runner.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} ClockSnapshot
 * @property {number} activeMs          - total working time so far
 * @property {number} breakMs           - total break time so far
 * @property {number} sinceBreakMs      - time since the last break
 * @property {Object<string,number>} sinceKindMs - time since the last break of each kind
 *
 * @typedef {{ kind: string, label: string, ms: number }} BreakDecision
 */

export class BreakPolicy {
  /** Break kinds this policy uses — the clock tracks "time since" for each */
  get kinds() {
    return [];
  }

  /** Called after a break has actually been taken */
  // eslint-disable-next-line no-unused-vars
  onBreakTaken(decision) {}

  /**
   * Called at every break point.
   * @param {ClockSnapshot} clock
   * @returns {BreakDecision|null} a break to take now, or null to keep going
   */
  // eslint-disable-next-line no-unused-vars
  decide(clock) {
    throw new Error(`${this.constructor.name} must implement decide()`);
  }

  /**
   * How much slower than normal I react right now (1 = normal, 1.3 = 30% slower).
   * @param {ClockSnapshot} clock
   */
  // eslint-disable-next-line no-unused-vars
  paceMultiplier(clock) {
    return 1;
  }
}

/** 100% efficiency: never a break, never tired */
export class NoBreakPolicy extends BreakPolicy {
  decide() {
    return null;
  }
}
