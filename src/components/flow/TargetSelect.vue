<template>
  <!-- Dropdown of targets, showing "missing" if the saved one was deleted -->
  <select
    class="select sm target-select"
    :value="modelValue"
    :title="current?.name"
    :disabled="disabled"
    @change="$emit('update:modelValue', $event.target.value || null)"
  >
    <option v-if="!current" :value="modelValue ?? ''" disabled>{{ modelValue ? '— missing target —' : placeholder }}</option>
    <option v-for="t in targets" :key="t.id" :value="t.id">{{ getKind(t.kind).icon }} {{ t.name }}</option>
  </select>
</template>

<script setup>
import { computed } from 'vue';
import { getKind } from '../../utils/targetGeometry.js';

const props = defineProps({
  modelValue:  { type: String, default: null },
  targets:     { type: Array, required: true },
  placeholder: { type: String, default: '— pick a target —' },
  disabled:    { type: Boolean, default: false },
});
defineEmits(['update:modelValue']);

const current = computed(() => props.targets.find(t => t.id === props.modelValue));
</script>

<style scoped>
.target-select { width: 190px; padding: 4px 8px; font-size: 13px; }
</style>
