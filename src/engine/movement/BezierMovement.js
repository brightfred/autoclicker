// ── BezierMovement ────────────────────────────────────────────────────────────
// Plans a natural-looking mouse path:
//   - Curved path: a cubic Bezier with 2 random control points off to one side
//   - Duration from Fitts's law: far or small targets take longer, like a real hand
//   - Speed profile: starts slow, speeds up, slows down near the target
//     (minimum-jerk curve, the way human arm movements behave)
//   - Speed varies like a hand: a slowly wandering tempo, each move a bit
//     faster or slower, and top speed at a different moment each time
//     (all decided by HumanSpeed)
//   - Tiny hand tremor along the path
//   - Sometimes overshoots on long moves, then corrects back onto the target
// Every call is random, so no two paths are ever the same.
// ─────────────────────────────────────────────────────────────────────────────

import { MovementStrategy } from './MovementStrategy.js';
import { HumanSpeed } from './HumanSpeed.js';

// All the knobs in one place so I can tune the feel without touching the math
export const DEFAULT_BEZIER_OPTIONS = {
  fittsA:           90,    // ms — base reaction/move time
  fittsB:           120,   // ms — extra time per "bit" of difficulty
  minDuration:      70,    // ms
  maxDuration:      1400,  // ms
  curveSpread:      0.22,  // how far control points can go from the straight line (× distance)
  maxCurveOffset:   180,   // px — cap on that offset for long moves
  sampleEveryMs:    7,     // one planned point every ~7ms (~140 Hz)
  tremorPx:         0.6,   // px — hand tremor amplitude
  overshootChance:  0.22,  // chance to overshoot on long moves
  overshootMinDist: 280,   // px — only moves longer than this can overshoot
  overshootPx:      [6, 18], // px — how far past the target
};

// Minimum-jerk position profile: 0 → 1 with smooth start and stop
function minimumJerk(t) {
  return t * t * t * (10 - 15 * t + 6 * t * t);
}

// Same smooth start/stop, but with top speed at `peakAt` instead of exactly
// halfway: I bend time first (t^k) so that the curve's middle lands at peakAt.
function minimumJerkPeakAt(t, peakAt) {
  const k = Math.log(0.5) / Math.log(peakAt);
  return minimumJerk(Math.pow(t, k));
}

function cubicBezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

export class BezierMovement extends MovementStrategy {
  /**
   * @param {object} [options]    - see DEFAULT_BEZIER_OPTIONS
   * @param {HumanSpeed} [speed]  - decides how fast each move is
   */
  constructor(options = {}, speed = new HumanSpeed()) {
    super();
    this.options = { ...DEFAULT_BEZIER_OPTIONS, ...options };
    this.speed   = speed;
  }

  plan(from, to, { targetSize = 30 } = {}) {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    if (distance < 1) return [{ x: Math.round(to.x), y: Math.round(to.y), t: 0 }];

    const { overshootChance, overshootMinDist, overshootPx } = this.options;

    // How fast this particular move is (tempo + per-move wobble + speed shape)
    const speed = this.speed.next();

    // Long move + bad luck = overshoot a little past the target, then correct
    if (distance > overshootMinDist && Math.random() < overshootChance) {
      const overshoot = this.#overshootPoint(from, to, rand(...overshootPx));
      const first  = this.#segment(from, overshoot, targetSize, speed);
      const second = this.#segment(overshoot, to, targetSize * 2, speed, first.at(-1).t);
      return this.#finalize([...first, ...second.slice(1)], to);
    }

    return this.#finalize(this.#segment(from, to, targetSize, speed), to);
  }

  // ── One curved segment ────────────────────────────────────────────────────

  #segment(from, to, targetSize, speed, startTime = 0) {
    const o = this.options;
    const distance = Math.hypot(to.x - from.x, to.y - from.y);

    // Fitts's law: time = a + b * log2(distance / size + 1), then HumanSpeed's factor
    const fitts    = o.fittsA + o.fittsB * Math.log2(distance / Math.max(targetSize, 1) + 1);
    const duration = Math.min(o.maxDuration, Math.max(o.minDuration, fitts * speed.durationFactor));

    const [c1, c2] = this.#controlPoints(from, to, distance);
    const steps    = Math.max(6, Math.round(duration / o.sampleEveryMs));

    // Tremor phase is random per move so it never repeats
    const phase = rand(0, Math.PI * 2);
    const freq  = rand(2, 4);
    const nx = -(to.y - from.y) / distance; // unit normal to the straight line
    const ny =  (to.x - from.x) / distance;

    const points = [];
    for (let i = 0; i <= steps; i++) {
      const linear = i / steps;
      const eased  = minimumJerkPeakAt(linear, speed.peakAt);
      const p      = cubicBezier(from, c1, c2, to, eased);

      // Tremor fades out at both ends so start/end are exact
      const fade   = Math.sin(Math.PI * linear);
      const wobble = Math.sin(phase + linear * Math.PI * 2 * freq) * o.tremorPx * fade;

      points.push({
        x: p.x + nx * wobble,
        y: p.y + ny * wobble,
        t: startTime + linear * duration,
      });
    }
    return points;
  }

  // Two control points, both pushed to the same side of the line (a natural arc),
  // placed around 1/3 and 2/3 of the way with some randomness
  #controlPoints(from, to, distance) {
    const o = this.options;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const nx = -dy / distance;
    const ny =  dx / distance;

    const maxOffset = Math.min(o.maxCurveOffset, distance * o.curveSpread);
    const side = Math.random() < 0.5 ? -1 : 1;

    // Most moves get a gentle bow, a few get a bigger arc (the power curve
    // makes small offsets much more likely than big ones)
    const bow = 0.12 + 0.88 * Math.pow(Math.random(), 1.7);

    return [rand(0.2, 0.45), rand(0.55, 0.85)].map(along => {
      const offset = side * bow * rand(0.7, 1.15) * maxOffset;
      return {
        x: from.x + dx * along + nx * offset,
        y: from.y + dy * along + ny * offset,
      };
    });
  }

  #overshootPoint(from, to, px) {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const ux = (to.x - from.x) / distance;
    const uy = (to.y - from.y) / distance;
    const sideways = rand(-0.5, 0.5) * px;
    return {
      x: to.x + ux * px - uy * sideways,
      y: to.y + uy * px + ux * sideways,
    };
  }

  // Round to real pixels, drop duplicate pixels, and make sure I end exactly on target
  #finalize(points, to) {
    const out = [];
    for (const p of points) {
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      const last = out.at(-1);
      if (last && last.x === x && last.y === y) {
        last.t = Math.round(p.t);
        continue;
      }
      out.push({ x, y, t: Math.round(p.t) });
    }
    const end = out.at(-1);
    end.x = Math.round(to.x);
    end.y = Math.round(to.y);
    return out;
  }
}
