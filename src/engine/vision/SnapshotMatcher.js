// ── SnapshotMatcher ───────────────────────────────────────────────────────────
// Remembers how a screen area looks ("snapshot"), and later tells me how much
// the same area still looks like it (0% – 100%).
//
// I don't keep every pixel: the area is sampled on a small grid (at most
// 48×48 points), so snapshots stay tiny in targets.json and checks take ~1ms.
// A point "matches" when every color channel is within a small tolerance —
// so tiny flickers or anti-aliasing don't break a match.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_MATCH_OPTIONS = {
  maxGrid:   48,  // at most 48×48 sample points per area
  tolerance: 28,  // per color channel (0–255) — how different a point can be and still match
};

export class SnapshotMatcher {
  /**
   * @param {import('./ScreenReader.js').ScreenReader} screen
   * @param {object} [options] - see DEFAULT_MATCH_OPTIONS
   */
  constructor(screen, options = {}) {
    this.screen  = screen;
    this.options = { ...DEFAULT_MATCH_OPTIONS, ...options };
  }

  /**
   * Remember how an area looks right now.
   * @returns {{ cols: number, rows: number, data: string }} data = base64 RGB of the grid
   */
  snapshot(rect) {
    const { cols, rows } = this.#grid(rect);
    const cap   = this.screen.capture(rect);
    const bytes = new Uint8Array(cols * rows * 3);

    this.#eachPoint(cap, cols, rows, (i, [r, g, b]) => {
      bytes[i * 3] = r; bytes[i * 3 + 1] = g; bytes[i * 3 + 2] = b;
    });
    return { cols, rows, data: Buffer.from(bytes).toString('base64') };
  }

  /**
   * How much the area looks like its snapshot right now.
   * @returns {number} 0..1 (1 = identical)
   */
  score(rect, snapshot) {
    const { cols, rows } = snapshot;
    const saved = Buffer.from(snapshot.data, 'base64');
    const cap   = this.screen.capture(rect);
    const tol   = this.options.tolerance;
    let same = 0;

    this.#eachPoint(cap, cols, rows, (i, [r, g, b]) => {
      if (Math.abs(r - saved[i * 3]) <= tol
       && Math.abs(g - saved[i * 3 + 1]) <= tol
       && Math.abs(b - saved[i * 3 + 2]) <= tol) same++;
    });
    return same / (cols * rows);
  }

  // Grid size for an area: every pixel for small areas, sampled for big ones
  #grid(rect) {
    const max = this.options.maxGrid;
    return {
      cols: Math.max(1, Math.min(max, Math.round(rect.w))),
      rows: Math.max(1, Math.min(max, Math.round(rect.h))),
    };
  }

  // Visit the grid points spread evenly over the captured area
  #eachPoint(cap, cols, rows, visit) {
    for (let row = 0; row < rows; row++) {
      const y = Math.min(cap.height - 1, Math.floor((row + 0.5) * cap.height / rows));
      for (let col = 0; col < cols; col++) {
        const x = Math.min(cap.width - 1, Math.floor((col + 0.5) * cap.width / cols));
        visit(row * cols + col, cap.rgb(x, y));
      }
    }
  }
}
