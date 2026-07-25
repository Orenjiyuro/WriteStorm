import { app } from 'electron';
import { runOptionalPackagedCodexProbe } from './packaged-probe';
import { runOptionalTask13NoGitPackagedProbe } from './task13-no-git-packaged-probe';

process.title = 'WriteStorm Block 6A Certification';

app.whenReady().then(async () => {
  const task13Handled = await runOptionalTask13NoGitPackagedProbe({
    env: process.env,
    mainBundleDirectory: __dirname,
  });
  if (task13Handled) {
    process.exit(process.exitCode ?? 0);
    return;
  }
  const certificationHandled = await runOptionalPackagedCodexProbe({
    env: process.env,
    mainBundleDirectory: __dirname,
  });

  if (!certificationHandled) process.exit(33);
}).catch(() => {
  process.exit(34);
});
