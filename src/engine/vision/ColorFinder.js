// ── ColorFinder ───────────────────────────────────────────────────────────────
// Finds things highlighted in one color inside a screen area — e.g. trees
// marked by RuneLite's Object Markers (clickbox outline in magenta #FF00FF).
//
// How:
//   1. Look at every `step`-th pixel of the area and mark the ones close to
//      the color (within `tolerance` on each channel).
//   2. Group marked points that touch — or almost touch (`joinGap`), since an
//      outline can have small gaps — into blobs: one blob = one highlighted thing.
//   3. Drop tiny blobs (stray pixels), return the rest with their box and center.
// A stump has no highlight, so it simply isn't found.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_FINDER_OPTIONS = {
  step:      2,   // look at every 2nd pixel (4× faster, outlines are ≥ 1px wide… and long)
  joinGap:   3,   // grid cells: marked points this close belong to the same blob
  minPoints: 8,   // smaller blobs are noise
};

/** '#ff00ff' → [255, 0, 255] */
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}

export class ColorFinder {
  /**
   * @param {import('./ScreenReader.js').ScreenReader} screen
   * @param {object} [options] - see DEFAULT_FINDER_OPTIONS
   */
  constructor(screen, options = {}) {
    this.screen  = screen;
    this.options = { ...DEFAULT_FINDER_OPTIONS, ...options };
  }

  /**
   * @param {{x,y,w,h}} rect       - where to look (real screen pixels)
   * @param {string} color         - '#rrggbb'
   * @param {number} tolerance     - 0–255 per channel
   * @returns {{x:number,y:number,w:number,h:number,cx:number,cy:number,points:number}[]}
   *          blobs in real screen pixels, biggest first
   */
  find(rect, color, tolerance = 40) {
    const { step } = this.options;
    const cap = this.screen.capture(rect);
    const [tr, tg, tb] = hexToRgb(color);
    const cols = Math.ceil(cap.width / step);
    const rows = Math.ceil(cap.height / step);

    // 1. Mark matching grid points
    const marked = new Uint8Array(cols * rows);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const [r, g, b] = cap.rgb(col * step, row * step);
        if (Math.abs(r - tr) <= tolerance && Math.abs(g - tg) <= tolerance && Math.abs(b - tb) <= tolerance) {
          marked[row * cols + col] = 1;
        }
      }
    }

    // 2–3. Group into blobs, convert to screen pixels
    return this.#blobs(marked, cols, rows)
      .filter(b => b.points >= this.options.minPoints)
      .map(b => {
        const x = rect.x + b.minCol * step;
        const y = rect.y + b.minRow * step;
        const w = (b.maxCol - b.minCol + 1) * step;
        const h = (b.maxRow - b.minRow + 1) * step;
        return {
          x, y, w, h,
          cx: Math.round(rect.x + (b.sumCol / b.points) * step),
          cy: Math.round(rect.y + (b.sumRow / b.points) * step),
          points: b.points,
        };
      })
      .sort((a, b) => b.points - a.points);
  }

  /** How many grid points of the color are inside an area right now */
  count(rect, color, tolerance = 40) {
    return this.find(rect, color, tolerance).reduce((sum, b) => sum + b.points, 0);
  }

  // Flood fill over marked cells; neighbours within joinGap cells are connected
  #blobs(marked, cols, rows) {
    const gap = this.options.joinGap;
    const seen = new Uint8Array(marked.length);
    const blobs = [];

    for (let start = 0; start < marked.length; start++) {
      if (!marked[start] || seen[start]) continue;
      const blob = { points: 0, sumCol: 0, sumRow: 0, minCol: Infinity, maxCol: -1, minRow: Infinity, maxRow: -1 };
      const stack = [start];
      seen[start] = 1;

      while (stack.length) {
        const i = stack.pop();
        const col = i % cols, row = (i - col) / cols;
        blob.points++;
        blob.sumCol += col; blob.sumRow += row;
        blob.minCol = Math.min(blob.minCol, col); blob.maxCol = Math.max(blob.maxCol, col);
        blob.minRow = Math.min(blob.minRow, row); blob.maxRow = Math.max(blob.maxRow, row);

        for (let dy = -gap; dy <= gap; dy++) {
          const r = row + dy;
          if (r < 0 || r >= rows) continue;
          for (let dx = -gap; dx <= gap; dx++) {
            const c = col + dx;
            if (c < 0 || c >= cols) continue;
            const j = r * cols + c;
            if (marked[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
          }
        }
      }
      blobs.push(blob);
    }
    return blobs;
  }
}
