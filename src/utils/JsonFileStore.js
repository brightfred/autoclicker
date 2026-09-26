// ── JsonFileStore (main process only) ────────────────────────────────────────
// One JSON file in the app's data folder (%APPDATA%/AlchClicker on Windows),
// with safe saving and export/import through the native file dialogs.
// Targets and sequences each get their own instance — same code, different file.
// ─────────────────────────────────────────────────────────────────────────────

import { app, dialog } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

export class JsonFileStore {
  /**
   * @param {object}   opts
   * @param {string}   opts.fileName     - e.g. 'targets.json'
   * @param {Function} opts.createEmpty  - returns the data for a brand new file
   * @param {Function} opts.validate     - (data) => true if the shape is right
   * @param {string}   opts.label        - used in dialogs/logs, e.g. 'targets'
   * @param {number}   [opts.version=1]  - file format version, saved in the file
   */
  constructor({ fileName, createEmpty, validate, label, version = 1 }) {
    this.fileName    = fileName;
    this.createEmpty = createEmpty;
    this.validate    = validate;
    this.label       = label;
    this.version     = version;
  }

  get filePath() {
    return path.join(app.getPath('userData'), this.fileName);
  }

  async load() {
    try {
      const data = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      if (this.validate(data)) return data;
      console.warn(`[${this.label}] File has an unexpected shape, starting fresh`);
    } catch (err) {
      // ENOENT just means first launch — anything else is worth logging
      if (err.code !== 'ENOENT') console.error(`[${this.label}] Could not read file:`, err);
    }
    return this.createEmpty();
  }

  async save(data) {
    if (!this.validate(data)) throw new Error(`Refusing to save invalid ${this.label} data`);
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    // I write to a temp file first then rename, so a crash mid-write
    // can never leave me with a half-written (corrupted) file
    const tmp = `${this.filePath}.tmp`;
    await fs.writeFile(tmp, this.#serialize(data), 'utf8');
    await fs.rename(tmp, this.filePath);
    return true;
  }

  async exportTo(win, data) {
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: `Export ${this.label}`,
      defaultPath: `alchclicker-${this.fileName}`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { ok: false };
    await fs.writeFile(filePath, this.#serialize(data), 'utf8');
    return { ok: true, path: filePath };
  }

  async importFrom(win) {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: `Import ${this.label}`,
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || filePaths.length === 0) return { ok: false };

    try {
      const data = JSON.parse(await fs.readFile(filePaths[0], 'utf8'));
      if (!this.validate(data)) return { ok: false, error: `This file is not a valid ${this.label} file.` };
      return { ok: true, data };
    } catch {
      return { ok: false, error: 'Could not read this file (is it valid JSON?).' };
    }
  }

  #serialize(data) {
    return JSON.stringify({ ...data, version: this.version }, null, 2);
  }
}
