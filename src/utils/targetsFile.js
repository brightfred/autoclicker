// ── Targets File (main process only) ─────────────────────────────────────────
// My targets + setups, saved in targets.json.
// ─────────────────────────────────────────────────────────────────────────────

import { JsonFileStore } from './JsonFileStore.js';

// What a brand new file looks like — one empty setup so the UI is never blank
function createEmpty() {
  const id = Date.now().toString();
  return {
    activeSetupId: id,
    setups: [{ id, name: 'Default setup', targets: [] }],
  };
}

function validate(data) {
  return Boolean(data)
    && Array.isArray(data.setups)
    && data.setups.every(s => s.id && typeof s.name === 'string' && Array.isArray(s.targets));
}

export const targetsFile = new JsonFileStore({
  fileName: 'targets.json',
  label: 'targets',
  createEmpty,
  validate,
});
