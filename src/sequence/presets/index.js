// ── Presets ───────────────────────────────────────────────────────────────────
// Ready-made routines that build a sequence from my own targets.
// To add one (high alch, darts...): create a file like foresterCampfire.js
// and add it to this list — the wizard picks it up automatically.
//
// A preset has:
//   roles   - targets it needs ({ id, label, kinds, match, hint, optional?, strict?, when? })
//             strict: only auto-guess when the target's NAME matches (never "any item")
//   options - settings ({ id, label, type: 'choice'|'range'|'toggle'|'slot', default })
//   build({ roles, options }) → steps
// ─────────────────────────────────────────────────────────────────────────────

import foresterCampfire from './foresterCampfire.js';
import manualFiremaking from './manualFiremaking.js';

export const PRESETS = [foresterCampfire, manualFiremaking];

export function defaultOptions(preset) {
  return Object.fromEntries(preset.options.map(o => [o.id, structuredClone(o.default)]));
}

/** Roles that apply with the current options (e.g. "Bank close button" only when closing with X) */
export function activeRoles(preset, options) {
  return preset.roles.filter(r => !r.when || r.when(options));
}

/**
 * Best guess of a target for each role: right kind, name matches, not used twice.
 * If no name matches, a required non-strict role falls back to any target of the right kind.
 */
export function guessRoles(preset, targets) {
  const used = new Set();
  const picks = {};
  for (const role of preset.roles) {
    const fits  = targets.filter(t => role.kinds.includes(t.kind) && !used.has(t.id));
    const named = fits.find(t => role.match?.test(t.name));
    const pick  = named ?? (role.optional || role.strict ? null : fits[0]) ?? null;
    if (pick) used.add(pick.id);
    picks[role.id] = pick?.id ?? null;
  }
  return picks;
}
