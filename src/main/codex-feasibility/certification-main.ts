import { app } from 'electron';
import { runOptionalPackagedCodexProbe } from './packaged-probe';

process.title = 'WriteStorm Block 6A Certification';

app.whenReady().then(async () => {
  const certificationHandled = await runOptionalPackagedCodexProbe({
    env: process.env,
    mainBundleDirectory: __dirname,
  });

  if (!certificationHandled) process.exit(33);
}).catch(() => {
  process.exit(34);
});
