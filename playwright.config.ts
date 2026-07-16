import { defineConfig } from '@playwright/test';
import { configureLocalE2EDisplayPolicy } from './tests/e2e/display-policy';

configureLocalE2EDisplayPolicy(process.env);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  reporter: 'list',
  // Every spec launches the same packaged desktop app. Serialize them so
  // concurrent Electron GPU/process trees cannot invalidate one another.
  workers: 1,
});
