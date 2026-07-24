export type CodexProductRuntimePackage = {
  readonly packageName: string;
  readonly allowedPaths: readonly string[];
  readonly unpackDirectory: string;
  readonly executableRelativePath: string;
};

const PRODUCT_RUNTIME_PACKAGES = Object.freeze({
  'win32-x64': {
    packageName: '@openai/codex-win32-x64',
    allowedPaths: [
      '/node_modules/@openai/codex-sdk',
      '/node_modules/@openai/codex',
      '/node_modules/@openai/codex-win32-x64',
    ],
    unpackDirectory:
      'node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc',
    executableRelativePath:
      'vendor/x86_64-pc-windows-msvc/bin/codex.exe',
  },
} satisfies Readonly<Record<string, CodexProductRuntimePackage>>);

export function resolveCodexProductRuntimePackage(
  platform: NodeJS.Platform,
  architecture: string,
): CodexProductRuntimePackage {
  const key = `${platform}-${architecture}` as keyof typeof PRODUCT_RUNTIME_PACKAGES;
  const runtimePackage = PRODUCT_RUNTIME_PACKAGES[key];
  if (!runtimePackage) {
    throw new Error(`Unsupported Codex product runtime target: ${platform}-${architecture}`);
  }
  return runtimePackage;
}
