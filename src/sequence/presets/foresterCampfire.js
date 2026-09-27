// ── Preset: Forester's campfire ──────────────────────────────────────────────
// Stand next to the bank counter with a Forester's campfire close by:
//   open bank → withdraw logs → close bank → click the campfire once
//   → wait while the whole inventory burns → (maybe a break) → repeat
// ─────────────────────────────────────────────────────────────────────────────

import { click, wait, key, breakpoint } from './steps.js';

export default {
  id: 'forester-campfire',
  name: "Forester's campfire",
  icon: '🔥',
  description: 'Bank logs next to the counter, click the campfire once, wait for the inventory to burn.',
  breakProfile: 'firemaking',
  efficiency: 0.9,

  // Targets the preset needs — the wizard lets me pick one for each
  roles: [
    { id: 'bank',     label: 'Bank counter',       kinds: ['zone'],          match: /bank|counter|booth|banker/i, hint: 'Clicked to open the bank' },
    { id: 'logs',     label: 'Logs in the bank',   kinds: ['item'],          match: /log/i,                       hint: 'Withdraw-All should be set in the bank' },
    { id: 'closeX',   label: 'Bank close button',  kinds: ['zone', 'item'],  match: /close|\bx\b/i,               strict: true, hint: 'The X in the bank corner', when: o => o.closeWith === 'x' },
    { id: 'campfire', label: 'Campfire tile',      kinds: ['tile', 'zone'],  match: /fire|camp/i,                 hint: 'Any tile of the campfire' },
  ],

  options: [
    {
      id: 'closeWith', label: 'Close the bank with', type: 'choice', default: 'esc',
      choices: [{ value: 'esc', label: 'Esc key' }, { value: 'x', label: 'Click the X' }],
    },
    { id: 'burn',     label: 'Burn time per inventory', type: 'range', unit: 'sec', default: [95, 125], hint: 'How long one full inventory takes to burn' },
    { id: 'bankOpen', label: 'Bank opening time',       type: 'range', unit: 'sec', default: [0.8, 1.4] },
  ],

  build({ roles, options }) {
    const closeBank = options.closeWith === 'x'
      ? [click(roles.closeX), wait(0.3, 0.6)]
      : [key('escape'), wait(0.3, 0.6)];

    return [
      click(roles.bank),
      wait(...options.bankOpen),
      click(roles.logs),
      wait(0.4, 0.8),
      ...closeBank,
      click(roles.campfire),
      wait(...options.burn),
      breakpoint(),
    ];
  },
};
