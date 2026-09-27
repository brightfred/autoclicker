// ── Efficiency ────────────────────────────────────────────────────────────────
// Builds the right break policy for a sequence from its slider + profile.
// ─────────────────────────────────────────────────────────────────────────────

import { NoBreakPolicy } from './BreakPolicy.js';
import { EfficiencyBreakPolicy } from './EfficiencyBreakPolicy.js';
import { DEFAULT_EFFICIENCY, DEFAULT_PROFILE_ID } from './defaults.js';

/**
 * @param {object} sequence - uses sequence.efficiency (0.5..1) and sequence.breakProfile
 * @param {object} config   - contents of efficiency.json
 */
export function createBreakPolicy(sequence, config) {
  const efficiency = sequence.efficiency ?? DEFAULT_EFFICIENCY;
  if (efficiency >= 1) return new NoBreakPolicy();

  const profile = config.profiles[sequence.breakProfile]
    ?? config.profiles[DEFAULT_PROFILE_ID]
    ?? Object.values(config.profiles)[0];

  return new EfficiencyBreakPolicy(efficiency, profile, config.fatigue);
}
