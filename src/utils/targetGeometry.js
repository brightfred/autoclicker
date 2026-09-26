// ── Target Geometry ───────────────────────────────────────────────────────────
// Shared helpers for targets (used by the overlay now, and by playback later).
// A target rect is always in real screen pixels: { x, y, w, h }
// ─────────────────────────────────────────────────────────────────────────────

// The different kinds of target I can draw in the Targets tab
export const TARGET_KINDS = [
  { id: 'zone',      label: 'Zone',      icon: '▣', color: '#f5a623', hint: 'NPC, banker, bank booth, any clickable area' },
  { id: 'tile',      label: 'Tile',      icon: '◇', color: '#22c55e', hint: 'One game tile (fire spot, walk spot)' },
  { id: 'item',      label: 'Bank item', icon: '◆', color: '#38bdf8', hint: 'One item slot inside the bank' },
  { id: 'inventory', label: 'Inventory', icon: '▦', color: '#a78bfa', hint: 'Whole inventory — split into 28 slots' },
];

// OSRS inventory is 4 columns × 7 rows
export const INV_COLS = 4;
export const INV_ROWS = 7;

export function getKind(kindId) {
  return TARGET_KINDS.find(k => k.id === kindId) ?? TARGET_KINDS[0];
}

/**
 * Split an inventory rect into its 28 slot rects.
 * Slot numbers go left → right, top → bottom (same order as in game).
 * @param {{x:number,y:number,w:number,h:number}} rect
 * @returns {{slot:number,x:number,y:number,w:number,h:number}[]}
 */
export function inventorySlots(rect) {
  const slotW = rect.w / INV_COLS;
  const slotH = rect.h / INV_ROWS;
  const slots = [];

  for (let row = 0; row < INV_ROWS; row++) {
    for (let col = 0; col < INV_COLS; col++) {
      slots.push({
        slot: row * INV_COLS + col + 1,
        x: Math.round(rect.x + col * slotW),
        y: Math.round(rect.y + row * slotH),
        w: Math.round(slotW),
        h: Math.round(slotH),
      });
    }
  }
  return slots;
}

/**
 * Turn two drag corners into a clean rect (works no matter which way I dragged).
 */
export function rectFromPoints(a, b) {
  return {
    x: Math.round(Math.min(a.x, b.x)),
    y: Math.round(Math.min(a.y, b.y)),
    w: Math.round(Math.abs(a.x - b.x)),
    h: Math.round(Math.abs(a.y - b.y)),
  };
}
