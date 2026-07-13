import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { MessageEvent as ElectronMessageEvent } from 'electron';
import { readSourceTextBytes } from './source-text-bytes';
import { decodeSourceTextBytes } from './source-text-encoding';
import {
  SOURCE_TEXT_WORKER_PROTOCOL_VERSION,
  isSourceTextWorkerRequest,
  type PrepareSourceImportInput,
  type SourceTextWorkerErrorCode,
  type SourceTextWorkerResponse,
} from './worker-protocol';

type PrepareSourceImportOutcome =
  | { readonly ok: true; readonly result: Extract<SourceTextWorkerResponse, { ok: true; command: 'prepare-import' }>['result'] }
  | { readonly ok: false; readonly error: { readonly code: SourceTextWorkerErrorCode; readonly message: string } };

export function prepareSourceImport(input: PrepareSourceImportInput): PrepareSourceImportOutcome {
  const bytesResult = readSourceTextBytes(input.sourcePath, { maxSizeBytes: input.maxSizeBytes });
  if (!bytesResult.ok) {
    const codeByReason = {
      file_too_large: 'SOURCE_FILE_TOO_LARGE',
      empty_file: 'SOURCE_FILE_EMPTY',
      not_readable: 'SOURCE_FILE_NOT_READABLE',
    } as const;
    return failure(codeByReason[bytesResult.reason], bytesResult.message);
  }

  const decoded = decodeSourceTextBytes(bytesResult.bytes, { encodingOverride: input.encoding });
  if (!decoded.ok) {
    return failure(
      'SOURCE_TEXT_ENCODING_REQUIRED',
      'Source text encoding requires explicit selection.',
    );
  }

  const stagingRelativePath = `source/.staging/${input.jobId}.tmp`;
  const stagingPath = path.join(input.libraryRootPath, ...stagingRelativePath.split('/'));
  try {
    mkdirSync(path.dirname(stagingPath), { recursive: true });
    writeFileSync(stagingPath, bytesResult.bytes, { flag: 'wx' });
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      return failure('SOURCE_STAGING_CONFLICT', 'Source staging target already exists.');
    }
    rmSync(stagingPath, { force: true });
    return failure('SOURCE_STAGING_WRITE_FAILED', 'Source staging file could not be written.');
  }

  return {
    ok: true,
    result: {
      stagingRelativePath,
      sizeBytes: bytesResult.bytes.byteLength,
      contentHash: `sha256:${createHash('sha256').update(bytesResult.bytes).digest('hex')}`,
      encoding: decoded.encoding,
    },
  };
}

function failure(code: SourceTextWorkerErrorCode, message: string): PrepareSourceImportOutcome {
  return { ok: false, error: { code, message } };
}

function isAlreadyExistsError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST';
}

const parentPort = process.parentPort;
if (parentPort) {
  parentPort.on('message', (event: ElectronMessageEvent) => {
    const request = event.data;
    if (!isSourceTextWorkerRequest(request)) {
      process.exit(28);
      return;
    }

    if (request.command === 'cancel') {
      parentPort.postMessage({
        version: SOURCE_TEXT_WORKER_PROTOCOL_VERSION,
        requestId: request.requestId,
        command: 'cancel',
        ok: true,
        workerPid: process.pid,
        cancelledRequestId: request.targetRequestId,
      } satisfies SourceTextWorkerResponse);
      return;
    }

    const outcome = prepareSourceImport(request.input);
    parentPort.postMessage({
      version: SOURCE_TEXT_WORKER_PROTOCOL_VERSION,
      requestId: request.requestId,
      command: 'prepare-import',
      workerPid: process.pid,
      ...outcome,
    } satisfies SourceTextWorkerResponse);
  });
}
