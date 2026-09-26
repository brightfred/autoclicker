// ── Action (base class) ──────────────────────────────────────────────────────
// One step of a sequence. Every action type extends this and implements:
//   validate(ctx) → list of problems (empty = OK), checked BEFORE running
//   execute(ctx)  → does the thing (move/click, wait, press key...)
// The runner doesn't know what any action does — it just calls these.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} RunContext
 * @property {import('../../index.js').Engine} engine
 * @property {Map<string, object>} targets   - targets of the setup, by id
 * @property {() => boolean} shouldStop      - true once I pressed Stop / F6
 * @property {(ms:number) => Promise<boolean>} sleep - stoppable sleep, false if stopped
 * @property {() => Promise<void>} breakPoint - maybe take a break here (efficiency policy decides)
 */

export class Action {
  /** @param {object} def - the saved step, e.g. { id, type: 'wait', minMs, maxMs } */
  constructor(def) {
    this.def = def;
  }

  /** @param {RunContext} ctx  @returns {string[]} */
  // eslint-disable-next-line no-unused-vars
  validate(ctx) {
    return [];
  }

  /** @param {RunContext} ctx  @returns {Promise<void>} */
  // eslint-disable-next-line no-unused-vars
  async execute(ctx) {
    throw new Error(`${this.constructor.name} must implement execute()`);
  }
}
