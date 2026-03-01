// ── Model Registry ────────────────────────────────────────────────────────────
// This is the ONLY file to touch when adding a new model.
// 1. Create your model file in src/models/
// 2. Import it here
// 3. Add it to the models array
// ─────────────────────────────────────────────────────────────────────────────

import highAlch   from './highAlch.js';
import dart       from './dart.js';
import simpleClick from './simpleClick.js';

const models = [highAlch, dart, simpleClick];

/**
 * Get a single model by its id.
 * @param {string} id
 * @returns {object|undefined}
 */
export function getModel(id) {
  return models.find(m => m.id === id);
}

/**
 * Get all registered models (used to populate UI dropdowns).
 * @returns {object[]}
 */
export function getAllModels() {
  return models;
}