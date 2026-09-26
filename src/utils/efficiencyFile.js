// ── Efficiency File (main process only) ──────────────────────────────────────
// Break profiles + fatigue settings, saved in efficiency.json.
// Created with the defaults on first run so I can open and tune it by hand.
// If I break the file (bad JSON / wrong shape), the defaults are used instead.
// ─────────────────────────────────────────────────────────────────────────────

import { JsonFileStore } from './JsonFileStore.js';
import { DEFAULT_EFFICIENCY_CONFIG } from '../engine/efficiency/defaults.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function validBreak(b) {
  return b && isNum(b.weight) && b.weight >= 0
    && isNum(b.minSec) && isNum(b.maxSec) && b.minSec > 0 && b.minSec <= b.maxSec
    && (b.dueAfterMin === undefined || (isNum(b.dueAfterMin) && b.dueAfterMin > 0));
}

function validProfile(p) {
  return p && typeof p.label === 'string'
    && isNum(p.minGapSec) && p.minGapSec >= 0
    && isNum(p.patienceSec) && p.patienceSec > 0
    && p.breaks && Object.keys(p.breaks).length > 0
    && Object.values(p.breaks).every(validBreak);
}

function validate(data) {
  return Boolean(data)
    && data.fatigue && isNum(data.fatigue.maxSlowdown) && isNum(data.fatigue.rampMinutes) && data.fatigue.rampMinutes > 0
    && data.profiles && Object.keys(data.profiles).length > 0
    && Object.values(data.profiles).every(validProfile);
}

export const efficiencyFile = new JsonFileStore({
  fileName: 'efficiency.json',
  label: 'efficiency',
  createEmpty: () => structuredClone(DEFAULT_EFFICIENCY_CONFIG),
  validate,
});
