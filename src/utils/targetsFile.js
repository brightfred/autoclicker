// ── Targets File (main process only) ─────────────────────────────────────────
// Reads/writes my targets + setups to a JSON file in the app's data folder:
//   Windows: %APPDATA%/AlchClicker/targets.json
// Also handles export/import through the native save/open dialogs.
// ─────────────────────────────────────────────────────────────────────────────

import { app, dialog } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

const FILE_VERSION = 1;

function filePath() {
  return path.join(app.getPath('userData'), 'targets.json');
}

// What a brand new file looks like — one empty setup so the UI is never blank
function emptyData() {
  const id = Date.now().toString();
  return {
    version: FILE_VERSION,
    activeSetupId: id,
    setups: [{ id, name: 'Default setup', targets: [] }],
  };
}

// Make sure whatever I read (from disk or an import) has the right shape
function isValid(data) {
  return data
    && Array.isArray(data.setups)
    && data.setups.every(s => s.id && typeof s.name === 'string' && Array.isArray(s.targets));
}

export async function loadTargets() {
  try {
    const raw  = await fs.readFile(filePath(), 'utf8');
    const data = JSON.parse(raw);
    if (isValid(data)) return data;
    console.warn('[TARGETS] File has an unexpected shape, starting fresh');
  } catch (err) {
    // ENOENT just means first launch — anything else is worth logging
    if (err.code !== 'ENOENT') console.error('[TARGETS] Could not read file:', err);
  }
  return emptyData();
}

export async function saveTargets(data) {
  if (!isValid(data)) throw new Error('Refusing to save invalid targets data');
  const file = filePath();
  await fs.mkdir(path.dirname(file), { recursive: true });

  // I write to a temp file first then rename, so a crash mid-write
  // can never leave me with a half-written (corrupted) targets.json
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ ...data, version: FILE_VERSION }, null, 2), 'utf8');
  await fs.rename(tmp, file);
  return true;
}

export async function exportTargets(win, data) {
  const { canceled, filePath: dest } = await dialog.showSaveDialog(win, {
    title: 'Export targets',
    defaultPath: 'alchclicker-targets.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !dest) return { ok: false };
  await fs.writeFile(dest, JSON.stringify({ ...data, version: FILE_VERSION }, null, 2), 'utf8');
  return { ok: true, path: dest };
}

export async function importTargets(win) {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Import targets',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || filePaths.length === 0) return { ok: false };

  try {
    const data = JSON.parse(await fs.readFile(filePaths[0], 'utf8'));
    if (!isValid(data)) return { ok: false, error: 'This file is not a valid targets file.' };
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Could not read this file (is it valid JSON?).' };
  }
}
