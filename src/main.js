// ── Main Process ──────────────────────────────────────────────────────────────
// Core orchestrator. Owns: the app window, IPC, the F6 hotkey, and wiring the
// engine + sequence runner to the UI.
// Does NOT own: how the mouse moves, how actions work, or how files are saved —
// those live in src/engine/* and src/utils/*.
// ─────────────────────────────────────────────────────────────────────────────

import { app, BrowserWindow, ipcMain, globalShortcut, shell } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { targetsFile } from './utils/targetsFile.js';
import { sequencesFile } from './utils/sequencesFile.js';
import { efficiencyFile } from './utils/efficiencyFile.js';
import { openOverlay } from './utils/overlay.js';
import { createEngine } from './engine/index.js';
import { SequenceRunner } from './engine/sequence/SequenceRunner.js';
import { createDefaultRegistry } from './engine/sequence/ActionRegistry.js';
import { createBreakPolicy } from './engine/efficiency/index.js';

if (started) app.quit();

let mainWindow;
let engine = null;   // natural mouse/keyboard engine, created on first use
let runner = null;   // runs sequences with that engine

// ── Engine ────────────────────────────────────────────────────────────────────

function sendToUi(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

async function getEngine() {
  if (!engine) engine = await createEngine();
  return engine;
}

async function getRunner() {
  if (!runner) {
    runner = new SequenceRunner({
      engine:   await getEngine(),
      registry: createDefaultRegistry(),
      onStatus: (status) => sendToUi('sequence-status', status),
    });
  }
  return runner;
}

// ── Window ────────────────────────────────────────────────────────────────────

// Load my Vue app on a given hash route (e.g. '/overlay').
// Works both in dev (Vite server) and in the packaged app.
function loadRoute(win, route = '/') {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#${route}`);
  } else {
    win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`), { hash: route });
  }
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 800,
    minWidth: 860,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0a0c0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  loadRoute(mainWindow, '/');

  // DevTools only while developing (npm start), never in the installed app
  if (!app.isPackaged) mainWindow.webContents.openDevTools();
};

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-close',    () => mainWindow?.close());

// ── Targets ───────────────────────────────────────────────────────────────────
// Named screen areas (banker, tile, bank item, inventory...) grouped in setups.

ipcMain.handle('targets-load',   ()        => targetsFile.load());
ipcMain.handle('targets-save',   (_, data) => targetsFile.save(data));
ipcMain.handle('targets-export', (_, data) => targetsFile.exportTo(mainWindow, data));
ipcMain.handle('targets-import', ()        => targetsFile.importFrom(mainWindow));

// Hide my window and let me drag a box on screen. Returns the rect or null.
ipcMain.handle('overlay-select', (_, { kind, label, targets }) => {
  return openOverlay({
    mode: 'select', kind, label, targets,
    mainWindow,
    preload: path.join(__dirname, 'preload.js'),
    loadRoute,
  });
});

// Draw targets on top of the game so I can check they're in the right place
ipcMain.handle('overlay-show', (_, { targets, highlightId }) => {
  return openOverlay({
    mode: 'show', targets, highlightId,
    mainWindow,
    preload: path.join(__dirname, 'preload.js'),
    loadRoute,
  });
});

// Move the mouse naturally onto a target (no click) so I can check how it feels.
// For an inventory it goes to a random slot.
ipcMain.handle('target-test-move', async (_, { target }) => {
  const eng = await getEngine();
  return eng.moveToTarget(target);
});

// ── Sequences ─────────────────────────────────────────────────────────────────

ipcMain.handle('sequences-load',   ()        => sequencesFile.load());
ipcMain.handle('sequences-save',   (_, data) => sequencesFile.save(data));
ipcMain.handle('sequences-export', (_, data) => sequencesFile.exportTo(mainWindow, data));
ipcMain.handle('sequences-import', ()        => sequencesFile.importFrom(mainWindow));

// Check a sequence without running it — returns a list of problems
ipcMain.handle('sequence-validate', async (_, { sequence, targets }) => {
  return (await getRunner()).validate(sequence, targets);
});

// Start running — resolves right away, progress comes through 'sequence-status'.
// efficiency.json is re-read on every start, so my edits apply without a restart.
ipcMain.handle('sequence-start', async (_, { sequence, targets }) => {
  const r = await getRunner();
  if (r.running) return false;
  const breakPolicy = createBreakPolicy(sequence, await efficiencyFile.loadOrCreate());
  r.run(sequence, targets, { breakPolicy }); // not awaited on purpose
  return true;
});

ipcMain.handle('sequence-stop', () => {
  runner?.stop();
});

// ── Efficiency ────────────────────────────────────────────────────────────────
// Break profiles (High alch, Firemaking...) live in efficiency.json

ipcMain.handle('efficiency-load', () => efficiencyFile.loadOrCreate());

// Open efficiency.json in my default editor so I can tune the breaks
ipcMain.handle('efficiency-open', async () => {
  await efficiencyFile.loadOrCreate();
  return shell.openPath(efficiencyFile.filePath);
});

// ── Hotkey ────────────────────────────────────────────────────────────────────
// F6: stops a running sequence right here in main (fastest), otherwise tells
// the UI, which starts (or cancels) its countdown.

ipcMain.handle('hotkey-register', (_, key = 'F6') => {
  globalShortcut.unregister(key);
  globalShortcut.register(key, () => {
    if (runner?.running) runner.stop();
    else sendToUi('hotkey-play');
  });
});

ipcMain.handle('hotkey-unregister', (_, key = 'F6') => {
  globalShortcut.unregister(key);
});

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  runner?.stop();
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') app.quit();
});
