// ── ScreenReader (interface) ─────────────────────────────────────────────────
// The only thing in the app that LOOKS at the screen. Everything else asks this
// interface, so I could swap robotjs for another capture library (or a fake one
// for tests) without touching the rest.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} Capture
 * @property {number} width
 * @property {number} height
 * @property {(x:number, y:number) => [number, number, number]} rgb - color at a pixel (0..255 each)
 */

export class ScreenReader {
  /**
   * Grab a rectangle of the real screen (real screen pixels, same as targets).
   * @param {{x:number,y:number,w:number,h:number}} rect
   * @returns {Capture}
   */
  // eslint-disable-next-line no-unused-vars
  capture(rect) {
    throw new Error(`${this.constructor.name} must implement capture()`);
  }
}
