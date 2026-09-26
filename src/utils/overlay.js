// ── Overlay Manager (main process only) ──────────────────────────────────────
// Opens one see-through, always-on-top window per monitor so I can:
//   - 'select' : drag a box over something in the game → returns its rect
//   - 'show'   : draw my saved targets on top of the game to check them
//
// I use one window per monitor (instead of one giant window) because Windows
// handles each monitor's size/scaling separately and it's much more reliable.
//
// Coordinates:
//   Targets are saved in REAL screen pixels (same as uiohook / robotjs use).
//   The overlay page works in Electron's DIP pixels. On Windows I convert
//   between the two with screen.screenToDipPoint / dipToScreenPoint, so it
//   still lines up if a monitor is scaled (125%, 150%...).
// ─────────────────────────────────────────────────────────────────────────────

import { BrowserWindow, screen, ipcMain, globalShortcut } from 'electron';

let overlayWindows = [];   // all overlay windows currently open
let sessions       = new Map(); // webContents.id → data that overlay page asks for
let resolveResult  = null; // resolves the promise returned by openOverlay()
let hiddenWindow   = null; // my main window, hidden while the overlay is up

const isWindows = process.platform === 'win32';

// Real screen pixels → DIP (what the overlay page draws with)
function toDip(pt) {
  return isWindows ? screen.screenToDipPoint(pt) : pt;
}

// DIP → real screen pixels (what I save and what robotjs clicks)
function toScreen(pt) {
  return isWindows ? screen.dipToScreenPoint(pt) : pt;
}

function rectToDip(r) {
  const a = toDip({ x: r.x, y: r.y });
  const b = toDip({ x: r.x + r.w, y: r.y + r.h });
  return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
}

function rectToScreen(r) {
  const a = toScreen({ x: r.x, y: r.y });
  const b = toScreen({ x: r.x + r.w, y: r.y + r.h });
  return {
    x: Math.round(a.x),
    y: Math.round(a.y),
    w: Math.round(b.x - a.x),
    h: Math.round(b.y - a.y),
  };
}

// Close every overlay, give my main window back, and hand the result to the caller
function finish(result) {
  globalShortcut.unregister('Escape');

  for (const win of overlayWindows) {
    if (!win.isDestroyed()) win.destroy();
  }
  overlayWindows = [];
  sessions.clear();

  if (hiddenWindow && !hiddenWindow.isDestroyed()) {
    hiddenWindow.show();
    hiddenWindow.focus();
  }
  hiddenWindow = null;

  const resolve = resolveResult;
  resolveResult = null;
  resolve?.(result);
}

/**
 * Open the overlay on every monitor.
 *
 * @param {object}   opts
 * @param {'select'|'show'} opts.mode
 * @param {string}   [opts.kind]        - target kind being drawn (select mode)
 * @param {string}   [opts.label]       - name shown while drawing (select mode)
 * @param {object[]} [opts.targets]     - targets to draw (rects in screen px)
 * @param {string}   [opts.highlightId] - only highlight this one target
 * @param {BrowserWindow} opts.mainWindow
 * @param {string}   opts.preload       - path to preload.js
 * @param {Function} opts.loadRoute     - (win, route) => loads the renderer on a hash route
 * @returns {Promise<{x,y,w,h}|null>} the drawn rect (select) or null
 */
export function openOverlay(opts) {
  // Only one overlay at a time — if one is open, I just ignore the new request
  if (resolveResult) return Promise.resolve(null);

  return new Promise((resolve) => {
    resolveResult = resolve;

    hiddenWindow = opts.mainWindow;
    hiddenWindow?.hide();

    // Targets converted once to DIP so every overlay window can draw them
    const dipTargets = (opts.targets ?? []).map(t => ({ ...t, rect: rectToDip(t.rect) }));

    for (const display of screen.getAllDisplays()) {
      const { x, y, width, height } = display.bounds;

      const win = new BrowserWindow({
        x, y, width, height,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        hasShadow: false,
        alwaysOnTop: true,
        enableLargerThanScreen: true,
        show: false,
        webPreferences: { preload: opts.preload },
      });

      // 'screen-saver' level keeps it above the game client too
      win.setAlwaysOnTop(true, 'screen-saver');
      win.setBounds(display.bounds);

      sessions.set(win.webContents.id, {
        mode:        opts.mode,
        kind:        opts.kind ?? 'zone',
        label:       opts.label ?? '',
        highlightId: opts.highlightId ?? null,
        display:     { x, y, width, height },
        targets:     dipTargets,
      });

      win.once('ready-to-show', () => win.showInactive());
      opts.loadRoute(win, '/overlay');
      overlayWindows.push(win);
    }

    // Give keyboard focus to the overlay on the monitor my mouse is on,
    // so Esc works right away
    const cursorDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const focusWin = overlayWindows.find(w => {
      const b = w.getBounds();
      return b.x === cursorDisplay.bounds.x && b.y === cursorDisplay.bounds.y;
    });
    focusWin?.once('ready-to-show', () => focusWin.focus());

    // Safety net: Esc always cancels, even if the overlay page failed to load
    globalShortcut.register('Escape', () => finish(null));
  });
}

// ── IPC used by the overlay page ─────────────────────────────────────────────

ipcMain.handle('overlay-get-data', (event) => {
  return sessions.get(event.sender.id) ?? null;
});

// The overlay page sends a rect in DIP (absolute desktop coords), or null to cancel
ipcMain.on('overlay-result', (_, dipRect) => {
  if (!resolveResult) return;
  finish(dipRect ? rectToScreen(dipRect) : null);
});
