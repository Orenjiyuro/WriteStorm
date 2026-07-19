import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';

const electronChecksums = require('electron/checksums.json') as Record<string, string>;

const allowedPackageRuntimePaths = [
  '/.vite',
  '/package.json',
  '/node_modules/better-sqlite3',
  '/node_modules/bindings',
  '/node_modules/file-uri-to-path',
  '/node_modules/@openai/codex-sdk',
  '/node_modules/@openai/codex',
  '/node_modules/@openai/codex-win32-x64',
] as const;

const windowsCodexRuntimeDirectory =
  'node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc';
const asarUnpackPattern = '**/*.node';

function shouldKeepPackagedPath(filePath: string): boolean {
  const normalizedPath = filePath.replaceAll('\\', '/');

  return allowedPackageRuntimePaths.some((allowedPath) => {
    return (
      normalizedPath === allowedPath ||
      normalizedPath.startsWith(`${allowedPath}/`) ||
      allowedPath.startsWith(`${normalizedPath}/`)
    );
  });
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: asarUnpackPattern,
      unpackDir: windowsCodexRuntimeDirectory,
    },
    download: {
      checksums: electronChecksums,
    },
    ignore: (filePath) => {
      if (!filePath) {
        return false;
      }

      return !shouldKeepPackagedPath(filePath);
    },
  },
  rebuildConfig: {},
  makers: [],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/main.ts',
          config: 'vite.main.config.ts',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
        },
        {
          entry: 'src/main/source-text/worker-entry.ts',
          config: 'vite.source-text-worker.config.ts',
          target: 'main',
        },
        {
          entry: 'src/main/structure/worker/structure-worker-entry.ts',
          config: 'vite.structure-worker.config.ts',
          target: 'main',
        },
        {
          entry: 'src/main/codex-feasibility/utility-entry.ts',
          config: 'vite.codex-feasibility.config.ts',
          target: 'main',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
};

export default config;
