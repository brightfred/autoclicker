<template>
  <!-- "0.6 – 1.2 s": a random time between min and max, edited in seconds, saved in ms -->
  <span class="range">
    <input
      type="number" min="0" step="0.05" class="input num sm"
      :value="toSec(min)" :disabled="disabled"
      @change="$emit('update:min', fromSec($event.target.value))"
    />
    <span>–</span>
    <input
      type="number" min="0" step="0.05" class="input num sm"
      :value="toSec(max)" :disabled="disabled"
      @change="$emit('update:max', fromSec($event.target.value))"
    />
    <span>s</span>
  </span>
</template>

<script setup>
defineProps({
  min:      { type: Number, required: true },
  max:      { type: Number, required: true },
  disabled: { type: Boolean, default: false },
});
defineEmits(['update:min', 'update:max']);

// Seconds with up to 2 decimals (0.25s must stay 0.25, not become 0.3)
function toSec(ms) {
  return Math.round(ms / 10) / 100;
}

function fromSec(value) {
  return Math.max(0, Math.round(Number(value || 0) * 1000));
}
</script>

<style scoped>
.range { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-muted); }
.input.num.sm { width: 62px; padding: 4px 6px; font-size: 13px; }
</style>
