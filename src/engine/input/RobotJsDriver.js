// ── RobotJsDriver ─────────────────────────────────────────────────────────────
// InputDriver backed by @jitsi/robotjs.
// ─────────────────────────────────────────────────────────────────────────────

import { InputDriver } from './InputDriver.js';

export class RobotJsDriver extends InputDriver {
  constructor(robot) {
    super();
    this.robot = robot;

    // robotjs waits 10ms after EVERY move by default — that would make my
    // paths slow and jerky. The MouseMover handles all the timing itself.
    this.robot.setMouseDelay(0);
  }

  getPosition() {
    return this.robot.getMousePos();
  }

  moveTo(x, y) {
    this.robot.moveMouse(Math.round(x), Math.round(y));
  }

  click(button = 'left') {
    this.robot.mouseClick(button);
  }
}
