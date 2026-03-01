// ── High Alch Model ───────────────────────────────────────────────────────────
// Two-click cycle: Alch spell → Item
// Timing is asymmetric:
//   spell→item : fast (~300ms)  — just switching from spellbook to inventory
//   item→spell : slow (~3000ms) — waiting for alch animation + spellbook reappear
// ─────────────────────────────────────────────────────────────────────────────

// Weighted pick by proximity to current mouse position.
// Closer positions have exponentially higher weight — mimics natural hand drift.
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

const highAlch = {
  id: 'high-alch',
  name: 'High Alch',
  description: 'Alternates between the alch spell and an item. Handles animation cooldown timing.',

  // ── Recorder config ─────────────────────────────────────────────────────────
  // Tells the recorder how to classify clicks and what to show in the UI.
  recorderConfig: {
    legend: [
      { label: '⚡ Odd clicks  (1, 3, 5…) → Alch spell', type: 'spell' },
      { label: '◈ Even clicks (2, 4, 6…) → Item',       type: 'item'  },
    ],
    classifyClick: (index) => index % 2 === 0 ? 'spell' : 'item',
  },

  // ── Build pools ──────────────────────────────────────────────────────────────
  // Receives the cleaned events array (outliers already removed by core).
  // Returns everything the play() function needs.
  buildPools(events) {
    const spellPool = events.filter(e => e.type === 'spell');
    const itemPool  = events.filter(e => e.type === 'item');

    // spell→item timings: delta values on item events (fast)
    const spellToItemTimings = events
      .filter((e, i) => i > 0 && e.type === 'item')
      .map(e => e.delta)
      .filter(d => d > 50);

    // item→spell timings: delta values on spell events (slow — animation wait)
    const itemToSpellTimings = events
      .filter((e, i) => i > 0 && e.type === 'spell')
      .map(e => e.delta)
      .filter(d => d > 50);

    return { spellPool, itemPool, spellToItemTimings, itemToSpellTimings };
  },

  // ── Playback ─────────────────────────────────────────────────────────────────
  // config  : { reps, varianceFactor, afkChance, afkMinMs, afkMaxMs } — from core
  // robot   : robotjs instance — from core
  // context : { sleep, sendStatus, isPlaying } — from core
  async play(pools, config, robot, context) {
    const { spellPool, itemPool, spellToItemTimings, itemToSpellTimings } = pools;
    const { reps, varianceFactor, afkChance, afkMinMs, afkMaxMs } = config;
    const { sleep, sendStatus, isPlaying } = context;

    if (spellPool.length === 0 || itemPool.length === 0) {
      console.log('[HIGH-ALCH] ERROR — one pool is empty, aborting');
      return;
    }

    console.log(`[HIGH-ALCH] spellPool: ${spellPool.length}, itemPool: ${itemPool.length}`);
    console.log(`[HIGH-ALCH] spellToItem range: ${Math.min(...spellToItemTimings)}–${Math.max(...spellToItemTimings)}ms`);
    console.log(`[HIGH-ALCH] itemToSpell range: ${Math.min(...itemToSpellTimings)}–${Math.max(...itemToSpellTimings)}ms`);

    function pickTiming(timings) {
      const base  = timings[Math.floor(Math.random() * timings.length)];
      const scale = 1 + (Math.random() - 0.5) * 0.2 * varianceFactor;
      return Math.max(50, Math.round(base * scale));
    }

    let currentX = spellPool[0].x;
    let currentY = spellPool[0].y;
    let totalCasts = 0;
    const cyclesPerRep = Math.min(spellPool.length, itemPool.length);

    for (let rep = 0; rep < reps && isPlaying(); rep++) {
      console.log(`[HIGH-ALCH] Rep ${rep + 1}/${reps}`);

      for (let cast = 0; cast < cyclesPerRep && isPlaying(); cast++) {

        // 1. Click alch spell
        const spellEv = weightedProximityPick(spellPool, currentX, currentY, 5);
        robot.moveMouse(spellEv.x, spellEv.y);
        robot.mouseClick();
        currentX = spellEv.x;
        currentY = spellEv.y;
        totalCasts++;
        sendStatus({ cast: totalCasts, rep: rep + 1 });

        const spellToItemWait = pickTiming(spellToItemTimings);
        console.log(`[SPELL] (${spellEv.x},${spellEv.y}) → waiting ${spellToItemWait}ms`);
        await sleep(spellToItemWait);
        if (!isPlaying()) break;

        // 2. Click item
        const itemEv = weightedProximityPick(itemPool, currentX, currentY, 5);
        robot.moveMouse(itemEv.x, itemEv.y);
        robot.mouseClick();
        currentX = itemEv.x;
        currentY = itemEv.y;
        totalCasts++;
        sendStatus({ cast: totalCasts, rep: rep + 1 });

        const itemToSpellWait = pickTiming(itemToSpellTimings);
        console.log(`[ITEM]  (${itemEv.x},${itemEv.y}) → waiting ${itemToSpellWait}ms`);
        await sleep(itemToSpellWait);
        if (!isPlaying()) break;

        // AFK pause — handled by core via afkChance/afkMinMs/afkMaxMs in config
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

    console.log(`[HIGH-ALCH] Session end — totalCasts: ${totalCasts}`);
  },
};

export default highAlch;