// ── PointPicker ───────────────────────────────────────────────────────────────
// Picks WHERE inside a target box to click.
// A real player clicks near the middle of things, rarely on the edges,
// so I use a bell curve (gaussian) around the center instead of pure random.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_PICKER_OPTIONS = {
  spread: 0.17,  // standard deviation as a fraction of box size (smaller = tighter on center)
  margin: 0.12,  // never click in the outer 12% of the box
};

// Standard normal random number (Box–Muller)
function gaussian() {
  let u = 0;
  while (u === 0) u = Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export class PointPicker {
  constructor(options = {}) {
    this.options = { ...DEFAULT_PICKER_OPTIONS, ...options };
  }

  /**
   * @param {{x:number,y:number,w:number,h:number}} rect
   * @returns {{x:number,y:number}}
   */
  pick(rect) {
    const { spread, margin } = this.options;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;

    const x = clamp(cx + gaussian() * rect.w * spread, rect.x + rect.w * margin, rect.x + rect.w * (1 - margin));
    const y = clamp(cy + gaussian() * rect.h * spread, rect.y + rect.h * margin, rect.y + rect.h * (1 - margin));
    return { x: Math.round(x), y: Math.round(y) };
  }
}
