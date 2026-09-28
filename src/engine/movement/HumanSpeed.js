// ── HumanSpeed ────────────────────────────────────────────────────────────────
// Decides how fast each mouse movement is, the way a real hand varies:
//
//   1. Tempo: my overall speed slowly wanders during a session (getting into a
//      rhythm, getting lazy) — a gentle random walk that drifts back toward normal.
//   2. Per move: around that tempo, each move is a little faster or slower
//      (most within ±9%, never more than ±20%).
//   3. Shape: where the top speed happens changes every move — sometimes early
//      (quick flick, long careful landing), sometimes closer to the middle.
//
// BezierMovement asks next() once per movement.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_SPEED_OPTIONS = {
  perMoveSd:     0.09,         // typical move: within ±9% of the current tempo
  perMoveMax:    0.20,         // never more than ±20% off the tempo
  tempoStep:     0.03,         // how far the tempo can wander between two moves
  tempoPull:     0.06,         // how strongly it drifts back toward normal (1.0)
  tempoRange:    [0.88, 1.12], // overall tempo stays within 12% slower / faster
  peakRange:     [0.36, 0.54], // top speed at 36–54% of the move (humans peak a bit early)
};

// Standard normal random number (Box–Muller)
function gaussian(random) {
  let u = 0;
  while (u === 0) u = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export class HumanSpeed {
  #tempo = 1;

  /**
   * @param {object} [options]       - see DEFAULT_SPEED_OPTIONS
   * @param {() => number} [random]  - injectable for tests
   */
  constructor(options = {}, random = Math.random) {
    this.options = { ...DEFAULT_SPEED_OPTIONS, ...options };
    this.random  = random;
  }

  /** Current tempo (1 = normal, 0.95 = 5% faster moves, 1.05 = 5% slower) */
  get tempo() {
    return this.#tempo;
  }

  /**
   * Speed for the next movement.
   * @returns {{ durationFactor: number, peakAt: number }}
   *   durationFactor — multiply the planned duration by this (>1 = slower)
   *   peakAt         — 0..1, when in the move the top speed is reached
   */
  next() {
    const o = this.options;

    // 1. Tempo wanders a little, and is gently pulled back toward normal
    const drift = gaussian(this.random) * o.tempoStep - (this.#tempo - 1) * o.tempoPull;
    this.#tempo = clamp(this.#tempo + drift, ...o.tempoRange);

    // 2. This move: slightly faster or slower than the tempo
    const wobble = clamp(gaussian(this.random) * o.perMoveSd, -o.perMoveMax, o.perMoveMax);

    // 3. Where the top speed happens
    const [minPeak, maxPeak] = o.peakRange;
    const peakAt = minPeak + (maxPeak - minPeak) * this.random();

    return { durationFactor: this.#tempo * (1 + wobble), peakAt };
  }
}
