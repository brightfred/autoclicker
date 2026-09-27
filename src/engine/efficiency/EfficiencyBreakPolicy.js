// ── EfficiencyBreakPolicy ─────────────────────────────────────────────────────
// Breaks that add up to a target efficiency, like a real person.
//
// Efficiency = working time / total time. At 85%, 15% of the session is breaks.
// While I work I "earn" break time: owed = active × (1 − e) / e − already taken.
// At each break point, the more I'm owed, the more likely I take a break
// (1 − e^(−owed / patience)). So breaks come at random moments, but over a
// session the total always drifts back to the target.
//
// Which kind (hesitate / short / long) is picked by the profile's weights,
// among kinds I've earned enough for.
//
// "Due" breaks: a kind can have dueAfterMin (e.g. an AFK every ~35 min at 90%).
// Once it's due, I take it at the next break points even if I haven't earned it —
// then I'm "in debt" and small breaks stop for a while, which evens it out.
// The due time shrinks at lower efficiency (more, longer AFKs) and grows at
// higher efficiency, and is randomized every time so it never looks scheduled.
//
// Fatigue: my reaction pace slowly drags the longer I go without the
// fatigue.resetKind break (a long AFK), more so at low efficiency.
// ─────────────────────────────────────────────────────────────────────────────

import { BreakPolicy } from './BreakPolicy.js';

const REFERENCE_EFFICIENCY = 0.9; // dueAfterMin in the config is meant for 90%
const DUE_TAKE_CHANCE      = 0.4; // chance per break point once a break is due
const DUE_JITTER           = [0.7, 1.3];

export class EfficiencyBreakPolicy extends BreakPolicy {
  #dueAtMs = new Map(); // kind → how long after the last one it becomes due

  /**
   * @param {number} efficiency - 0.3 .. 1 (1 = no breaks)
   * @param {object} profile    - from efficiency.json, see DEFAULT_EFFICIENCY_CONFIG
   * @param {object} fatigue    - { maxSlowdown, rampMinutes, resetKind }
   * @param {() => number} [random] - injectable for tests
   */
  constructor(efficiency, profile, fatigue, random = Math.random) {
    super();
    this.efficiency = Math.min(1, Math.max(0.3, efficiency));
    this.profile    = profile;
    this.fatigue    = fatigue;
    this.random     = random;
    for (const kind of this.kinds) this.#rollDue(kind);
  }

  get kinds() {
    return Object.keys(this.profile.breaks);
  }

  decide(clock) {
    const e = this.efficiency;
    if (e >= 1) return null;

    // Never chain breaks back to back
    if (clock.sinceBreakMs < this.profile.minGapSec * 1000) return null;

    // 1. A break that's due (e.g. the AFK I haven't taken in a long time)
    const due = this.#overdueKind(clock);
    if (due && this.random() < DUE_TAKE_CHANCE) return this.#make(due);

    // 2. Otherwise, a break I've earned
    const owedSec  = (clock.activeMs * (1 - e) / e - clock.breakMs) / 1000;
    const kinds    = Object.entries(this.profile.breaks).filter(([, k]) => k.weight > 0);
    const smallest = Math.min(...kinds.map(([, k]) => k.minSec));
    if (owedSec < smallest) return null;

    const chance = 1 - Math.exp(-owedSec / this.profile.patienceSec);
    if (this.random() > chance) return null;

    const eligible = kinds.filter(([, k]) => owedSec >= k.minSec * 0.5);
    if (eligible.length === 0) return null;
    return this.#make(this.#weightedPick(eligible)[0]);
  }

  onBreakTaken(decision) {
    this.#rollDue(decision.kind);
  }

  paceMultiplier(clock) {
    if (this.efficiency >= 1) return 1;
    const { maxSlowdown, rampMinutes, resetKind } = this.fatigue;
    const since = clock.sinceKindMs[resetKind] ?? clock.sinceBreakMs;
    const ramp  = Math.min(1, since / (rampMinutes * 60000));
    const scale = Math.min(1, (1 - this.efficiency) / 0.5); // 50% efficiency → full slowdown
    return 1 + maxSlowdown * ramp * scale;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  #make(kind) {
    const spec = this.profile.breaks[kind];
    // Skewed toward the short end of the range — long ones are rarer
    const sec = spec.minSec + (spec.maxSec - spec.minSec) * Math.pow(this.random(), 1.6);
    return { kind, label: spec.label ?? kind, ms: Math.round(sec * 1000) };
  }

  #overdueKind(clock) {
    for (const kind of this.kinds) {
      const dueAt = this.#dueAtMs.get(kind);
      if (dueAt !== undefined && (clock.sinceKindMs[kind] ?? 0) >= dueAt) return kind;
    }
    return null;
  }

  // Pick the next "due" moment for a kind: scaled by efficiency, randomized
  #rollDue(kind) {
    const dueMin = this.profile.breaks[kind].dueAfterMin;
    if (!dueMin) return;
    const scale  = (1 - REFERENCE_EFFICIENCY) / Math.max(0.01, 1 - this.efficiency);
    const jitter = DUE_JITTER[0] + (DUE_JITTER[1] - DUE_JITTER[0]) * this.random();
    this.#dueAtMs.set(kind, dueMin * 60000 * scale * jitter);
  }

  #weightedPick(entries) {
    const total = entries.reduce((sum, [, k]) => sum + k.weight, 0);
    let r = this.random() * total;
    for (const entry of entries) {
      r -= entry[1].weight;
      if (r <= 0) return entry;
    }
    return entries.at(-1);
  }
}
