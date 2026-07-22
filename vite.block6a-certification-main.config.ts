import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: {
        main: 'src/main/codex-feasibility/certification-main.ts',
      },
      fileName: () => '[name].js',
      formats: ['cjs'],
    },
    rollupOptions: {
      external: ['@openai/codex-sdk', '@openai/codex'],
    },
    target: 'node22',
  },
});
