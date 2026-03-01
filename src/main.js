// ── Main Process ──────────────────────────────────────────────────────────────
// Core orchestrator — model agnostic.
// Owns: window, recording, playback lifecycle, hotkeys.
// Does NOT own: click classification, pool building, playback loop logic.
// All model-specific logic lives in src/models/*.js
// ─────────────────────────────────────────────────────────────────────────────

import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { getModel } from './models/index.js';
import { startPath, stopPath } from './utils/mouseTracker.js';

if (started) app.quit();

let mainWindow;

// ── State ─────────────────────────────────────────────────────────────────────

let recording       = false;
let recordingEvents = [];
let recordingStart  = null;
let lastEventTime   = null;
let activeModel     = null;   // model selected at recording time
let mousePaths      = [];     // collected between clicks (dart and future models)
let currentPath     = null;   // path being recorded right now

let playing = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Remove outlier events from a pool — anything more than threshold px
// from the median position is considered a misclick/stray click.
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

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-close',    () => mainWindow?.close());

// ── Recording ─────────────────────────────────────────────────────────────────

ipcMain.handle('recording-start', async (_, { modelId }) => {
  const { uIOhook } = await import('uiohook-napi');

  activeModel     = getModel(modelId);
  recording       = true;
  recordingEvents = [];
  mousePaths      = [];
  recordingStart  = Date.now();
  lastEventTime   = recordingStart;

  if (!activeModel) {
    console.error(`[RECORDING] Unknown modelId: ${modelId}`);
    return { ok: false, error: `Unknown model: ${modelId}` };
  }

  console.log(`[RECORDING] Starting with model: ${activeModel.name}`);

  uIOhook.on('mousedown', (e) => {
    if (!recording) return;

    const now     = Date.now();
    const delta   = now - lastEventTime;
    lastEventTime = now;
    const elapsed = now - recordingStart;
    const index   = recordingEvents.length;

    // Stop the current mouse path before registering the click
    if (activeModel.recorderConfig.trackMousePath && currentPath !== null) {
      const path = stopPath(uIOhook);
      if (path.length > 0) mousePaths.push(path);
      currentPath = null;
    }

    // Classify the click using the model's own logic
    const type  = activeModel.recorderConfig.classifyClick(index);
    const event = { x: e.x, y: e.y, delta, elapsed, button: e.button, index, type };
    recordingEvents.push(event);
    mainWindow?.webContents.send('recording-event', event);

    // Start recording the next mouse path after this click
    if (activeModel.recorderConfig.trackMousePath) {
      currentPath = true; // flag that a path is in progress
      startPath(uIOhook);
    }
  });

  uIOhook.start();
  return { ok: true };
});

ipcMain.handle('recording-stop', async () => {
  const { uIOhook } = await import('uiohook-napi');

  recording = false;

  // Stop any in-progress mouse path
  if (activeModel?.recorderConfig.trackMousePath && currentPath !== null) {
    stopPath(uIOhook);
    currentPath = null;
  }

  uIOhook.removeAllListeners('mousedown');
  uIOhook.stop();

  let events = [...recordingEvents];

  // ── Outlier cleanup ───────────────────────────────────────────────────────
  // Group events by type, remove outliers per group, then recombine.
  const types    = [...new Set(events.map(e => e.type))];
  const filtered = types.flatMap(type => {
    const group = events.filter(e => e.type === type);
    return removeOutliers(group, 50);
  });
  const kept = new Set(filtered.map(e => e.index));
  events = events.filter(e => kept.has(e.index));

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalDuration = events.length > 0 ? events[events.length - 1].elapsed : 0;
  const deltas        = events.map(e => e.delta).filter((_, i) => i > 0);
  const avg           = deltas.length > 0
    ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
  const variance      = deltas.length > 0
    ? deltas.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / deltas.length : 0;

  console.log(`[RECORDING] Stopped — ${events.length} events, ${mousePaths.length} mouse paths`);

  return {
    modelId:        activeModel.id,
    itemsPerCycle:  activeModel.itemsPerCycle,
    events,
    mousePaths,
    totalDuration,
    clickCount:     events.length,
    avgInterval:    Math.round(avg),
    stdDevInterval: Math.round(Math.sqrt(variance)),
    minInterval:    deltas.length > 0 ? Math.min(...deltas) : 0,
    maxInterval:    deltas.length > 0 ? Math.max(...deltas) : 0,
  };
});

// ── Playback ──────────────────────────────────────────────────────────────────

ipcMain.handle('playback-start', async (_, { pattern, config }) => {
  if (playing) return;

  const model = getModel(pattern.modelId);
  if (!model) {
    console.error(`[PLAYBACK] Unknown modelId: ${pattern.modelId}`);
    mainWindow?.webContents.send('playback-status', { playing: false, done: true });
    return;
  }

  const robotModule = await import('@jitsi/robotjs');
  const robot = robotModule.default;

  playing = true;
  mainWindow?.webContents.send('playback-status', { playing: true, cast: 0, rep: 0 });

  console.log(`[PLAYBACK] Starting model: ${model.name}`);

  // Build pools using the model's own logic
  const pools = model.buildPools(pattern.events, pattern.mousePaths ?? []);

  // Context passed to model.play() — core utilities only
  const context = {
    sleep,
    isPlaying: () => playing,
    sendStatus: (status) => {
      mainWindow?.webContents.send('playback-status', { playing: true, ...status });
    },
  };

  // Delegate the entire playback loop to the model
  await model.play(pools, config, robot, context);

  playing = false;
  mainWindow?.webContents.send('playback-status', { playing: false, done: true });
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