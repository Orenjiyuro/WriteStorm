import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../..');
const runnerPath = path.join(
  rootDir,
  'scripts/run-task13-12-settings-natural-path-probe.mjs',
);

describe('Block 13.12 packaged Settings natural-path probe boundary', () => {
  it('is an explicit command outside the default offline regression', () => {
    const packageJson = JSON.parse(readFileSync(
      path.join(rootDir, 'package.json'),
      'utf8',
    )) as { scripts: Record<string, string> };

    expect(packageJson.scripts['probe:task13:settings-natural-path']).toBe(
      'node scripts/run-task13-12-settings-natural-path-probe.mjs',
    );
    expect(packageJson.scripts.check).not.toContain(
      'probe:task13:settings-natural-path',
    );
    expect(packageJson.scripts['test:e2e']).not.toContain(
      'probe:task13:settings-natural-path',
    );
  });

  it('clicks the visible Settings entry and button without a service or IPC shortcut', () => {
    const runner = readFileSync(runnerPath, 'utf8');

    expect(runner).toContain(
      "getByRole('link', { name: 'Settings' }).click()",
    );
    expect(runner).toContain(
      "getByRole('button', { name: 'Check connection' }).click()",
    );
    expect(runner).not.toMatch(
      /window\.writestorm\.ai\.checkConnection|ai-connection-check-service|ipcRenderer|ai:check-connection/,
    );
  });

  it('disables Chromium background networking before the product app becomes ready', () => {
    const main = readFileSync(
      path.join(rootDir, 'src/main/main.ts'),
      'utf8',
    );

    const switchIndex = main.indexOf(
      "app.commandLine.appendSwitch('disable-background-networking')",
    );
    const readyIndex = main.indexOf('app.whenReady()');
    expect(switchIndex).toBeGreaterThan(-1);
    expect(readyIndex).toBeGreaterThan(switchIndex);
  });

  it('disables each session spellchecker at session creation before app readiness', () => {
    const main = readFileSync(
      path.join(rootDir, 'src/main/main.ts'),
      'utf8',
    );

    const sessionCreatedIndex = main.indexOf(
      "app.on('session-created', (createdSession) => {",
    );
    const disableIndex = main.indexOf(
      'createdSession.setSpellCheckerEnabled(false)',
    );
    const redirectIndex = main.indexOf(
      "createdSession.setSpellCheckerDictionaryDownloadURL('writestorm://app/spellcheck-disabled/')",
    );
    const readyIndex = main.indexOf('app.whenReady()');
    expect(sessionCreatedIndex).toBeGreaterThan(-1);
    expect(redirectIndex).toBeGreaterThan(sessionCreatedIndex);
    expect(disableIndex).toBeGreaterThan(redirectIndex);
    expect(readyIndex).toBeGreaterThan(disableIndex);
  });

  it('requires an exact explicit gate and records only bounded assertions in OS temp', () => {
    const runner = readFileSync(runnerPath, 'utf8');

    expect(runner).toContain(
      "WRITESTORM_TASK13_12_SETTINGS_NATURAL_PATH_PROBE",
    );
    expect(runner).toContain("!== '1'");
    expect(runner).toContain("os.tmpdir()");
    expect(runner).toContain('preClickExternalConnectionAbsent');
    expect(runner).toContain('preClickAiProcessesAbsent');
    expect(runner).toContain(
      '[int]$_.ProcessId -ne $PID -and',
    );
    expect(runner).toContain("preClickCompatibility !== 'Unknown'");
    expect(runner).toContain("postClickCompatibility !== 'Fresh'");
    expect(runner).toContain('visibleAuthenticated');
    expect(runner).toContain('visibleObservedAt');
    expect(runner).toContain('noLibraryOpenBeforeClick');
    expect(runner).toContain('postResultAiProcessesAbsent');
    expect(runner).toContain('appTreeResidualAbsent');
    expect(runner).not.toMatch(
      /promptText|responseBody|rawError|credential|providerId|libraryPath|sqlitePath|sourceText|manuscript/i,
    );
  });

  it('fails before artifact or runtime work when the explicit gate is absent', () => {
    const environment = { ...process.env };
    delete environment.WRITESTORM_TASK13_12_SETTINGS_NATURAL_PATH_PROBE;
    const result = spawnSync(process.execPath, [runnerPath], {
      cwd: rootDir,
      env: environment,
      encoding: 'utf8',
      windowsHide: true,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Task 13.12 Settings natural-path probe is not explicitly enabled.',
    );
  });

  it('keeps the product fixed-input host free of Library, SQLite and manuscript reads', () => {
    const host = readFileSync(
      path.join(
        rootDir,
        'src/main/ai/providers/codex/codex-connection-check-utility-host.ts',
      ),
      'utf8',
    );

    expect(host).toContain(
      "Return exactly one JSON object with the single field status set to WS13.",
    );
    expect(host).toContain("status: Object.freeze({ type: 'string', const: 'WS13' })");
    expect(host).not.toMatch(
      /LibraryService|better-sqlite3|SourceText|manuscript|userInput|userPrompt/,
    );
  });
});
