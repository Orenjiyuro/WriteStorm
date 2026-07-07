import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../..');

const sourceFiles = (dir: string): string[] => {
  return readdirSync(dir).flatMap((entry) => {
    const entryPath = path.join(dir, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      return sourceFiles(entryPath);
    }

    return /\.(ts|tsx)$/.test(entryPath) ? [entryPath] : [];
  });
};

describe('Forge Vite scaffold', () => {
  it('uses the Vite build output as Electron main entry', () => {
    const packageJson = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8')) as {
      main?: string;
    };

    expect(packageJson.main).toBe('.vite/build/main.js');
  });

  it('keeps main, preload, and renderer Vite entries separated', () => {
    const forgeConfig = readFileSync(path.join(rootDir, 'forge.config.ts'), 'utf8');

    expect(forgeConfig).toContain("entry: 'src/main/main.ts'");
    expect(forgeConfig).toContain("entry: 'src/preload/index.ts'");
    expect(forgeConfig).toContain("name: 'main_window'");
    expect(forgeConfig).toContain("config: 'vite.renderer.config.ts'");
    expect(forgeConfig).toContain('asar: true');
  });

  it('keeps the renderer HTML wired to the Vite module entry', () => {
    const rendererHtml = readFileSync(path.join(rootDir, 'src/renderer/index.html'), 'utf8');

    expect(rendererHtml).toContain('<script type="module" src="/main.tsx"></script>');
  });

  it('keeps production renderer HTML covered by a restrictive CSP meta tag', () => {
    const rendererHtml = readFileSync(path.join(rootDir, 'src/renderer/index.html'), 'utf8');

    expect(rendererHtml).toContain('http-equiv="Content-Security-Policy"');
    expect(rendererHtml).toContain("default-src 'self'");
    expect(rendererHtml).not.toContain('unsafe-inline');
    expect(rendererHtml).not.toContain('unsafe-eval');
  });
});

describe('BrowserWindow security wiring', () => {
  it('keeps renderer privileges disabled and installs navigation protections', () => {
    const mainSource = readFileSync(path.join(rootDir, 'src/main/main.ts'), 'utf8');

    expect(mainSource).toContain('nodeIntegration: false');
    expect(mainSource).toContain('contextIsolation: true');
    expect(mainSource).toContain('sandbox: true');
    expect(mainSource).toContain("WRITESTORM_DISABLE_HARDWARE_ACCELERATION === '1'");
    expect(mainSource).toContain('app.disableHardwareAcceleration()');
    expect(mainSource).toContain('protocol.registerSchemesAsPrivileged');
    expect(mainSource).toContain('protocol.registerFileProtocol(appProtocol');
    expect(mainSource).toContain('callback({ path: assetPath })');
    expect(mainSource).toContain("loadURL(createAppUrl('index.html'))");
    expect(mainSource).toContain("path.join(__dirname, 'index.js')");
    expect(mainSource).toContain('installContentSecurityPolicy');
    expect(mainSource).toContain('installNavigationGuards');
  });
});

describe('preload health bridge', () => {
  it('routes health through typed preload IPC without exposing raw ipcRenderer', () => {
    const mainSource = readFileSync(path.join(rootDir, 'src/main/main.ts'), 'utf8');
    const preloadSource = readFileSync(path.join(rootDir, 'src/preload/index.ts'), 'utf8');

    expect(mainSource).toContain("ipcMain.handle('internal:health'");
    expect(mainSource).toContain('isTrustedSenderUrl');
    expect(preloadSource).toContain("ipcRenderer.invoke('internal:health')");
    expect(preloadSource).not.toContain('ipcRenderer,');
  });
});

describe('process import boundaries', () => {
  it('keeps the shared domain, contract, and error layout explicit', () => {
    const sharedDir = path.join(rootDir, 'src/shared');

    expect(existsSync(path.join(sharedDir, 'domain/index.ts'))).toBe(true);
    expect(existsSync(path.join(sharedDir, 'contracts/index.ts'))).toBe(true);
    expect(existsSync(path.join(sharedDir, 'errors/index.ts'))).toBe(true);
  });

  it('keeps privileged modules out of renderer and shared source files', () => {
    const rendererAndSharedFiles = [
      ...sourceFiles(path.join(rootDir, 'src/renderer')),
      ...sourceFiles(path.join(rootDir, 'src/shared')),
    ];
    const sharedFiles = sourceFiles(path.join(rootDir, 'src/shared'));

    const privilegedImportPattern =
      /\bfrom\s+['"](?:electron|node:fs|node:path|node:child_process|fs|path|child_process)['"]|\bimport\s+['"](?:electron|node:fs|node:path|node:child_process|fs|path|child_process)['"]/;
    const sharedOnlyForbiddenImportPattern =
      /\bfrom\s+['"](?:react|react-dom|better-sqlite3|sqlite3|@openai\/codex)['"]|\bimport\s+['"](?:react|react-dom|better-sqlite3|sqlite3|@openai\/codex)['"]/;

    const privilegedImportOffenders = rendererAndSharedFiles.filter((filePath) => {
      return privilegedImportPattern.test(readFileSync(filePath, 'utf8'));
    });
    const sharedImportOffenders = sharedFiles.filter((filePath) => {
      return sharedOnlyForbiddenImportPattern.test(readFileSync(filePath, 'utf8'));
    });

    expect(privilegedImportOffenders).toEqual([]);
    expect(sharedImportOffenders).toEqual([]);
  });
});

describe('renderer a11y and i18n shell baseline', () => {
  it('keeps visible renderer copy in the replaceable resource layer', () => {
    const appSource = readFileSync(path.join(rootDir, 'src/renderer/App.tsx'), 'utf8');
    const i18nSource = readFileSync(path.join(rootDir, 'src/renderer/i18n.ts'), 'utf8');

    expect(appSource).toContain('rendererText');
    expect(appSource).not.toContain('No library open');
    expect(appSource).not.toContain('Create or open a local library');
    expect(i18nSource).toContain('No library open');
    expect(i18nSource).toContain('rendererFormats');
  });
});
