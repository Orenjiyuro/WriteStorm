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
  it('composes the source import use case once and injects a shallow book IPC adapter', () => {
    const mainSource = readFileSync(path.join(rootDir, 'src/main/main.ts'), 'utf8');

    expect(mainSource).toContain('const bookService = new BookService({');
    expect(mainSource).toContain('const sourceImportService = new SourceImportService({');
    expect(mainSource).toContain('createElectronSourceTextWorkerRunner(');
    expect(mainSource).toContain('books: bookService');
    expect(mainSource).toContain('sourceImport: sourceImportService');
    expect(mainSource).toContain('getCurrentSession: () => libraryService.getCurrent()');
    expect(mainSource).toContain('showOpenDialog: (options) => dialog.showOpenDialog(options)');
    expect(mainSource).toContain('sourceImportService.clearPendingImports();');
    expect(mainSource).toContain('onClosed: cleanupSourceImportsForWindowClose');
    expect(mainSource).toContain('books.invalidateWindowSelections();');
  });

  it('uses the Vite build output as Electron main entry', () => {
    const packageJson = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8')) as {
      main?: string;
    };

    expect(packageJson.main).toBe('.vite/build/main.js');
  });

  it('keeps main, preload, and renderer Vite entries separated', () => {
    const forgeConfig = readFileSync(path.join(rootDir, 'forge.config.ts'), 'utf8');

    // Static guard: Forge config is consumed by Electron Forge at package time.
    // Importing the plugin instance gives little stable public shape, so build/e2e
    // are the behavioral proof and this test guards the expected scaffold wiring.
    expect(forgeConfig).toMatch(/entry:\s*['"]src\/main\/main\.ts['"]/);
    expect(forgeConfig).toMatch(/entry:\s*['"]src\/preload\/index\.ts['"]/);
    expect(forgeConfig).toMatch(/name:\s*['"]main_window['"]/);
    expect(forgeConfig).toMatch(/config:\s*['"]vite\.renderer\.config\.ts['"]/);
    expect(forgeConfig).toMatch(/asar:\s*(true|{[\s\S]*unpack:\s*['"]\*\*\/\*\.node['"])/);
  });

  it('keeps the renderer HTML wired to the Vite module entry', () => {
    const rendererHtml = readFileSync(path.join(rootDir, 'src/renderer/index.html'), 'utf8');

    expect(rendererHtml).toContain('<script type="module" src="/main.tsx"></script>');
  });

  it('keeps production renderer HTML covered by a restrictive CSP meta tag', () => {
    const rendererHtml = readFileSync(path.join(rootDir, 'src/renderer/index.html'), 'utf8');
    const cspContent = rendererHtml.match(/http-equiv="Content-Security-Policy"[^>]+content="([^"]+)"/)?.[1];

    expect(cspContent).toBeDefined();
    expect(cspContent).toContain("default-src 'self'");
    expect(cspContent).not.toContain('unsafe-inline');
    expect(cspContent).not.toContain('unsafe-eval');
  });
});

describe('BrowserWindow security wiring', () => {
  it('keeps renderer privileges disabled and installs navigation protections', () => {
    const mainSource = readFileSync(path.join(rootDir, 'src/main/main.ts'), 'utf8');
    const mainWindowSource = readFileSync(
      path.join(rootDir, 'src/main/windows/main-window.ts'),
      'utf8',
    );

    // Static guard: BrowserWindow construction is intentionally not exported
    // just for tests. E2E covers user-observable renderer isolation.
    expect(mainSource).toContain('createMainWindow({');
    expect(mainWindowSource).toMatch(/webPreferences:\s*{[\s\S]*nodeIntegration:\s*false/);
    expect(mainWindowSource).toMatch(/webPreferences:\s*{[\s\S]*contextIsolation:\s*true/);
    expect(mainWindowSource).toMatch(/webPreferences:\s*{[\s\S]*sandbox:\s*true/);
    expect(mainSource).toContain("WRITESTORM_DISABLE_HARDWARE_ACCELERATION === '1'");
    expect(mainSource).toContain('app.disableHardwareAcceleration()');
    expect(mainSource).toContain('protocol.registerSchemesAsPrivileged');
    expect(mainSource).toContain('protocol.registerFileProtocol(appProtocol');
    expect(mainSource).toContain('callback({ path: assetPath })');
    expect(mainSource).toContain("appUrl: MAIN_WINDOW_VITE_DEV_SERVER_URL ?? createAppUrl('index.html')");
    expect(mainWindowSource).toContain('await window.loadURL(dependencies.appUrl)');
    expect(mainSource).toContain("path.join(__dirname, 'index.js')");
    expect(mainSource).toContain('installContentSecurityPolicy');
    expect(mainWindowSource).toContain('setWindowOpenHandler');
    expect(mainWindowSource).toContain("on('will-navigate'");
  });
});

describe('preload health bridge', () => {
  it('routes health through typed preload IPC without exposing raw ipcRenderer', () => {
    const mainSource = readFileSync(path.join(rootDir, 'src/main/main.ts'), 'utf8');
    const preloadSource = readFileSync(path.join(rootDir, 'src/preload/index.ts'), 'utf8');
    const exposedSource = preloadSource.slice(preloadSource.indexOf('contextBridge.exposeInMainWorld'));

    expect(mainSource).toContain("ipcMain.handle('internal:health'");
    expect(mainSource).toContain('isTrustedSenderUrl');
    expect(preloadSource).toMatch(/contextBridge\.exposeInMainWorld\(\s*['"]writestorm['"]/);
    expect(preloadSource).toMatch(/ipcRenderer\.invoke\(/);
    expect(exposedSource).not.toMatch(/\bipcRenderer\s*[,}]/);
    expect(exposedSource).not.toMatch(/\bipcRenderer\s*:/);
  });
});

describe('process import boundaries', () => {
  it('keeps the Block 1 process directories explicit', () => {
    const srcDir = path.join(rootDir, 'src');

    expect(existsSync(path.join(srcDir, 'main'))).toBe(true);
    expect(existsSync(path.join(srcDir, 'preload'))).toBe(true);
    expect(existsSync(path.join(srcDir, 'renderer'))).toBe(true);
    expect(existsSync(path.join(srcDir, 'shared'))).toBe(true);
  });

  it('keeps privileged modules out of renderer and shared source files', () => {
    const rendererAndSharedFiles = [
      ...sourceFiles(path.join(rootDir, 'src/renderer')),
      ...sourceFiles(path.join(rootDir, 'src/shared')),
    ];
    const sharedFiles = sourceFiles(path.join(rootDir, 'src/shared'));

    const privilegedImportOffenders = rendererAndSharedFiles.filter((filePath) => {
      return importSpecifiers(readFileSync(filePath, 'utf8')).some((specifier) => {
        return isPackageImport(specifier, ['electron', 'node:fs', 'node:path', 'node:child_process', 'fs', 'path', 'child_process']);
      });
    });
    const sharedImportOffenders = sharedFiles.filter((filePath) => {
      return importSpecifiers(readFileSync(filePath, 'utf8')).some((specifier) => {
        return isPackageImport(specifier, ['react', 'react-dom', 'better-sqlite3', 'sqlite3', '@openai/codex']);
      });
    });

    expect(privilegedImportOffenders).toEqual([]);
    expect(sharedImportOffenders).toEqual([]);
  });
});

describe('renderer a11y and i18n shell baseline', () => {
  it('keeps visible renderer copy in the replaceable resource layer', () => {
    const productRouteSource = readFileSync(
      path.join(rootDir, 'src/renderer/routes/NoLibraryRoute.tsx'),
      'utf8',
    );
    const i18nSource = readFileSync(path.join(rootDir, 'src/renderer/i18n.ts'), 'utf8');

    expect(productRouteSource).toContain('rendererText');
    expect(productRouteSource).not.toContain('No library open');
    expect(productRouteSource).not.toContain('Create or open a local library');
    expect(i18nSource).toContain('No library open');
    expect(i18nSource).toContain('rendererFormats');
  });
});

function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const importPattern =
    /\b(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const match of source.matchAll(importPattern)) {
    specifiers.push(match[1] ?? match[2]);
  }

  return specifiers;
}

function isPackageImport(specifier: string, packages: string[]): boolean {
  return packages.some((packageName) => specifier === packageName || specifier.startsWith(`${packageName}/`));
}
