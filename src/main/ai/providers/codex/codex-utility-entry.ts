import type { Codex } from '@openai/codex-sdk';

export const CODEX_UTILITY_UNSUPPORTED_MESSAGE_EXIT_CODE = 28 as const;
export const CODEX_UTILITY_INVALID_SDK_EXPORT_EXIT_CODE = 29 as const;

type CodexConstructor = new () => Codex;
let codexConstructor: CodexConstructor | undefined;

export function createCodexSdkClient(): Codex {
  if (!codexConstructor) {
    throw new Error('Codex SDK runtime is not initialized.');
  }
  return new codexConstructor();
}

async function initializeCodexUtility(): Promise<void> {
  // The SDK root is import-only. A preserved dynamic import keeps the Forge
  // CJS utility compatible without constructing a client or starting a turn.
  const sdk = await import('@openai/codex-sdk');
  if (typeof sdk.Codex !== 'function') {
    process.exit(CODEX_UTILITY_INVALID_SDK_EXPORT_EXIT_CODE);
    return;
  }
  codexConstructor = sdk.Codex;

  const parentPort = process.parentPort;
  if (parentPort) {
    parentPort.on('message', () => {
      process.exit(CODEX_UTILITY_UNSUPPORTED_MESSAGE_EXIT_CODE);
    });
  }
}

void initializeCodexUtility().catch(() => {
  process.exit(CODEX_UTILITY_INVALID_SDK_EXPORT_EXIT_CODE);
});
