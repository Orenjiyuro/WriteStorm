import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';

const electronChecksums = require('electron/checksums.json') as Record<string, string>;

const allowedCertificationRuntimePaths = [
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

function shouldKeepCertificationPath(filePath: string): boolean {
  const normalizedPath = filePath.replaceAll('\\', '/');

  return allowedCertificationRuntimePaths.some((allowedPath) => {
    return normalizedPath === allowedPath
      || normalizedPath.startsWith(`${allowedPath}/`)
      || allowedPath.startsWith(`${normalizedPath}/`);
  });
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: '**/*.node',
      unpackDir: windowsCodexRuntimeDirectory,
    },
    download: { checksums: electronChecksums },
    ignore: (filePath) => {
      if (!filePath) return false;
      return !shouldKeepCertificationPath(filePath);
    },
  },
  rebuildConfig: {},
  makers: [],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/codex-feasibility/certification-main.ts',
          config: 'vite.block6a-certification-main.config.ts',
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
