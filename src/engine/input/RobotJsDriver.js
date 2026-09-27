// ── RobotJsDriver ─────────────────────────────────────────────────────────────
// InputDriver backed by @jitsi/robotjs.
// ─────────────────────────────────────────────────────────────────────────────

import { InputDriver } from './InputDriver.js';

// Windows sends the raw wheel value (one notch = 120), Linux/X11 counts notches
const WHEEL_UNIT = process.platform === 'win32' ? 120 : 1;

export class RobotJsDriver extends InputDriver {
  constructor(robot) {
    super();
    this.robot = robot;

    // robotjs waits after EVERY move/key by default — that would make my
    // paths slow and jerky. The engine handles all the timing itself.
    this.robot.setMouseDelay(0);
    this.robot.setKeyboardDelay(0);
  }

  getPosition() {
    return this.robot.getMousePos();
  }

  moveTo(x, y) {
    this.robot.moveMouse(Math.round(x), Math.round(y));
  }

  mouseDown(button = 'left') {
    this.robot.mouseToggle('down', button);
  }

  mouseUp(button = 'left') {
    this.robot.mouseToggle('up', button);
  }

  scroll(notches) {
    this.robot.scrollMouse(0, Math.round(notches) * WHEEL_UNIT);
  }

  keyDown(key) {
    this.robot.keyToggle(key, 'down');
  }

  keyUp(key) {
    this.robot.keyToggle(key, 'up');
  }
}
