import { Codex } from '@openai/codex-sdk';

export const CODEX_UTILITY_UNSUPPORTED_MESSAGE_EXIT_CODE = 28 as const;
export const CODEX_UTILITY_INVALID_SDK_EXPORT_EXIT_CODE = 29 as const;

// This shape-only guard keeps the external SDK import in the utility bundle
// without constructing a client, reading configuration or starting a turn.
if (typeof Codex !== 'function') {
  process.exit(CODEX_UTILITY_INVALID_SDK_EXPORT_EXIT_CODE);
}

export function createCodexSdkClient(): Codex {
  return new Codex();
}

const parentPort = process.parentPort;
if (parentPort) {
  parentPort.on('message', () => {
    process.exit(CODEX_UTILITY_UNSUPPORTED_MESSAGE_EXIT_CODE);
  });
}
