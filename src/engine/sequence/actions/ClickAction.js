// ── ClickAction ───────────────────────────────────────────────────────────────
// Glide to a target (or one inventory slot) and click it.
// def: { type: 'click', targetId, slot?, button: 'left'|'right' }
// ─────────────────────────────────────────────────────────────────────────────

import { Action } from './Action.js';
import { INV_COLS, INV_ROWS } from '../../../utils/targetGeometry.js';

const SLOT_COUNT = INV_COLS * INV_ROWS;

export class ClickAction extends Action {
  validate({ targets }) {
    if (!this.def.targetId) return ['Click: choose a target'];
    const target = targets.get(this.def.targetId);
    if (!target) return ['Click: the target was deleted or is in another setup'];

    if (target.kind === 'inventory') {
      const slot = Number(this.def.slot);
      if (!Number.isInteger(slot) || slot < 1 || slot > SLOT_COUNT) {
        return [`Click "${target.name}": pick an inventory slot (1-${SLOT_COUNT})`];
      }
    }
    return [];
  }

  async execute({ engine, targets, shouldStop }) {
    const target = targets.get(this.def.targetId);
    await engine.clickTarget(target, {
      slot:   target.kind === 'inventory' ? Number(this.def.slot) : undefined,
      button: this.def.button ?? 'left',
      shouldStop,
    });
  }
}
