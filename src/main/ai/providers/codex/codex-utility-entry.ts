import type { Codex } from '@openai/codex-sdk';
import {
  CodexUtilityLifecycleHost,
  CODEX_UTILITY_UNSUPPORTED_MESSAGE_EXIT_CODE,
} from './codex-utility-lifecycle-host';

export { CODEX_UTILITY_UNSUPPORTED_MESSAGE_EXIT_CODE };
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
    type ElectronUtilityMessageEvent = { readonly data: unknown };
    const lifecycle = new CodexUtilityLifecycleHost({
      postMessage: (message) => parentPort.postMessage(message),
      scheduleExit: (code) => {
        setImmediate(() => process.exit(code));
      },
    });
    parentPort.on('message', (event: ElectronUtilityMessageEvent) => {
      void lifecycle.accept(event.data);
    });
  }
}

void initializeCodexUtility().catch(() => {
  process.exit(CODEX_UTILITY_INVALID_SDK_EXPORT_EXIT_CODE);
});
