import { chromium, expect, test } from '@playwright/test';
import type { ChildProcess } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {
  formatErrorWithElectronStderr,
  isSupportedPackagedPlatform,
  spawnPackagedApp,
} from './electron-app';

test.skip(!isSupportedPackagedPlatform(), 'Packaged Electron native SQLite probe targets Windows and macOS.');

test('packaged Electron main process can load better-sqlite3 and open SQLite', async () => {
  const port = await getFreePort();
  const userDataDir = path.join(process.cwd(), 'test-results', 'electron-native-sqlite-probe-user-data');
  const probeResultDir = path.join(process.cwd(), 'test-results', 'electron-native-sqlite-probe');
  const probeResultPath = path.join(probeResultDir, 'probe-result.json');
  const stderrLines: string[] = [];
  mkdirSync(userDataDir, { recursive: true });
  mkdirSync(probeResultDir, { recursive: true });
  rmSync(probeResultPath, { force: true });

  const appProcess = spawnPackagedApp({
    args: [`--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`],
    env: {
      WRITESTORM_NATIVE_SQLITE_PROBE: '1',
      WRITESTORM_NATIVE_SQLITE_PROBE_RESULT: probeResultPath,
    },
  });
  let appExit: { code: number | null; signal: NodeJS.Signals | null } | undefined;

  appProcess.stderr?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split(/\r?\n/)) {
      if (line.length > 0) {
        stderrLines.push(line);
      }
    }
  });
  appProcess.once('exit', (code, signal) => {
    appExit = { code, signal };
  });

  let browser: Awaited<ReturnType<typeof connectToElectron>> | undefined;
  try {
    browser = await connectToElectron(port, () => appExit);
    const context = browser.contexts()[0];
    const page = context.pages()[0] ?? (await context.waitForEvent('page'));

    await expect(page.getByRole('heading', { name: 'No library open' })).toBeVisible();
    await expect.poll(() => (existsSync(probeResultPath) ? readFileSync(probeResultPath, 'utf8') : '')).toContain(
      '"ok":true',
    );
    const probeResult = JSON.parse(readFileSync(probeResultPath, 'utf8')) as {
      ok: boolean;
      sqliteVersion: string;
      migrationSchemaVersion: number;
      reopenedSchemaVersion: number;
      gb18030Text: string;
      gb18030Encoding: string;
    };
    expect(probeResult).toMatchObject({
      ok: true,
      migrationSchemaVersion: 1,
      reopenedSchemaVersion: 1,
      gb18030Text: '中文',
      gb18030Encoding: 'gb18030',
    });

    const health = await page.evaluate(() => window.writestorm.internal.health());
    expect(health).toEqual({ ok: true, app: 'WriteStorm' });
  } catch (error) {
    throw formatErrorWithElectronStderr(error, stderrLines.join('\n'));
  } finally {
    await browser?.close().catch(() => undefined);
    stopProcess(appProcess);
  }
});

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === 'object' && address?.port) {
          resolve(address.port);
        } else {
          reject(new Error('Unable to allocate a local debugging port.'));
        }
      });
    });
  });
}

async function connectToElectron(
  port: number,
  getAppExit?: () => { code: number | null; signal: NodeJS.Signals | null } | undefined,
) {
  const endpoint = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 10_000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    const appExit = getAppExit?.();
    if (appExit) {
      throw new Error(
        `Electron exited before CDP connection (code: ${appExit.code ?? 'null'}, signal: ${appExit.signal ?? 'null'}).`,
      );
    }

    try {
      return await chromium.connectOverCDP(endpoint, { timeout: 1_000 });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Could not connect to ${endpoint}`);
}

function stopProcess(processToStop: ChildProcess): void {
  if (!processToStop.killed) {
    processToStop.kill();
  }
}
