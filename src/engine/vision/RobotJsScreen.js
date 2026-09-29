// ── RobotJsScreen ─────────────────────────────────────────────────────────────
// ScreenReader backed by robotjs' screen.capture().
// robotjs gives raw BGRA bytes; I expose a simple rgb(x, y) instead.
// ─────────────────────────────────────────────────────────────────────────────

import { ScreenReader } from './ScreenReader.js';

export class RobotJsScreen extends ScreenReader {
  constructor(robot) {
    super();
    this.robot = robot;
  }

  capture(rect) {
    const w = Math.max(1, Math.round(rect.w));
    const h = Math.max(1, Math.round(rect.h));
    const bmp = this.robot.screen.capture(Math.round(rect.x), Math.round(rect.y), w, h);

    // On high-DPI screens robotjs can return more pixels than asked for —
    // scale my coordinates to whatever it actually captured
    const sx = bmp.width / w;
    const sy = bmp.height / h;
    const img = bmp.image;

    return {
      width: w,
      height: h,
      rgb: (x, y) => {
        const offset = Math.floor(y * sy) * bmp.byteWidth + Math.floor(x * sx) * bmp.bytesPerPixel;
        return [img[offset + 2], img[offset + 1], img[offset]]; // BGRA → RGB
      },
    };
  }
}
