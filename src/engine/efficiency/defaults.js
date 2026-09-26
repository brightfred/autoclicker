// ── Default efficiency.json ───────────────────────────────────────────────────
// Written to %APPDATA%/AlchClicker/efficiency.json the first time the app runs.
// I can edit that file to tune breaks — changes apply on the next Start.
//
// Per profile:
//   minGapSec   - never two breaks closer than this (working seconds)
//   patienceSec - how quickly owed break time turns into an actual break
//                 (lower = breaks come as soon as they're earned)
//   breaks      - the kinds of break: relative weight + duration range
//                 dueAfterMin (optional): at 90% efficiency I take this kind
//                 roughly every N minutes even if not "earned" (randomized,
//                 more often at lower efficiency, less often at higher)
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_EFFICIENCY_CONFIG = {
  fatigue: {
    maxSlowdown: 0.35,  // up to 35% slower reactions at 50% efficiency...
    rampMinutes: 25,    // ...reached after 25 min without a long break
    resetKind: 'long',  // the break that makes me fresh again
  },
  profiles: {
    general: {
      label: 'General',
      minGapSec: 20,
      patienceSec: 25,
      breaks: {
        hesitate: { label: 'Hesitate', weight: 6, minSec: 1,  maxSec: 4 },
        short:    { label: 'Short',    weight: 3, minSec: 5,  maxSec: 25 },
        long:     { label: 'AFK',      weight: 1, minSec: 45, maxSec: 240, dueAfterMin: 35 },
      },
    },
    'high-alch': {
      label: 'High alch',
      minGapSec: 12,
      patienceSec: 15,
      breaks: {
        hesitate: { label: 'Hesitate', weight: 8, minSec: 1,  maxSec: 3 },
        short:    { label: 'Short',    weight: 3, minSec: 4,  maxSec: 18 },
        long:     { label: 'AFK',      weight: 1, minSec: 30, maxSec: 180, dueAfterMin: 30 },
      },
    },
    firemaking: {
      label: 'Firemaking',
      minGapSec: 40,
      patienceSec: 30,
      breaks: {
        hesitate: { label: 'Hesitate', weight: 3, minSec: 1,  maxSec: 5 },
        short:    { label: 'Short',    weight: 4, minSec: 6,  maxSec: 30 },
        long:     { label: 'AFK',      weight: 2, minSec: 60, maxSec: 300, dueAfterMin: 40 },
      },
    },
    darts: {
      label: 'Darts',
      minGapSec: 10,
      patienceSec: 12,
      breaks: {
        hesitate: { label: 'Hesitate', weight: 9, minSec: 1,  maxSec: 3 },
        short:    { label: 'Short',    weight: 2, minSec: 4,  maxSec: 15 },
        long:     { label: 'AFK',      weight: 1, minSec: 30, maxSec: 150, dueAfterMin: 30 },
      },
    },
  },
};

export const DEFAULT_PROFILE_ID = 'general';
export const DEFAULT_EFFICIENCY = 0.9;
