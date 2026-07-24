import path from 'node:path';

const CODEX_WINDOWS_PLATFORM_PACKAGE = '@openai/codex-win32-x64';
const CODEX_WINDOWS_EXECUTABLE_RELATIVE_PATH =
  'vendor/x86_64-pc-windows-msvc/bin/codex.exe';

export function resolvePackagedCodexExecutablePath(resourcesPath: string): string {
  if (!path.isAbsolute(resourcesPath)) {
    throw new Error('Electron resources path must be absolute.');
  }
  return path.join(
    resourcesPath,
    'app.asar.unpacked',
    'node_modules',
    CODEX_WINDOWS_PLATFORM_PACKAGE,
    CODEX_WINDOWS_EXECUTABLE_RELATIVE_PATH,
  );
}
