// ── KeyAction ─────────────────────────────────────────────────────────────────
// Tap one keyboard key (Esc to close the bank, Space to confirm "burn all"...).
// def: { type: 'key', key: 'escape' }   key names are robotjs names
// ─────────────────────────────────────────────────────────────────────────────

import { Action } from './Action.js';

export class KeyAction extends Action {
  validate() {
    return this.def.key ? [] : ['Press key: pick a key'];
  }

  async execute({ engine, shouldStop }) {
    if (shouldStop()) return;
    await engine.pressKey(this.def.key);
  }
}
