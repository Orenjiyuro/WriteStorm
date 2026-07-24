import type { Codex } from '@openai/codex-sdk';
import { resolvePackagedCodexExecutablePath } from './codex-product-runtime-path';
import { CodexProductProbeUtilityHost } from './codex-product-probe-utility-host';
import {
  CodexUtilityLifecycleHost,
  CODEX_UTILITY_UNSUPPORTED_MESSAGE_EXIT_CODE,
} from './codex-utility-lifecycle-host';
import { CodexConnectionCheckUtilityHost } from './codex-connection-check-utility-host';

export { CODEX_UTILITY_UNSUPPORTED_MESSAGE_EXIT_CODE };
export const CODEX_UTILITY_INVALID_SDK_EXPORT_EXIT_CODE = 29 as const;

type CodexConstructor = new (options?: {
  readonly codexPathOverride?: string;
}) => Codex;
let codexConstructor: CodexConstructor | undefined;

export function createCodexSdkClient(): Codex {
  if (!codexConstructor) {
    throw new Error('Codex SDK runtime is not initialized.');
  }
  return new codexConstructor({
    codexPathOverride: resolvePackagedCodexExecutablePath(process.resourcesPath),
  });
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
    const productProbe = new CodexProductProbeUtilityHost({
      createClient: createCodexSdkClient,
      lifecycle,
      postMessage: (message) => parentPort.postMessage(message),
    });
    const connectionCheck = new CodexConnectionCheckUtilityHost({
      createClient: createCodexSdkClient,
      lifecycle,
      postMessage: (message) => parentPort.postMessage(message),
    });
    parentPort.on('message', (event: ElectronUtilityMessageEvent) => {
      try {
        if (connectionCheck.accepts(event.data)) {
          connectionCheck.accept(event.data);
          return;
        }
        if (productProbe.accepts(event.data)) {
          productProbe.accept(event.data);
          return;
        }
        void lifecycle.accept(event.data);
      } catch {
        process.exit(CODEX_UTILITY_UNSUPPORTED_MESSAGE_EXIT_CODE);
      }
    });
  }
}

void initializeCodexUtility().catch(() => {
  process.exit(CODEX_UTILITY_INVALID_SDK_EXPORT_EXIT_CODE);
});
