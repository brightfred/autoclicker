// ── Sequences File (main process only) ───────────────────────────────────────
// My action sequences (click banker → wait → press Esc → ...), saved in sequences.json.
// Each sequence points to a setup by id, and to targets inside it by id.
// ─────────────────────────────────────────────────────────────────────────────

import { JsonFileStore } from './JsonFileStore.js';

function validate(data) {
  return Boolean(data)
    && Array.isArray(data.sequences)
    && data.sequences.every(s => s.id && typeof s.name === 'string' && Array.isArray(s.actions));
}

export const sequencesFile = new JsonFileStore({
  fileName: 'sequences.json',
  label: 'sequences',
  createEmpty: () => ({ sequences: [] }),
  validate,
});
