// ── MouseMover ────────────────────────────────────────────────────────────────
// Moves the real cursor along a planned path, in real time.
// It asks a MovementStrategy for the path and an InputDriver to move the mouse.
// (It doesn't know HOW the path is made, or WHICH library moves the mouse.)
//
// Timing: Windows timers are coarse (~15ms), so instead of "sleep 7ms, move,
// sleep 7ms..." I look at the real clock each tick and jump to where the cursor
// SHOULD be at that moment. The move always takes the planned time, and stays
// smooth even if a tick arrives late.
// ─────────────────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export class MouseMover {
  /**
   * @param {import('../input/InputDriver.js').InputDriver} driver
   * @param {import('./MovementStrategy.js').MovementStrategy} strategy
   */
  constructor(driver, strategy) {
    this.driver   = driver;
    this.strategy = strategy;
  }

  /**
   * Move from wherever the mouse is now to `to`.
   * @param {{x:number,y:number}} to
   * @param {object}   [opts]
   * @param {number}   [opts.targetSize]  - size of the target (for Fitts's law)
   * @param {Function} [opts.shouldStop]  - return true to abort mid-move
   * @returns {Promise<boolean>} true if I reached the target, false if stopped
   */
  async moveTo(to, { targetSize, shouldStop = () => false } = {}) {
    const from = this.driver.getPosition();
    const path = this.strategy.plan(from, to, { targetSize });
    return this.#follow(path, shouldStop);
  }

  async #follow(path, shouldStop) {
    const start = Date.now();
    const total = path.at(-1).t;
    let index = 0;

    while (index < path.length - 1) {
      if (shouldStop()) return false;

      const elapsed = Date.now() - start;
      if (elapsed >= total) break;

      // Skip ahead to the last point that should already have happened
      while (index < path.length - 1 && path[index + 1].t <= elapsed) index++;
      this.driver.moveTo(path[index].x, path[index].y);

      await sleep(Math.max(1, path[Math.min(index + 1, path.length - 1)].t - elapsed));
    }

    // Always land exactly on the final point
    const end = path.at(-1);
    this.driver.moveTo(end.x, end.y);
    return true;
  }
}
