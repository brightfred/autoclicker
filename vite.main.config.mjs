import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // Native module — loaded at runtime from node_modules, never bundled
      external: [
        '@jitsi/robotjs',
      ],
    },
  },
});