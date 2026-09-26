// ── ActionRegistry ────────────────────────────────────────────────────────────
// Maps a saved step's `type` to the class that runs it.
// To add a new action type: write the class, then register it in
// createDefaultRegistry() — the runner and everything else stay untouched.
// ─────────────────────────────────────────────────────────────────────────────

import { ClickAction } from './actions/ClickAction.js';
import { WaitAction } from './actions/WaitAction.js';
import { KeyAction } from './actions/KeyAction.js';

export class ActionRegistry {
  #types = new Map();

  register(type, ActionClass) {
    this.#types.set(type, ActionClass);
    return this;
  }

  create(def) {
    const ActionClass = this.#types.get(def.type);
    if (!ActionClass) throw new Error(`Unknown action type: "${def.type}"`);
    return new ActionClass(def);
  }
}

export function createDefaultRegistry() {
  return new ActionRegistry()
    .register('click', ClickAction)
    .register('wait',  WaitAction)
    .register('key',   KeyAction);
}
