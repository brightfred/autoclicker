// ── InputDriver (interface) ──────────────────────────────────────────────────
// The only thing in the app that actually touches the real mouse and keyboard.
// Everything else talks to this interface, so I could swap robotjs for another
// library (or a fake one for tests) without changing the engine.
// ─────────────────────────────────────────────────────────────────────────────

export class InputDriver {
  /** @returns {{x:number, y:number}} current mouse position */
  getPosition() { this.#missing('getPosition'); }

  /** Move the cursor instantly to (x, y) — one step of a path */
  // eslint-disable-next-line no-unused-vars
  moveTo(x, y) { this.#missing('moveTo'); }

  /** Press a mouse button down (no release) */
  // eslint-disable-next-line no-unused-vars
  mouseDown(button = 'left') { this.#missing('mouseDown'); }

  /** Release a mouse button */
  // eslint-disable-next-line no-unused-vars
  mouseUp(button = 'left') { this.#missing('mouseUp'); }

  /** Press a key down (no release), e.g. 'escape', 'space', '1' */
  // eslint-disable-next-line no-unused-vars
  keyDown(key) { this.#missing('keyDown'); }

  /** Release a key */
  // eslint-disable-next-line no-unused-vars
  keyUp(key) { this.#missing('keyUp'); }

  #missing(name) {
    throw new Error(`${this.constructor.name} must implement ${name}()`);
  }
}
