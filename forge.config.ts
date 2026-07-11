import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';

const electronChecksums = require('electron/checksums.json') as Record<string, string>;

const allowedPackageRuntimePaths = [
  '/.vite',
  '/package.json',
  '/node_modules/better-sqlite3',
  '/node_modules/bindings',
  '/node_modules/file-uri-to-path',
] as const;

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
      unpack: '**/*.node',
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
          entry: 'src/main/structure/worker/structure-worker-entry.ts',
          config: 'vite.structure-worker.config.ts',
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
