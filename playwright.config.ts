import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  reporter: 'list',
  // Every spec launches the same packaged desktop app. Serialize them so
  // concurrent Electron GPU/process trees cannot invalidate one another.
  workers: 1,
});
