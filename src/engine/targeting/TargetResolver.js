// ── TargetResolver ────────────────────────────────────────────────────────────
// Turns a saved target (+ optional inventory slot) into the exact box to click.
// Keeps the "what is a target" knowledge out of the movement code.
// ─────────────────────────────────────────────────────────────────────────────

import { inventorySlots } from '../../utils/targetGeometry.js';

export class TargetResolver {
  /**
   * @param {object} target        - saved target { kind, rect, ... }
   * @param {number} [slot]        - inventory slot 1..28 (inventory targets only)
   * @returns {{x:number,y:number,w:number,h:number}}
   */
  resolve(target, slot) {
    if (target.kind === 'inventory') {
      const slots = inventorySlots(target.rect);
      const index = slot ? slot - 1 : Math.floor(Math.random() * slots.length);
      const found = slots[index];
      if (!found) throw new Error(`Inventory slot ${slot} does not exist (1-28)`);
      return found;
    }
    return target.rect;
  }
}
