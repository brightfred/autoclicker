<template>
  <!-- Where an If / Go to step sends me: another step, the next loop, or stop -->
  <select
    class="select sm jump-select"
    :value="modelValue ?? ''"
    :disabled="disabled"
    @change="$emit('update:modelValue', $event.target.value || null)"
  >
    <option value="" disabled>choose where to go</option>
    <optgroup label="Step">
      <option v-for="o in stepOptions" :key="o.id" :value="o.id">#{{ o.number }} {{ o.label }}</option>
    </optgroup>
    <optgroup label="Or">
      <option value="@next-loop">↻ start the next loop</option>
      <option value="@stop">■ stop the run</option>
    </optgroup>
    <option v-if="missing" :value="modelValue" disabled>— removed step —</option>
  </select>
</template>

<script setup>
import { computed } from 'vue';
import { stepLabel } from '../../sequence/stepLabels.js';

const props = defineProps({
  modelValue: { type: String, default: null },
  steps:      { type: Array, required: true },  // all steps of the sequence
  selfId:     { type: String, required: true },  // can't jump to myself
  targetById: { type: Map, required: true },
  disabled:   { type: Boolean, default: false },
});
defineEmits(['update:modelValue']);

const stepOptions = computed(() => props.steps
  .map((step, i) => ({ id: step.id, number: i + 1, label: stepLabel(step, props.targetById) }))
  .filter(o => o.id !== props.selfId));

const missing = computed(() =>
  props.modelValue && !props.modelValue.startsWith('@') && !props.steps.some(s => s.id === props.modelValue));
</script>

<style scoped>
.jump-select { max-width: 230px; padding: 4px 8px; font-size: 13px; }
</style>
