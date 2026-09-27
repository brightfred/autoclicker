// ── Engine ────────────────────────────────────────────────────────────────────
// What the rest of the app uses to act on the game: move, click, press keys.
// createEngine() is the one place where I pick which concrete classes are used.
// Want a different movement algorithm or input library? Change it there only.
// ─────────────────────────────────────────────────────────────────────────────

import { RobotJsDriver } from './input/RobotJsDriver.js';
import { BezierMovement } from './movement/BezierMovement.js';
import { MouseMover } from './movement/MouseMover.js';
import { PointPicker } from './targeting/PointPicker.js';
import { TargetResolver } from './targeting/TargetResolver.js';

// How long a real finger holds a button/key before releasing (ms)
export const DEFAULT_HOLD = {
  click: [55, 125],
  key:   [60, 140],
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randBetween = ([min, max]) => min + Math.random() * (max - min);

export class Engine {
  constructor({ driver, strategy, picker, resolver, hold = DEFAULT_HOLD }) {
    this.driver   = driver;
    this.mover    = new MouseMover(driver, strategy);
    this.picker   = picker;
    this.resolver = resolver;
    this.hold     = hold;
  }

  /**
   * Move naturally to a human-like point inside a target (no click).
   * @returns {Promise<{x:number,y:number}|null>} where I ended up, null if stopped
   */
  async moveToTarget(target, { slot, shouldStop } = {}) {
    const rect    = this.resolver.resolve(target, slot);
    const point   = this.picker.pick(rect);
    const reached = await this.mover.moveTo(point, { targetSize: Math.min(rect.w, rect.h), shouldStop });
    return reached ? point : null;
  }

  /** Move to the target, then click it (only if I actually got there) */
  async clickTarget(target, { slot, button = 'left', shouldStop } = {}) {
    const point = await this.moveToTarget(target, { slot, shouldStop });
    if (point) await this.click(button);
    return point;
  }

  /** Click where the mouse is, holding the button a human-like moment */
  async click(button = 'left') {
    this.driver.mouseDown(button);
    await sleep(randBetween(this.hold.click));
    this.driver.mouseUp(button);
  }

  /** Hold a key down for a while (e.g. arrow key to tilt the camera) — stoppable */
  async holdKey(key, ms, { shouldStop = () => false } = {}) {
    this.driver.keyDown(key);
    const end = Date.now() + ms;
    while (Date.now() < end && !shouldStop()) {
      await sleep(Math.min(50, end - Date.now()));
    }
    this.driver.keyUp(key);
  }

  /**
   * Scroll the wheel like a finger does: a few quick flicks of 2–5 notches
   * with short pauses, instead of one inhuman burst.
   */
  async scroll(notches, { shouldStop = () => false } = {}) {
    const direction = Math.sign(notches);
    let left = Math.abs(notches);
    while (left > 0 && !shouldStop()) {
      const flick = Math.min(left, 2 + Math.floor(Math.random() * 4));
      for (let i = 0; i < flick; i++) {
        this.driver.scroll(direction);
        await sleep(randBetween([18, 45]));
      }
      left -= flick;
      await sleep(randBetween([90, 260]));
    }
  }

  /** Tap a key, holding it a human-like moment */
  async pressKey(key) {
    this.driver.keyDown(key);
    await sleep(randBetween(this.hold.key));
    this.driver.keyUp(key);
  }
}

/** Build the engine with the real robotjs mouse/keyboard */
export async function createEngine() {
  const robot = (await import('@jitsi/robotjs')).default;
  return new Engine({
    driver:   new RobotJsDriver(robot),
    strategy: new BezierMovement(),
    picker:   new PointPicker(),
    resolver: new TargetResolver(),
  });
}
