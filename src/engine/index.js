// ── Engine ────────────────────────────────────────────────────────────────────
// The one place where I pick which concrete classes the app uses.
// Want a different movement algorithm or mouse library? Change it here only.
// ─────────────────────────────────────────────────────────────────────────────

import { RobotJsDriver } from './input/RobotJsDriver.js';
import { BezierMovement } from './movement/BezierMovement.js';
import { MouseMover } from './movement/MouseMover.js';
import { PointPicker } from './targeting/PointPicker.js';
import { TargetResolver } from './targeting/TargetResolver.js';

export class Engine {
  constructor({ driver, strategy, picker, resolver }) {
    this.driver   = driver;
    this.mover    = new MouseMover(driver, strategy);
    this.picker   = picker;
    this.resolver = resolver;
  }

  /**
   * Move naturally to a random human-like point inside a target.
   * @returns {Promise<{x:number,y:number}>} where I ended up
   */
  async moveToTarget(target, { slot, shouldStop } = {}) {
    const rect  = this.resolver.resolve(target, slot);
    const point = this.picker.pick(rect);
    await this.mover.moveTo(point, { targetSize: Math.min(rect.w, rect.h), shouldStop });
    return point;
  }

  /** Same as moveToTarget, then click */
  async clickTarget(target, { slot, button = 'left', shouldStop } = {}) {
    const rect  = this.resolver.resolve(target, slot);
    const point = this.picker.pick(rect);
    await this.mover.clickAt(point, { button, targetSize: Math.min(rect.w, rect.h), shouldStop });
    return point;
  }
}

/** Build the engine with the real robotjs mouse */
export async function createEngine() {
  const robot = (await import('@jitsi/robotjs')).default;
  return new Engine({
    driver:   new RobotJsDriver(robot),
    strategy: new BezierMovement(),
    picker:   new PointPicker(),
    resolver: new TargetResolver(),
  });
}
