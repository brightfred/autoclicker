// ── Preset: High alchemy ─────────────────────────────────────────────────────
// Stand anywhere with the spellbook open:
//   click High Level Alchemy → (inventory opens) → click the item
//   → wait for the cast animation (~3s, spellbook comes back) → repeat
// One loop = one cast, so "items to alch" is simply the loop count.
// A break point after each cast lets the efficiency slider slip in pauses.
// ─────────────────────────────────────────────────────────────────────────────

import { click, wait, breakpoint } from './steps.js';

export default {
  id: 'high-alch',
  name: 'High alchemy',
  icon: '✨',
  description: 'Click the High Alch spell, then the item, wait for the cast — one loop per item.',
  breakProfile: 'high-alch',
  efficiency: 0.9,

  roles: [
    { id: 'spell', label: 'High Alch spell', kinds: ['zone'],                      match: /alch|spell/i, hint: 'The spell icon in the spellbook' },
    { id: 'item',  label: 'Item to alch',    kinds: ['inventory', 'item', 'zone'], match: /inv|note|item|alch/i, strict: true, hint: 'Your Inventory target (then pick the slot), or a box around the item' },
  ],

  options: [
    {
      id: 'itemSlot', label: 'Item inventory slot', type: 'slot', default: 16,
      hint: 'Where the noted items sit (slot 16 is right under the spell in the default layout)',
      when: (o, roles) => roles.item?.kind === 'inventory',
    },
    { id: 'count',       label: 'Items to alch',              type: 'number', default: 0, min: 0, hint: '0 = keep going until I stop it' },
    { id: 'spellToItem', label: 'Spell → item delay',         type: 'range', unit: 'sec', default: [0.25, 0.55], hint: 'Inventory tab opening after clicking the spell' },
    { id: 'cast',        label: 'Cast time before next spell', type: 'range', unit: 'sec', default: [2.5, 3.1],  hint: 'The alch takes 3s (5 ticks) — too short and the next click misses' },
  ],

  // One loop per cast
  loops: (options) => Math.max(0, Math.round(options.count || 0)),

  build({ roles, options }) {
    const onItem = roles.item.kind === 'inventory' ? { slot: options.itemSlot } : {};
    return [
      click(roles.spell),
      wait(...options.spellToItem),
      click(roles.item, onItem),
      wait(...options.cast),
      breakpoint(),
    ];
  },
};
