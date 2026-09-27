// ── Preset: Manual firemaking ─────────────────────────────────────────────────
// open bank → (first loop: withdraw tinderbox) → withdraw logs → close bank
// → walk to the start of my line (1 or 2 tile clicks)
// → for each of the 27 logs: click log, click tinderbox, wait
// → back to the bank (clicking the counter walks there) → repeat
// ─────────────────────────────────────────────────────────────────────────────

import { click, wait, key } from './steps.js';
import { INV_COLS, INV_ROWS } from '../../utils/targetGeometry.js';

const SLOT_COUNT = INV_COLS * INV_ROWS;

export default {
  id: 'manual-firemaking',
  name: 'Manual firemaking',
  icon: '🪵',
  description: 'Bank logs, walk to your line, then light all 27 logs with a tinderbox.',
  breakProfile: 'firemaking',
  efficiency: 0.9,

  roles: [
    { id: 'bank',      label: 'Bank counter',          kinds: ['zone'],         match: /bank|counter|booth|banker/i, hint: 'Clicked to open the bank (also walks back to it)' },
    { id: 'logs',      label: 'Logs in the bank',      kinds: ['item'],         match: /log/i,                       hint: 'Withdraw-All should be set in the bank' },
    { id: 'tinderbox', label: 'Tinderbox in the bank', kinds: ['item'],         match: /tinder/i,                    strict: true, hint: 'Withdrawn on the first loop only', when: o => o.withdrawTinderbox },
    { id: 'closeX',    label: 'Bank close button',     kinds: ['zone', 'item'], match: /close|\bx\b/i,               strict: true, hint: 'The X in the bank corner', when: o => o.closeWith === 'x' },
    { id: 'walk1',     label: 'Walk tile 1',           kinds: ['tile', 'zone'], match: /walk|start|tile/i,           hint: 'First click toward the start of the line' },
    { id: 'walk2',     label: 'Walk tile 2',           kinds: ['tile', 'zone'], match: /walk|start|tile/i,           hint: 'Leave empty if one click is enough', optional: true },
    { id: 'inventory', label: 'Inventory',             kinds: ['inventory'],    match: /inv/i,                       hint: 'The 28-slot inventory box' },
  ],

  options: [
    { id: 'withdrawTinderbox', label: 'Withdraw a tinderbox on the first loop', type: 'toggle', default: false },
    { id: 'tinderboxSlot',     label: 'Tinderbox inventory slot', type: 'slot', default: 1, hint: 'Logs go in the other 27 slots' },
    {
      id: 'closeWith', label: 'Close the bank with', type: 'choice', default: 'esc',
      choices: [{ value: 'esc', label: 'Esc key' }, { value: 'x', label: 'Click the X' }],
    },
    { id: 'bankOpen', label: 'Reach + open the bank', type: 'range', unit: 'sec', default: [3, 5],     hint: 'Includes walking back from the end of the line' },
    { id: 'walk',     label: 'Walking time per click', type: 'range', unit: 'sec', default: [2.5, 4.5] },
    { id: 'light',    label: 'Wait after each log',    type: 'range', unit: 'sec', default: [1, 2] },
  ],

  build({ roles, options }) {
    const steps = [click(roles.bank), wait(...options.bankOpen)];

    if (options.withdrawTinderbox) {
      steps.push(click(roles.tinderbox, { firstLoopOnly: true }), wait(0.4, 0.8, { firstLoopOnly: true }));
    }

    steps.push(click(roles.logs), wait(0.4, 0.8));
    steps.push(...(options.closeWith === 'x'
      ? [click(roles.closeX), wait(0.3, 0.6)]
      : [key('escape'), wait(0.3, 0.6)]));

    for (const tile of [roles.walk1, roles.walk2].filter(Boolean)) {
      steps.push(click(tile), wait(...options.walk));
    }

    // Every slot except the tinderbox's, in inventory order
    const box = options.tinderboxSlot;
    for (let slot = 1; slot <= SLOT_COUNT; slot++) {
      if (slot === box) continue;
      steps.push(
        click(roles.inventory, { slot }),
        click(roles.inventory, { slot: box }),
        wait(...options.light),
      );
    }
    return steps;
  },
};
