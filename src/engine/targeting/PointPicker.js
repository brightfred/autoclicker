// ── PointPicker ───────────────────────────────────────────────────────────────
// Picks WHERE inside a target box to click — a different pixel every time.
//
// How a real hand clicks the same thing over and over:
//   - Around the middle, rarely near the edges → bell curve (gaussian), never
//     in the outer margin of the box.
//   - Not exactly the middle: each target gets its own "favourite spot", a bit
//     off-center, that slowly drifts while I play.
//   - Never the exact same pixel twice in a row on the same target.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_PICKER_OPTIONS = {
  spread:      0.17,  // bell-curve width, as a fraction of box size (smaller = tighter)
  margin:      0.12,  // never click in the outer 12% of the box
  habitRange:  0.12,  // favourite spot stays within ±12% of the box size from the center
  habitDrift:  0.015, // how far the favourite spot wanders per click
};

const MAX_TRIES = 12;

// Standard normal random number (Box–Muller)
function gaussian(random) {
  let u = 0;
  while (u === 0) u = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export class PointPicker {
  #habits = new Map(); // key → { dx, dy } favourite offset (fraction of box size)
  #last   = new Map(); // key → last clicked point, so I never repeat it

  /**
   * @param {object} [options]       - see DEFAULT_PICKER_OPTIONS
   * @param {() => number} [random]  - injectable for tests
   */
  constructor(options = {}, random = Math.random) {
    this.options = { ...DEFAULT_PICKER_OPTIONS, ...options };
    this.random  = random;
  }

  /**
   * @param {{x:number,y:number,w:number,h:number}} rect
   * @param {string} [key] - which target this is (e.g. "bank" or "inv:16"), so
   *                         each one keeps its own favourite spot. No key = no memory.
   * @returns {{x:number,y:number}}
   */
  pick(rect, key) {
    const { spread, margin } = this.options;
    const habit = key ? this.#nextHabit(key) : { dx: 0, dy: 0 };

    const cx = rect.x + rect.w * (0.5 + habit.dx);
    const cy = rect.y + rect.h * (0.5 + habit.dy);
    const minX = rect.x + rect.w * margin, maxX = rect.x + rect.w * (1 - margin);
    const minY = rect.y + rect.h * margin, maxY = rect.y + rect.h * (1 - margin);
    const last = key ? this.#last.get(key) : null;

    // Re-roll points outside the allowed area (instead of squashing them onto
    // its edge) and the exact same pixel as last time
    let point = null;
    for (let i = 0; i < MAX_TRIES && !point; i++) {
      const x = Math.round(cx + gaussian(this.random) * rect.w * spread);
      const y = Math.round(cy + gaussian(this.random) * rect.h * spread);
      const inside = x >= minX && x <= maxX && y >= minY && y <= maxY;
      const repeat = last && last.x === x && last.y === y;
      if (inside && !repeat) point = { x, y };
    }

    // Tiny boxes can run out of tries — fall back to a clamped point
    point ??= {
      x: Math.round(clamp(cx, minX, maxX)),
      y: Math.round(clamp(cy, minY, maxY)),
    };

    if (key) this.#last.set(key, point);
    return point;
  }

  // The favourite spot takes a small random step each click, staying near the center
  #nextHabit(key) {
    const { habitRange, habitDrift } = this.options;
    const current = this.#habits.get(key) ?? {
      dx: (this.random() * 2 - 1) * habitRange * 0.5,
      dy: (this.random() * 2 - 1) * habitRange * 0.5,
    };
    const next = {
      dx: clamp(current.dx + gaussian(this.random) * habitDrift, -habitRange, habitRange),
      dy: clamp(current.dy + gaussian(this.random) * habitDrift, -habitRange, habitRange),
    };
    this.#habits.set(key, next);
    return next;
  }
}
