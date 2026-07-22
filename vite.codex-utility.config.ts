import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['@openai/codex-sdk', '@openai/codex'],
    },
    target: 'node22',
  },
});
