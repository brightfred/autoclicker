// ── InputDriver (interface) ──────────────────────────────────────────────────
// The only thing in the app that actually touches the real mouse.
// Everything else talks to this interface, so I could swap robotjs for another
// library (or a fake one for tests) without changing the engine.
// ─────────────────────────────────────────────────────────────────────────────

export class InputDriver {
  /** @returns {{x:number, y:number}} current mouse position */
  getPosition() { throw new Error(`${this.constructor.name} must implement getPosition()`); }

  /** Move the cursor instantly to (x, y) — one step of a path */
  // eslint-disable-next-line no-unused-vars
  moveTo(x, y) { throw new Error(`${this.constructor.name} must implement moveTo()`); }

  /** Press and release a mouse button at the current position */
  // eslint-disable-next-line no-unused-vars
  click(button = 'left') { throw new Error(`${this.constructor.name} must implement click()`); }
}
