// ── Preset: Manual firemaking ─────────────────────────────────────────────────
// open bank → (first loop: withdraw tinderbox) → withdraw logs → close bank
// → walk to the start of my line (1 or 2 walk steps)
// → for each of the 27 logs: click log, click tinderbox, wait
// → walk back to the bank with the minimap (1 or 2 minimap spots) → repeat
//
// Why the minimap for walking back: the bank counter target only lines up from
// the bank tile. My line always ends on the same tile, so the same minimap
// spot always walks me back to the same tile next to the bank.
// ─────────────────────────────────────────────────────────────────────────────

import { click, wait, key, walk } from './steps.js';
import { INV_COLS, INV_ROWS } from '../../utils/targetGeometry.js';

const SLOT_COUNT = INV_COLS * INV_ROWS;

export default {
  id: 'manual-firemaking',
  name: 'Manual firemaking',
  icon: '🪵',
  description: 'Bank logs, walk to your line, light all 27 logs, walk back with the minimap.',
  breakProfile: 'firemaking',
  efficiency: 0.9,

  roles: [
    { id: 'bank',      label: 'Bank counter',          kinds: ['zone'],                    match: /bank|counter|booth|banker/i, hint: 'Drawn while standing on the bank tile' },
    { id: 'logs',      label: 'Logs in the bank',      kinds: ['item'],                    match: /log/i,                       hint: 'Withdraw-All should be set in the bank' },
    { id: 'tinderbox', label: 'Tinderbox in the bank', kinds: ['item'],                    match: /tinder/i,  strict: true,     hint: 'Withdrawn on the first loop only', when: o => o.withdrawTinderbox },
    { id: 'closeX',    label: 'Bank close button',     kinds: ['zone', 'item'],            match: /close|\bx\b/i, strict: true, hint: 'The X in the bank corner', when: o => o.closeWith === 'x' },
    { id: 'walk1',     label: 'Walk to line (1)',      kinds: ['minimap', 'tile', 'zone'], match: /start|line/i,                hint: 'From the bank tile toward the start of the line' },
    { id: 'walk2',     label: 'Walk to line (2)',      kinds: ['minimap', 'tile', 'zone'], match: /start 2|line 2/i, strict: true, optional: true, hint: 'Leave empty if one walk is enough' },
    { id: 'back1',     label: 'Walk back (1)',         kinds: ['minimap', 'tile', 'zone'], match: /back|return/i, strict: true, optional: true, hint: 'Minimap spot toward the bank, drawn at the END of the line' },
    { id: 'back2',     label: 'Walk back (2)',         kinds: ['minimap', 'tile', 'zone'], match: /back 2|return 2/i, strict: true, optional: true, hint: 'Second minimap spot if the bank is out of minimap range' },
    { id: 'inventory', label: 'Inventory',             kinds: ['inventory'],               match: /inv/i,                       hint: 'The 28-slot inventory box' },
  ],

  options: [
    { id: 'withdrawTinderbox', label: 'Withdraw a tinderbox on the first loop', type: 'toggle', default: false },
    { id: 'tinderboxSlot',     label: 'Tinderbox inventory slot', type: 'slot', default: 1, hint: 'Logs go in the other 27 slots' },
    {
      id: 'closeWith', label: 'Close the bank with', type: 'choice', default: 'esc',
      choices: [{ value: 'esc', label: 'Esc key' }, { value: 'x', label: 'Click the X' }],
    },
    { id: 'bankOpen', label: 'Bank opening time',       type: 'range', unit: 'sec', default: [1.2, 2.2], hint: 'Raise it if you don\'t use "Walk back" (the bank click walks you there)' },
    { id: 'walk',     label: 'Walking time to the line', type: 'range', unit: 'sec', default: [2.5, 4.5], hint: 'Per walk step' },
    { id: 'walkBack', label: 'Walking time back',        type: 'range', unit: 'sec', default: [8, 12],    hint: 'Per walk-back step (27 tiles is ~8s running)' },
    { id: 'light',    label: 'Wait after each log',      type: 'range', unit: 'sec', default: [1, 2] },
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

    for (const spot of [roles.walk1, roles.walk2].filter(Boolean)) {
      steps.push(walk(spot, ...options.walk));
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

    // Back to the bank tile so the bank counter lines up again next loop
    for (const spot of [roles.back1, roles.back2].filter(Boolean)) {
      steps.push(walk(spot, ...options.walkBack));
    }
    return steps;
  },
};
