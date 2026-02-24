import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

if (started) app.quit();

let mainWindow;

// Recording state
let recording = false;
let recordingEvents = [];
let recordingStart = null;
let lastEventTime = null;

// Playback state
let playing = false;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 800,
    minHeight: 580,
    frame: false,
    backgroundColor: '#0a0c0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  mainWindow.webContents.openDevTools();
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Weighted pick by distance from current position.
// 0px = weight 1.0, 1px = weight 0.3, 2px = weight 0.09, 3px+ ≈ 0
// Mouse mostly stays on same pixel, occasional 1-2px drift like a real hand.
function weightedProximityPick(pool, currentX, currentY, maxDist = 5) {
  const candidates = pool.filter(ev =>
    Math.hypot(ev.x - currentX, ev.y - currentY) <= maxDist
  );

  // Fall back to full pool if not enough nearby (e.g. very first pick)
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

// Remove outlier events from a pool — anything more than threshold px
// from the median position is considered a misclick/stray click (e.g. stop button)
function removeOutliers(events, threshold = 50) {
  if (events.length < 3) return events;

  const xs = [...events.map(e => e.x)].sort((a, b) => a - b);
  const ys = [...events.map(e => e.y)].sort((a, b) => a - b);
  const medX = xs[Math.floor(xs.length / 2)];
  const medY = ys[Math.floor(ys.length / 2)];

  return events.filter(ev =>
    Math.hypot(ev.x - medX, ev.y - medY) <= threshold
  );
}

// ── Window controls ───────────────────────────────────────────────────────────

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-close', () => mainWindow?.close());

// ── Recording ─────────────────────────────────────────────────────────────────

ipcMain.handle('recording-start', async () => {
  const { uIOhook } = await import('uiohook-napi');
  recording = true;
  recordingEvents = [];
  recordingStart = Date.now();
  lastEventTime = recordingStart;

  uIOhook.on('mousedown', (e) => {
    if (!recording) return;
    const now = Date.now();
    const delta = now - lastEventTime;
    lastEventTime = now;
    const elapsed = now - recordingStart;
    const index = recordingEvents.length;
    const type = index % 2 === 0 ? 'spell' : 'item';
    const event = { x: e.x, y: e.y, delta, elapsed, button: e.button, index, type };
    recordingEvents.push(event);
    mainWindow?.webContents.send('recording-event', event);
  });

  uIOhook.start();
  return { ok: true };
});

ipcMain.handle('recording-stop', async () => {
  const { uIOhook } = await import('uiohook-napi');
  recording = false;
  uIOhook.removeAllListeners('mousedown');
  uIOhook.stop();

  let events = [...recordingEvents];

  // ── Outlier cleanup ───────────────────────────────────────────────────────
  // Split by type, remove outliers from each pool separately, then recombine.
  // Eliminates stop-button clicks, misclicks, stray clicks, etc.
  const spellEvents = removeOutliers(events.filter(e => e.type === 'spell'), 50);
  const itemEvents  = removeOutliers(events.filter(e => e.type === 'item'),  50);
  const spellIds    = new Set(spellEvents.map(e => e.index));
  const itemIds     = new Set(itemEvents.map(e => e.index));
  events = events.filter(e => spellIds.has(e.index) || itemIds.has(e.index));

  const totalDuration = events.length > 0 ? events[events.length - 1].elapsed : 0;
  const deltas = events.map(e => e.delta).filter((_, i) => i > 0);
  const avg = deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
  const variance = deltas.length > 0
    ? deltas.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / deltas.length : 0;

  const spellCount = events.filter(e => e.type === 'spell').length;
  const itemCount  = events.filter(e => e.type === 'item').length;

  return {
    events,
    totalDuration,
    clickCount: events.length,
    spellCount,
    itemCount,
    avgInterval: Math.round(avg),
    stdDevInterval: Math.round(Math.sqrt(variance)),
    minInterval: deltas.length > 0 ? Math.min(...deltas) : 0,
    maxInterval: deltas.length > 0 ? Math.max(...deltas) : 0,
  };
});

// ── Playback ──────────────────────────────────────────────────────────────────

ipcMain.handle('playback-start', async (_, { pattern, config }) => {
  if (playing) return;
  const robotModule = await import('@jitsi/robotjs');
  const robot = robotModule.default;
  playing = true;
  mainWindow?.webContents.send('playback-status', { playing: true, cast: 0, rep: 0 });

  const { reps, afkChance, afkMinMs, afkMaxMs, varianceFactor } = config;

  // Split into spell / item pools by recorded parity
  const spellPool = pattern.events.filter(e => e.type === 'spell');
  const itemPool  = pattern.events.filter(e => e.type === 'item');

  if (spellPool.length === 0 || itemPool.length === 0) {
    console.log(`[PLAYBACK] ERROR — spellPool: ${spellPool.length}, itemPool: ${itemPool.length} — one pool is empty, aborting`);
    playing = false;
    mainWindow?.webContents.send('playback-status', { playing: false, done: true });
    return;
  }

  // ── Two separate timing pools matching click parity ───────────────────────
  // Spell→Item (fast): time between clicking spell and clicking item
  //   = delta values on item events (~200-500ms, just waiting for view switch)
  // Item→Spell (slow): time between clicking item and clicking spell again
  //   = delta values on spell events (~2000-3500ms, waiting for alch animation + spellbook)
  const spellToItemTimings = pattern.events
    .filter((e, i) => i > 0 && e.type === 'item')
    .map(e => e.delta)
    .filter(d => d > 50);

  const itemToSpellTimings = pattern.events
    .filter((e, i) => i > 0 && e.type === 'spell')
    .map(e => e.delta)
    .filter(d => d > 50);

  console.log(`[PLAYBACK] ── Session start ──────────────────────────────`);
  console.log(`[PLAYBACK] spellPool: ${spellPool.length} events, itemPool: ${itemPool.length} events`);
  console.log(`[PLAYBACK] spellToItemTimings: ${spellToItemTimings.length} values, range ${Math.min(...spellToItemTimings)}–${Math.max(...spellToItemTimings)}ms`);
  console.log(`[PLAYBACK] itemToSpellTimings: ${itemToSpellTimings.length} values, range ${Math.min(...itemToSpellTimings)}–${Math.max(...itemToSpellTimings)}ms`);
  console.log(`[PLAYBACK] reps: ${reps}, cyclesPerRep: ${Math.min(spellPool.length, itemPool.length)}`);

  function pickSpellToItem() {
    const base = spellToItemTimings[Math.floor(Math.random() * spellToItemTimings.length)];
    const scale = 1 + (Math.random() - 0.5) * 0.2 * varianceFactor;
    return Math.max(50, Math.round(base * scale));
  }

  function pickItemToSpell() {
    const base = itemToSpellTimings[Math.floor(Math.random() * itemToSpellTimings.length)];
    const scale = 1 + (Math.random() - 0.5) * 0.2 * varianceFactor;
    return Math.max(50, Math.round(base * scale));
  }

  // Start from the first recorded spell position
  let currentX = spellPool[0].x;
  let currentY = spellPool[0].y;

  let totalCasts = 0;
  const cyclesPerRep = Math.min(spellPool.length, itemPool.length);

  for (let rep = 0; rep < reps && playing; rep++) {
    console.log(`[PLAYBACK] ── Rep ${rep + 1}/${reps} start ─────────────────────`);

    for (let cast = 0; cast < cyclesPerRep && playing; cast++) {

      // 1. Click alch spell
      const spellEv = weightedProximityPick(spellPool, currentX, currentY, 5);
      const spellToItemWait = pickSpellToItem();
      console.log(`[SPELL] rep:${rep+1} cast:${cast+1} → (${spellEv.x},${spellEv.y}) | waiting ${spellToItemWait}ms for inventory`);
      robot.moveMouse(spellEv.x, spellEv.y);
      robot.mouseClick();
      currentX = spellEv.x;
      currentY = spellEv.y;
      totalCasts++;

      mainWindow?.webContents.send('playback-status', {
        playing: true, cast: totalCasts, rep: rep + 1,
      });

      await sleep(spellToItemWait);
      if (!playing) break;

      // 2. Click item
      const itemEv = weightedProximityPick(itemPool, currentX, currentY, 5);
      const itemToSpellWait = pickItemToSpell();
      console.log(`[ITEM]  rep:${rep+1} cast:${cast+1} → (${itemEv.x},${itemEv.y}) | waiting ${itemToSpellWait}ms for spellbook`);
      robot.moveMouse(itemEv.x, itemEv.y);
      robot.mouseClick();
      currentX = itemEv.x;
      currentY = itemEv.y;
      totalCasts++;

      mainWindow?.webContents.send('playback-status', {
        playing: true, cast: totalCasts, rep: rep + 1,
      });

      // Wait for alch animation to finish and spellbook to reappear (slow)
      // This MUST happen before anything else to keep the cycle in sync
      await sleep(itemToSpellWait);
      if (!playing) break;

      // AFK pause AFTER the normal cycle completes — additive on top of itemToSpell wait
      if (Math.random() < afkChance) {
        const afkDuration = afkMinMs + Math.random() * (afkMaxMs - afkMinMs);
        console.log(`[AFK]   rep:${rep+1} cast:${cast+1} → pausing ${Math.round(afkDuration)}ms`);
        mainWindow?.webContents.send('playback-status', {
          playing: true, cast: totalCasts, rep: rep + 1, afk: true,
        });
        await sleep(afkDuration);
        if (!playing) break;
        mainWindow?.webContents.send('playback-status', {
          playing: true, cast: totalCasts, rep: rep + 1, afk: false,
        });
      }
    }
  }

  console.log(`[PLAYBACK] ── Session end — totalCasts: ${totalCasts} ────────`);
  playing = false;
  mainWindow?.webContents.send('playback-status', {
    playing: false, cast: totalCasts, rep: reps, done: true,
  });
});

ipcMain.handle('playback-stop', () => {
  console.log(`[PLAYBACK] Stopped by user`);
  playing = false;
});

// ── Hotkey ────────────────────────────────────────────────────────────────────

ipcMain.handle('hotkey-register', (_, key = 'F6') => {
  globalShortcut.unregisterAll();
  globalShortcut.register(key, () => {
    if (playing) {
      playing = false;
      mainWindow?.webContents.send('playback-status', { playing: false, hotkeyStop: true });
    } else {
      mainWindow?.webContents.send('hotkey-play');
    }
  });
});

ipcMain.handle('hotkey-unregister', () => {
  globalShortcut.unregisterAll();
});

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') app.quit();
});