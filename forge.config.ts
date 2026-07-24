import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { resolveCodexProductRuntimePackage } from './config/codex-product-runtime-package';

const electronChecksums = require('electron/checksums.json') as Record<string, string>;
const codexRuntime = resolveCodexProductRuntimePackage(process.platform, process.arch);

const allowedPackageRuntimePaths = [
  '/.vite',
  '/package.json',
  '/node_modules/better-sqlite3',
  '/node_modules/bindings',
  '/node_modules/file-uri-to-path',
  ...codexRuntime.allowedPaths,
] as const;

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
      unpackDir: codexRuntime.unpackDirectory,
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
          entry: 'src/main/ai/providers/codex/codex-utility-entry.ts',
          config: 'vite.codex-utility.config.ts',
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
