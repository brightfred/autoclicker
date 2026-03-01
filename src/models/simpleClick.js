// ── Simple Clicker Model ──────────────────────────────────────────────────────
// Single click repeated at a target position.
// One pool, one timing pool — the simplest possible model.
// ─────────────────────────────────────────────────────────────────────────────

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

const simpleClick = {
  id: 'simple-click',
  name: 'Simple Clicker',
  description: 'Repeats a single click at the same position. Good for any single-target action.',

  // ── Recorder config ─────────────────────────────────────────────────────────
  recorderConfig: {
    legend: [
      { label: '◉ All clicks → Target', type: 'click' },
    ],
    classifyClick: (_index) => 'click',
    trackMousePath: false,
  },

  // ── Build pools ──────────────────────────────────────────────────────────────
  buildPools(events) {
    const clickPool = events.filter(e => e.type === 'click');

    const timings = events
      .filter((_, i) => i > 0)
      .map(e => e.delta)
      .filter(d => d > 50);

    return { clickPool, timings };
  },

  // ── Playback ─────────────────────────────────────────────────────────────────
  // config  : { reps, varianceFactor, afkChance, afkMinMs, afkMaxMs } — from core
  // robot   : robotjs instance — from core
  // context : { sleep, sendStatus, isPlaying } — from core
  async play(pools, config, robot, context) {
    const { clickPool, timings } = pools;
    const { reps, varianceFactor, afkChance, afkMinMs, afkMaxMs } = config;
    const { sleep, sendStatus, isPlaying } = context;

    if (clickPool.length === 0) {
      console.log('[SIMPLE-CLICK] ERROR — click pool is empty, aborting');
      return;
    }

    console.log(`[SIMPLE-CLICK] clickPool: ${clickPool.length}`);
    console.log(`[SIMPLE-CLICK] timings range: ${Math.min(...timings)}–${Math.max(...timings)}ms`);

    function pickTiming() {
      const base  = timings[Math.floor(Math.random() * timings.length)];
      const scale = 1 + (Math.random() - 0.5) * 0.2 * varianceFactor;
      return Math.max(50, Math.round(base * scale));
    }

    let currentX = clickPool[0].x;
    let currentY = clickPool[0].y;
    let totalCasts = 0;

    for (let rep = 0; rep < reps && isPlaying(); rep++) {
      console.log(`[SIMPLE-CLICK] Rep ${rep + 1}/${reps}`);

      for (let cast = 0; cast < clickPool.length && isPlaying(); cast++) {

        // Click target
        const ev = weightedProximityPick(clickPool, currentX, currentY, 5);
        robot.moveMouse(ev.x, ev.y);
        robot.mouseClick();
        currentX = ev.x;
        currentY = ev.y;
        totalCasts++;
        sendStatus({ cast: totalCasts, rep: rep + 1 });

        await sleep(pickTiming());
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

    console.log(`[SIMPLE-CLICK] Session end — totalCasts: ${totalCasts}`);
  },
};

export default simpleClick;