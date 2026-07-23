import type { UserConfig } from 'vite';

export const CODEX_UTILITY_VITE_CONFIG = Object.freeze({
  build: {
    rollupOptions: {
      external: ['@openai/codex-sdk', '@openai/codex'],
    },
    target: 'node22',
  },
}) satisfies UserConfig;
