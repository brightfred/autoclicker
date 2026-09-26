// ── MovementStrategy (interface) ─────────────────────────────────────────────
// Any algorithm that can plan a mouse path from A to B.
// To try a new algorithm (WindMouse, recorded paths...), I create a new class
// that extends this one — nothing else in the app needs to change.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ x: number, y: number, t: number }} PathPoint  t = ms since start
 */

export class MovementStrategy {
  /**
   * Plan a path from `from` to `to`.
   * @param {Point} from
   * @param {Point} to
   * @param {object} [options]
   * @param {number} [options.targetSize] - width of the thing I'm aiming at (px)
   * @returns {PathPoint[]} points ordered by time, last point is exactly `to`
   */
  // eslint-disable-next-line no-unused-vars
  plan(from, to, options = {}) {
    throw new Error(`${this.constructor.name} must implement plan()`);
  }
}
