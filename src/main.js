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

function gaussianRandom(mean, std) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

async function moveMouse(robot, fromX, fromY, toX, toY, durationMs) {
  const steps = Math.max(8, Math.round(durationMs / 10));
  const cp1x = fromX + (toX - fromX) * 0.3 + (Math.random() - 0.5) * 20;
  const cp1y = fromY + (toY - fromY) * 0.1 + (Math.random() - 0.5) * 20;
  const cp2x = fromX + (toX - fromX) * 0.7 + (Math.random() - 0.5) * 20;
  const cp2y = fromY + (toY - fromY) * 0.9 + (Math.random() - 0.5) * 20;

  for (let i = 1; i <= steps; i++) {
    if (!playing) break;
    const t = i / steps;
    const mt = 1 - t;
    const x = Math.round(mt * mt * mt * fromX + 3 * mt * mt * t * cp1x + 3 * mt * t * t * cp2x + t * t * t * toX);
    const y = Math.round(mt * mt * mt * fromY + 3 * mt * mt * t * cp1y + 3 * mt * t * t * cp2y + t * t * t * toY);
    robot.moveMouse(x, y);
    await sleep(durationMs / steps);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function pickInterval(pattern, varianceFactor) {
  const base = pattern.avgInterval;
  const std = Math.max(pattern.stdDevInterval * varianceFactor, 10);
  const interval = gaussianRandom(base, std);
  return clamp(interval, pattern.minInterval * 0.8, pattern.maxInterval * 1.2);
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
    const event = { x: e.x, y: e.y, delta, elapsed, button: e.button };
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

  const events = [...recordingEvents];
  const totalDuration = events.length > 0 ? events[events.length - 1].elapsed : 0;
  const deltas = events.map(e => e.delta).filter((_, i) => i > 0);
  const avg = deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
  const variance = deltas.length > 0
    ? deltas.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / deltas.length : 0;

  return {
    events,
    totalDuration,
    clickCount: events.length,
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

  // Shuffle a copy of events for this run
  const shuffled = [...pattern.events].sort(() => Math.random() - 0.5);

  let currentX = shuffled[0].x;
  let currentY = shuffled[0].y;
  let totalCasts = 0;
  let eventIndex = 0;

  for (let rep = 0; rep < reps && playing; rep++) {
    for (let cast = 0; cast < pattern.clickCount && playing; cast++) {
      const ev = shuffled[eventIndex % shuffled.length];
      eventIndex++;

      // Re-shuffle when we've used all events
      if (eventIndex % shuffled.length === 0) {
        shuffled.sort(() => Math.random() - 0.5);
      }

      // Smooth move to next click position
      const dist = Math.hypot(ev.x - currentX, ev.y - currentY);
      const moveDuration = clamp(dist * 1.5, 20, 120);
      await moveMouse(robot, currentX, currentY, ev.x, ev.y, moveDuration);
      if (!playing) break;

      robot.mouseClick();
      currentX = ev.x;
      currentY = ev.y;
      totalCasts++;

      mainWindow?.webContents.send('playback-status', {
        playing: true, cast: totalCasts, rep: rep + 1,
      });

      // AFK pause
      if (Math.random() < afkChance) {
        const afkDuration = afkMinMs + Math.random() * (afkMaxMs - afkMinMs);
        mainWindow?.webContents.send('playback-status', {
          playing: true, cast: totalCasts, rep: rep + 1, afk: true,
        });
        await sleep(afkDuration);
        if (!playing) break;
        mainWindow?.webContents.send('playback-status', {
          playing: true, cast: totalCasts, rep: rep + 1, afk: false,
        });
      }

      if (cast < pattern.clickCount - 1 || rep < reps - 1) {
        const interval = pickInterval(pattern, varianceFactor);
        await sleep(interval);
      }
    }
  }

  playing = false;
  mainWindow?.webContents.send('playback-status', {
    playing: false, cast: totalCasts, rep: reps, done: true,
  });
});

ipcMain.handle('playback-stop', () => {
  playing = false;
});

// ── Hotkey ────────────────────────────────────────────────────────────────────

ipcMain.handle('hotkey-register', () => {
  globalShortcut.unregisterAll();
  globalShortcut.register('F6', () => {
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