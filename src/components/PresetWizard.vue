<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="wizard">

      <header class="wiz-head">
        <div>
          <p class="wiz-title">New sequence from a preset</p>
          <p class="wiz-sub">Pick a routine, connect it to your targets, and it builds every step for you.</p>
        </div>
        <button class="btn-icon" @click="$emit('close')" title="Close">✕</button>
      </header>

      <!-- 1. Which preset -->
      <div class="preset-grid">
        <button
          v-for="p in PRESETS"
          :key="p.id"
          class="preset-card"
          :class="{ active: preset.id === p.id }"
          @click="choose(p)"
        >
          <span class="preset-icon">{{ p.icon }}</span>
          <span class="preset-name">{{ p.name }}</span>
          <span class="preset-desc">{{ p.description }}</span>
        </button>
      </div>

      <div class="wiz-body">
        <!-- 2. Name + setup -->
        <section class="wiz-section">
          <div class="row">
            <label class="field grow">
              <span class="field-label">Name</span>
              <input v-model="name" class="input" maxlength="40" />
            </label>
            <label class="field">
              <span class="field-label">Setup</span>
              <select v-model="setupId" class="select" @change="guess">
                <option v-for="s in setups" :key="s.id" :value="s.id">{{ s.name }} ({{ s.targets.length }})</option>
              </select>
            </label>
          </div>
        </section>

        <!-- 3. Options first — they decide which targets are needed -->
        <section class="wiz-section">
          <div class="panel-title">Options</div>
          <div v-for="opt in visibleOptions" :key="opt.id" class="opt-row">
            <span class="opt-label">
              {{ opt.label }}
              <span v-if="opt.hint" class="opt-hint">{{ opt.hint }}</span>
            </span>

            <div v-if="opt.type === 'choice'" class="segmented">
              <button
                v-for="c in opt.choices" :key="c.value"
                :class="{ on: options[opt.id] === c.value }"
                @click="options[opt.id] = c.value"
              >{{ c.label }}</button>
            </div>

            <label v-else-if="opt.type === 'toggle'" class="check">
              <input type="checkbox" v-model="options[opt.id]" />
              <span>{{ options[opt.id] ? 'Yes' : 'No' }}</span>
            </label>

            <select v-else-if="opt.type === 'slot'" v-model.number="options[opt.id]" class="select sm">
              <option v-for="n in SLOT_COUNT" :key="n" :value="n">Slot {{ n }}</option>
            </select>

            <input
              v-else-if="opt.type === 'number'"
              type="number" :min="opt.min ?? 0" step="1"
              class="input num sm"
              v-model.number="options[opt.id]"
            />

            <div v-else-if="opt.type === 'range'" class="range">
              <input type="number" min="0" step="0.1" class="input num sm" v-model.number="options[opt.id][0]" />
              <span>to</span>
              <input type="number" min="0" step="0.1" class="input num sm" v-model.number="options[opt.id][1]" />
              <span>{{ opt.unit }}</span>
            </div>
          </div>
        </section>

        <!-- 4. Connect each role to one of my targets -->
        <section class="wiz-section">
          <div class="panel-title">Connect your targets</div>
          <p v-if="!setup || setup.targets.length === 0" class="warn">
            This setup has no targets yet — draw them first in the <router-link to="/targets" @click="$emit('close')">Targets</router-link> tab.
          </p>
          <div v-for="role in roles" :key="role.id" class="opt-row">
            <span class="opt-label">
              {{ role.label }}
              <span v-if="role.optional" class="optional">optional</span>
              <span class="opt-hint">{{ role.hint }}</span>
            </span>
            <select v-model="picks[role.id]" class="select sm target-select" :class="{ missing: !role.optional && !picks[role.id] }">
              <option :value="null">{{ role.optional ? '— none —' : '— pick a target —' }}</option>
              <option v-for="t in candidates(role)" :key="t.id" :value="t.id">{{ getKind(t.kind).icon }} {{ t.name }}</option>
            </select>
          </div>
        </section>
      </div>

      <!-- Preview + create -->
      <footer class="wiz-foot">
        <div class="preview">
          <template v-if="missing.length">
            <span class="warn">Still needed: {{ missing.map(r => r.label).join(', ') }}</span>
          </template>
          <template v-else-if="problem">
            <span class="warn">{{ problem }}</span>
          </template>
          <template v-else>
            <span class="stat">{{ builtSteps.length }} steps</span>
            <span class="stat">{{ loops > 0 ? `${loops} loops` : 'loops forever' }}</span>
            <span class="stat">☕ {{ Math.round(preset.efficiency * 100) }}% · {{ preset.breakProfile }}</span>
          </template>
        </div>
        <button class="btn-ghost" @click="$emit('close')">Cancel</button>
        <button class="btn-primary" :disabled="!canCreate" @click="create">Create sequence</button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useTargetsStore } from '../stores/targets';
import { useSequencesStore } from '../stores/sequences';
import { PRESETS, defaultOptions, activeRoles, activeOptions, guessRoles } from '../sequence/presets/index.js';
import { getKind, INV_COLS, INV_ROWS } from '../utils/targetGeometry.js';

const SLOT_COUNT = INV_COLS * INV_ROWS;
const emit = defineEmits(['close', 'created']);

const targetStore = useTargetsStore();
const seqStore    = useSequencesStore();
const { setups }  = storeToRefs(targetStore);

const preset  = ref(PRESETS[0]);
const name    = ref(PRESETS[0].name);
const setupId = ref(targetStore.activeSetup?.id ?? setups.value[0]?.id ?? null);
const options = reactive(defaultOptions(PRESETS[0]));
const picks   = reactive({});

const setup   = computed(() => setups.value.find(s => s.id === setupId.value));
const targets = computed(() => setup.value?.targets ?? []);
const roles   = computed(() => activeRoles(preset.value, options));

// The target picked for each role (null if none yet)
const roleTargets = computed(() => {
  const byId = new Map(targets.value.map(t => [t.id, t]));
  return Object.fromEntries(roles.value.map(r => [r.id, byId.get(picks[r.id]) ?? null]));
});

// Options that apply right now (e.g. the slot only when the item is the Inventory)
const visibleOptions = computed(() => activeOptions(preset.value, options, roleTargets.value));

// Required roles I haven't connected yet
const missing = computed(() => roles.value.filter(r => !r.optional && !picks[r.id]));

// Simple sanity checks on the ranges
const problem = computed(() => {
  for (const opt of visibleOptions.value) {
    if (opt.type === 'number' && !(options[opt.id] >= (opt.min ?? 0))) return `${opt.label}: enter a number`;
    if (opt.type !== 'range') continue;
    const [min, max] = options[opt.id];
    if (!(min >= 0) || !(max >= 0)) return `${opt.label}: enter both numbers`;
    if (min > max) return `${opt.label}: min is bigger than max`;
  }
  return null;
});

// Build the steps live, so the preview always matches what I'll get
const builtSteps = computed(() => {
  if (missing.value.length || problem.value) return [];
  return preset.value.build({ roles: roleTargets.value, options });
});

const loops = computed(() => preset.value.loops?.(options) ?? 0);

const canCreate = computed(() => name.value.trim() && setupId.value && builtSteps.value.length > 0);

function candidates(role) {
  return targets.value.filter(t => role.kinds.includes(t.kind));
}

function guess() {
  const guessed = guessRoles(preset.value, targets.value);
  for (const key of Object.keys(picks)) delete picks[key];
  Object.assign(picks, guessed);
}

function choose(p) {
  preset.value = p;
  name.value = p.name;
  for (const key of Object.keys(options)) delete options[key];
  Object.assign(options, defaultOptions(p));
  guess();
}

function create() {
  const seq = seqStore.addSequence({
    name: name.value.trim(),
    setupId: setupId.value,
    actions: builtSteps.value,
    loops: loops.value,
    efficiency: preset.value.efficiency,
    breakProfile: preset.value.breakProfile,
  });
  emit('created', seq);
}

onMounted(guess);
</script>

<style scoped>
.wizard {
  width: 680px;
  max-height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
}
.wiz-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 18px 20px 12px;
}
.wiz-title { font-size: 18px; font-weight: 700; letter-spacing: 0.04em; }
.wiz-sub   { font-size: 13px; color: var(--color-muted); margin-top: 2px; }

.preset-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 0 20px 12px; }
.preset-card {
  display: grid;
  grid-template-columns: 30px 1fr;
  grid-template-rows: auto auto;
  column-gap: 10px;
  row-gap: 2px;
  text-align: left;
  padding: 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-top: 2px solid transparent;
  color: var(--color-text);
  font-family: var(--font-display);
  cursor: pointer;
  transition: all 0.15s;
}
.preset-card:hover  { border-color: #2e3850; }
.preset-card.active { border-top-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 7%, var(--color-surface)); }
.preset-icon { grid-row: span 2; font-size: 22px; align-self: center; }
.preset-name { font-weight: 700; font-size: 15px; }
.preset-desc { font-size: 12px; color: var(--color-muted); line-height: 1.35; }

.wiz-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  border-top: 1px solid var(--color-border);
  padding-top: 14px;
  padding-bottom: 14px;
}
.wiz-section { display: flex; flex-direction: column; gap: 8px; }
.row { display: flex; gap: 10px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field.grow { flex: 1; }

.opt-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 6px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
}
.opt-label { display: flex; flex-direction: column; font-size: 14px; font-weight: 600; }
.opt-hint  { font-size: 11px; font-weight: 400; color: var(--color-muted); }
.optional  { font-size: 10px; font-family: var(--font-mono); color: var(--color-muted); text-transform: uppercase; letter-spacing: 0.1em; }

.segmented { display: flex; }
.segmented button {
  padding: 5px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-muted);
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
}
.segmented button + button { border-left: none; }
.segmented button.on { color: #0a0c0f; background: var(--color-accent); border-color: var(--color-accent); }

.check { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--color-muted); cursor: pointer; }
.check input { accent-color: var(--color-accent); }

.range { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-muted); }
.select.sm, .input.sm { padding: 4px 8px; font-size: 13px; }
.input.num.sm { width: 64px; }
.target-select { min-width: 200px; }
.target-select.missing { border-color: rgba(239, 68, 68, 0.6); }

.warn { font-size: 12px; color: var(--color-red); font-weight: 600; }
.warn a { color: var(--color-accent); }

.wiz-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}
.preview { flex: 1; display: flex; gap: 8px; align-items: center; min-width: 0; }
</style>
