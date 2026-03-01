// ── Dart Fletching Model ──────────────────────────────────────────────────────
// Two-click cycle: Slot A (feather) ↔ Slot B (dart tip)
// Timing is symmetric — both clicks use the same timing pool (~305ms).
// Mouse movement between clicks is recorded and replayed via mouseTracker.
// ─────────────────────────────────────────────────────────────────────────────

import { replayPath } from '../utils/mouseTracker.js';

// Weighted pick by proximity to current mouse position.
function weightedProximityPick(pool, currentX, currentY, maxDist = 5) {
  const candidates = pool.filter(ev =>
    Math.hypot(ev.x - currentX, ev.y - currentY) <= maxDist
  );

  const source = candidates.length >= 3 ? candidates : pool;

  const weights = source.map(ev => {
    const dist = Math.hypot(ev.x - currentX, ev.y - currentY);
    return Math.pow(0.3, dist);
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < source.length; i++) {
    r -= weights[i];
    if (r <= 0) return source[i];
  }
  return source[source.length - 1];
}

const dart = {
  id: 'dart',
  name: 'Dart Fletching',
  description: 'Alternates between feather and dart tip. Records natural mouse movement between clicks.',

  // ── Recorder config ─────────────────────────────────────────────────────────
  recorderConfig: {
    legend: [
      { label: '◈ Odd clicks  (1, 3, 5…) → Slot A (feather)',   type: 'slotA' },
      { label: '◈ Even clicks (2, 4, 6…) → Slot B (dart tip)',  type: 'slotB' },
    ],
    classifyClick: (index) => index % 2 === 0 ? 'slotA' : 'slotB',
    trackMousePath: true, // tells the recorder to use mouseTracker between clicks
  },

  // ── Build pools ──────────────────────────────────────────────────────────────
  // events     : cleaned click events from core
  // mousePaths : array of recorded paths between clicks, from mouseTracker
  buildPools(events, mousePaths = []) {
    const slotAPool = events.filter(e => e.type === 'slotA');
    const slotBPool = events.filter(e => e.type === 'slotB');

    // Single symmetric timing pool — all deltas regardless of click type
    const timings = events
      .filter((_, i) => i > 0)
      .map(e => e.delta)
      .filter(d => d > 50);

    return { slotAPool, slotBPool, timings, mousePaths };
  },

  // ── Playback ─────────────────────────────────────────────────────────────────
  // config  : { reps, varianceFactor, afkChance, afkMinMs, afkMaxMs } — from core
  // robot   : robotjs instance — from core
  // context : { sleep, sendStatus, isPlaying } — from core
  async play(pools, config, robot, context) {
    const { slotAPool, slotBPool, timings, mousePaths } = pools;
    const { reps, varianceFactor, afkChance, afkMinMs, afkMaxMs } = config;
    const { sleep, sendStatus, isPlaying } = context;

    if (slotAPool.length === 0 || slotBPool.length === 0) {
      console.log('[DART] ERROR — one pool is empty, aborting');
      return;
    }

    console.log(`[DART] slotAPool: ${slotAPool.length}, slotBPool: ${slotBPool.length}`);
    console.log(`[DART] timings range: ${Math.min(...timings)}–${Math.max(...timings)}ms`);
    console.log(`[DART] mousePaths in pool: ${mousePaths.length}`);

    function pickTiming() {
      const base  = timings[Math.floor(Math.random() * timings.length)];
      const scale = 1 + (Math.random() - 0.5) * 0.2 * varianceFactor;
      return Math.max(50, Math.round(base * scale));
    }

    let currentX = slotAPool[0].x;
    let currentY = slotAPool[0].y;
    let totalCasts = 0;
    const cyclesPerRep = Math.min(slotAPool.length, slotBPool.length);

    for (let rep = 0; rep < reps && isPlaying(); rep++) {
      console.log(`[DART] Rep ${rep + 1}/${reps}`);

      for (let cast = 0; cast < cyclesPerRep && isPlaying(); cast++) {

        // 1. Click slot A
        const slotAEv = weightedProximityPick(slotAPool, currentX, currentY, 5);
        robot.moveMouse(slotAEv.x, slotAEv.y);
        robot.mouseClick();
        currentX = slotAEv.x;
        currentY = slotAEv.y;
        totalCasts++;
        sendStatus({ cast: totalCasts, rep: rep + 1 });

        // Replay a recorded mouse path toward slot B
        if (mousePaths.length > 0) {
          await replayPath(mousePaths, robot, sleep, isPlaying);
        } else {
          await sleep(pickTiming());
        }
        if (!isPlaying()) break;

        // 2. Click slot B
        const slotBEv = weightedProximityPick(slotBPool, currentX, currentY, 5);
        robot.moveMouse(slotBEv.x, slotBEv.y);
        robot.mouseClick();
        currentX = slotBEv.x;
        currentY = slotBEv.y;
        totalCasts++;
        sendStatus({ cast: totalCasts, rep: rep + 1 });

        // Replay a recorded mouse path back toward slot A
        if (mousePaths.length > 0) {
          await replayPath(mousePaths, robot, sleep, isPlaying);
        } else {
          await sleep(pickTiming());
        }
        if (!isPlaying()) break;

        // AFK pause
        if (Math.random() < afkChance) {
          const afkDuration = afkMinMs + Math.random() * (afkMaxMs - afkMinMs);
          console.log(`[AFK] pausing ${Math.round(afkDuration)}ms`);
          sendStatus({ cast: totalCasts, rep: rep + 1, afk: true });
          await sleep(afkDuration);
          if (!isPlaying()) break;
          sendStatus({ cast: totalCasts, rep: rep + 1, afk: false });
        }
      }
    }

    console.log(`[DART] Session end — totalCasts: ${totalCasts}`);
  },
};

export default dart;