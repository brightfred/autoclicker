<template>
  <!--
    Dark backdrop behind every pop-up. It only closes the pop-up when the mouse
    press STARTED on the dark area — so drag-selecting text in a field and
    releasing the mouse outside the pop-up no longer closes it by accident.
    Esc also closes it.
  -->
  <div class="modal-backdrop" @mousedown="pressedOnBackdrop = $event.target === $event.currentTarget" @click.self="onClick">
    <slot />
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue';

const emit = defineEmits(['close']);
let pressedOnBackdrop = false;

function onClick() {
  if (pressedOnBackdrop) emit('close');
  pressedOnBackdrop = false;
}

function onKey(e) {
  if (e.key === 'Escape') emit('close');
}

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>
