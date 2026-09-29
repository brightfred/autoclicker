<template>
  <!-- Small picture of what a "Check area" snapshot looks like -->
  <canvas ref="canvas" class="thumb" :title="`Snapshot ${snapshot.cols}×${snapshot.rows} points`" />
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';

const props = defineProps({
  snapshot: { type: Object, required: true }, // { cols, rows, data: base64 RGB }
  size:     { type: Number, default: 44 },     // longest side on screen (px)
});

const canvas = ref(null);

function draw() {
  const { cols, rows, data } = props.snapshot;
  const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  const el = canvas.value;
  el.width = cols;
  el.height = rows;

  const ctx = el.getContext('2d');
  const img = ctx.createImageData(cols, rows);
  for (let i = 0; i < cols * rows; i++) {
    img.data[i * 4]     = bytes[i * 3];
    img.data[i * 4 + 1] = bytes[i * 3 + 1];
    img.data[i * 4 + 2] = bytes[i * 3 + 2];
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  // Scale up with crisp pixels, keeping the area's shape
  const scale = props.size / Math.max(cols, rows);
  el.style.width  = `${Math.round(cols * scale)}px`;
  el.style.height = `${Math.round(rows * scale)}px`;
}

onMounted(draw);
watch(() => props.snapshot, draw);
</script>

<style scoped>
.thumb {
  image-rendering: pixelated;
  border: 1px solid var(--color-border);
  background: #000;
  flex-shrink: 0;
}
</style>
