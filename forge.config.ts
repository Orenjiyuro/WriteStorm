import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { findCodexProductRuntimePackage } from './config/codex-product-runtime-package';

const electronChecksums = require('electron/checksums.json') as Record<string, string>;
const asarUnpackPattern = '**/*.node';

export function createForgeConfig(
  platform: NodeJS.Platform,
  architecture: string,
): ForgeConfig {
  const codexRuntime = findCodexProductRuntimePackage(platform, architecture);
  const allowedPackageRuntimePaths = [
    '/.vite',
    '/package.json',
    '/node_modules/better-sqlite3',
    '/node_modules/bindings',
    '/node_modules/file-uri-to-path',
    ...(codexRuntime?.allowedPaths ?? []),
  ] as const;
  const shouldKeepPackagedPath = (filePath: string): boolean => {
    const normalizedPath = filePath.replaceAll('\\', '/');
    return allowedPackageRuntimePaths.some((allowedPath) => (
      normalizedPath === allowedPath
      || normalizedPath.startsWith(`${allowedPath}/`)
      || allowedPath.startsWith(`${normalizedPath}/`)
    ));
  };
  const build = [
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
      target: 'main' as const,
    },
    {
      entry: 'src/main/structure/worker/structure-worker-entry.ts',
      config: 'vite.structure-worker.config.ts',
      target: 'main' as const,
    },
    ...(codexRuntime
      ? [{
        entry: 'src/main/ai/providers/codex/codex-utility-entry.ts',
        config: 'vite.codex-utility.config.ts',
        target: 'main' as const,
      }]
      : []),
  ];

  return {
    packagerConfig: {
      asar: codexRuntime
        ? {
          unpack: asarUnpackPattern,
          unpackDir: codexRuntime.unpackDirectory,
        }
        : {
          unpack: asarUnpackPattern,
        },
      download: {
        checksums: electronChecksums,
      },
      ignore: (filePath) => {
        if (!filePath) return false;
        return !shouldKeepPackagedPath(filePath);
      },
    },
    rebuildConfig: {},
    makers: [],
    plugins: [
      new VitePlugin({
        build,
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.ts',
          },
        ],
      }),
    ],
  };
}

export default createForgeConfig(process.platform, process.arch);
