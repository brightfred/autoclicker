// ── Preset: Jugs of wine (Cooking) ───────────────────────────────────────────
// Inventory layout stays the same every loop:
//   slots 1–14  = jugs of water (→ wine)      slots 15–28 = grapes
//
// Loop 1 (empty inventory): open bank → withdraw water → withdraw grapes → close
// Loop 2+:  open bank → withdraw grapes (fills 15–28, the only free slots)
//           → click the wine in slot 1 (deposits all of it)
//           → withdraw water (fills 1–14) → close
// Then 14 times: click a grape → click a jug.
//
// Bank withdraw quantity must be set to 14 (Withdraw-X).
// ─────────────────────────────────────────────────────────────────────────────

import { click, wait, key, onLoops } from './steps.js';

const PER_INVENTORY = 14;

export default {
  id: 'jug-of-wine',
  name: 'Jugs of wine',
  icon: '🍷',
  description: 'Withdraw 14 water + 14 grapes, combine them, deposit the wine, repeat.',
  breakProfile: 'general',
  efficiency: 0.9,

  roles: [
    { id: 'bank',      label: 'Bank counter',           kinds: ['zone'],         match: /bank|counter|booth|banker/i, hint: 'Clicked to open the bank' },
    { id: 'water',     label: 'Jugs of water in bank',  kinds: ['item'],         match: /water/i, strict: true,      hint: 'Withdraw-X should be set to 14' },
    { id: 'grapes',    label: 'Grapes in bank',         kinds: ['item'],         match: /grape/i, strict: true,      hint: 'Withdraw-X should be set to 14' },
    { id: 'closeX',    label: 'Bank close button',      kinds: ['zone', 'item'], match: /close|\bx\b/i, strict: true, hint: 'The X in the bank corner', when: o => o.closeWith === 'x' },
    { id: 'inventory', label: 'Inventory',              kinds: ['inventory'],    match: /inv/i,                       hint: 'Also used to deposit the wine while the bank is open' },
  ],

  options: [
    { id: 'count', label: 'Inventories to make', type: 'number', default: 0, min: 0, hint: `${PER_INVENTORY} wines each — 0 = keep going until I stop it` },
    {
      id: 'closeWith', label: 'Close the bank with', type: 'choice', default: 'esc',
      choices: [{ value: 'esc', label: 'Esc key' }, { value: 'x', label: 'Click the X' }],
    },
    { id: 'bankOpen', label: 'Bank opening time',    type: 'range', unit: 'sec', default: [0.8, 1.4] },
    { id: 'bankStep', label: 'Wait after each bank click', type: 'range', unit: 'sec', default: [0.4, 0.8] },
    { id: 'combine',  label: 'Wait after each wine', type: 'range', unit: 'sec', default: [0.6, 1.1], hint: 'After clicking grape → jug' },
  ],

  loops: (options) => Math.max(0, Math.round(options.count || 0)),

  build({ roles, options }) {
    const inv = roles.inventory;
    const pause = () => wait(...options.bankStep);

    const steps = [
      click(roles.bank),
      wait(...options.bankOpen),

      // Loop 1 only: empty inventory → water first so it lands in slots 1–14
      ...onLoops({ firstLoopOnly: true }, [click(roles.water), pause()]),

      // Every loop: grapes fill slots 15–28
      click(roles.grapes),
      pause(),

      // From loop 2: deposit last loop's wine (slot 1), then refill water in 1–14
      ...onLoops({ skipFirstLoop: true }, [
        click(inv, { slot: 1 }), pause(),
        click(roles.water), pause(),
      ]),

      ...(options.closeWith === 'x' ? [click(roles.closeX)] : [key('escape')]),
      wait(0.3, 0.6),
    ];

    // Grape in slot 15 → jug in slot 1, grape 16 → jug 2, ... grape 28 → jug 14
    for (let i = 1; i <= PER_INVENTORY; i++) {
      steps.push(
        click(inv, { slot: PER_INVENTORY + i }),
        click(inv, { slot: i }),
        wait(...options.combine),
      );
    }
    return steps;
  },
};
