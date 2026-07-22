import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CODEX_FEASIBILITY_OPERATIONS } from '../../src/main/codex-feasibility/operations';
import {
  CodexFeasibilitySessionStateError,
  CodexFeasibilitySessionSupervisor,
} from '../../src/main/codex-feasibility/session-supervisor';
import type { CodexFeasibilityResponse } from '../../src/main/codex-feasibility/protocol';
import { BLOCK6A_FEASIBILITY_MANIFEST } from '../../src/main/codex-feasibility/manifest';

const rootDir = path.resolve(__dirname, '../..');

const inspectionResponse: CodexFeasibilityResponse = {
  version: 1,
  requestId: 'inspect-1',
  command: 'inspect-runtime',
  ok: true,
  utilityPid: 71,
  result: {
    sdkVersion: BLOCK6A_FEASIBILITY_MANIFEST.versions.codexSdk,
    cliVersion: BLOCK6A_FEASIBILITY_MANIFEST.versions.codexCli,
    platformPackageVersion: BLOCK6A_FEASIBILITY_MANIFEST.versions.platformPackage,
    nodeRuntime: '24.17.0',
    platform: 'win32',
    architecture: 'x64',
    sdkImported: true,
    sdkClientConstructed: true,
    projectLocalCliResolved: true,
  },
};

function shutdownResponse(requestId: string, utilityPid = 71): CodexFeasibilityResponse {
  return {
    version: 1,
    requestId,
    command: 'shutdown',
    ok: true,
    utilityPid,
    cleanupAcknowledged: true,
  };
}

describe('Block 6A remediation R3b session supervisor', () => {
  it('binds the spawned utility PID before accepting the first response', () => {
    const session = new CodexFeasibilitySessionSupervisor();
    session.bindUtilityPid(71);
    session.beginOperation(CODEX_FEASIBILITY_OPERATIONS.inspect, 'inspect-1', {});

    expect(() => session.acceptOperationResponse(
      CODEX_FEASIBILITY_OPERATIONS.inspect,
      'inspect-1',
      { ...inspectionResponse, utilityPid: 999 },
    )).toThrowError(expect.objectContaining({ code: 'UTILITY_PID_MISMATCH' }));
  });

  it('enforces one active operation and exact response ownership', () => {
    const session = new CodexFeasibilitySessionSupervisor();
    const request = session.beginOperation(
      CODEX_FEASIBILITY_OPERATIONS.inspect,
      'inspect-1',
      {},
    );

    expect(request.command).toBe('inspect-runtime');
    expect(session.snapshot()).toMatchObject({
      state: 'operation-active',
      phase: 'inspect',
      operationCount: 1,
      utilityPid: null,
      finalSettlement: null,
    });
    expect(() => session.beginOperation(
      CODEX_FEASIBILITY_OPERATIONS.shutdown,
      'shutdown-too-early',
      {},
    )).toThrowError(expect.objectContaining({ code: 'OPERATION_ALREADY_ACTIVE' }));
    expect(() => session.acceptOperationResponse(
      CODEX_FEASIBILITY_OPERATIONS.inspect,
      'wrong-request-id',
      inspectionResponse,
    )).toThrowError(expect.objectContaining({ code: 'UNEXPECTED_OPERATION_RESPONSE' }));

    const accepted = session.acceptOperationResponse(
      CODEX_FEASIBILITY_OPERATIONS.inspect,
      'inspect-1',
      inspectionResponse,
    );
    expect(accepted).toBe(inspectionResponse);
    expect(session.snapshot()).toMatchObject({
      state: 'operation-settled',
      phase: 'inspect',
      utilityPid: 71,
    });
  });

  it('orders operation, shutdown acknowledgement, exit and one final settlement', () => {
    const session = new CodexFeasibilitySessionSupervisor();
    session.beginOperation(CODEX_FEASIBILITY_OPERATIONS.inspect, 'inspect-1', {});
    session.acceptOperationResponse(
      CODEX_FEASIBILITY_OPERATIONS.inspect,
      'inspect-1',
      inspectionResponse,
    );
    const shutdown = session.beginShutdown('shutdown-1');
    expect(shutdown.command).toBe('shutdown');
    session.acceptShutdownResponse('shutdown-1', shutdownResponse('shutdown-1'));
    session.acceptUtilityExit(0);

    expect(session.complete()).toBe(true);
    expect(session.complete()).toBe(false);
    expect(session.fail()).toBe(false);
    expect(session.snapshot()).toEqual({
      state: 'completed',
      phase: 'shutdown',
      operationCount: 1,
      utilityPid: 71,
      cleanupAcknowledged: true,
      utilityExitObserved: true,
      finalSettlement: 'completed',
    });
  });

  it('requires explicit lifecycle continuation and rejects a different utility PID', () => {
    const session = new CodexFeasibilitySessionSupervisor();
    session.beginOperation(CODEX_FEASIBILITY_OPERATIONS.startLifecycle, 'start-1', {
      input: {
        scenario: 'explicit-cancel',
        workingDirectory: 'C:\\probe\\git',
      },
    });
    const startResponse: CodexFeasibilityResponse = {
      version: 1,
      requestId: 'start-1',
      command: 'start-lifecycle-probe',
      ok: true,
      utilityPid: 72,
      result: { scenario: 'explicit-cancel', turnStarted: true },
    };
    session.acceptOperationResponse(
      CODEX_FEASIBILITY_OPERATIONS.startLifecycle,
      'start-1',
      startResponse,
    );
    session.awaitContinuation('await-trigger');
    expect(session.snapshot()).toMatchObject({ state: 'awaiting-continuation' });
    session.beginOperation(CODEX_FEASIBILITY_OPERATIONS.cancelLifecycle, 'cancel-1', {
      trigger: 'explicit-cancel',
    });

    expect(() => session.acceptOperationResponse(
      CODEX_FEASIBILITY_OPERATIONS.cancelLifecycle,
      'cancel-1',
      {
        version: 1,
        requestId: 'cancel-1',
        command: 'cancel-lifecycle-probe',
        ok: false,
        utilityPid: 999,
        error: { code: 'LIFECYCLE_NOT_ACTIVE' },
      },
    )).toThrowError(expect.objectContaining({ code: 'UTILITY_PID_MISMATCH' }));
  });

  it('fails once with closed state errors and never retains response payloads', () => {
    const session = new CodexFeasibilitySessionSupervisor();
    expect(session.fail()).toBe(true);
    expect(session.fail()).toBe(false);
    expect(() => session.beginOperation(
      CODEX_FEASIBILITY_OPERATIONS.inspect,
      'after-failure',
      {},
    )).toThrow(CodexFeasibilitySessionStateError);
    expect(session.snapshot()).toEqual({
      state: 'failed',
      phase: null,
      operationCount: 0,
      utilityPid: null,
      cleanupAcknowledged: false,
      utilityExitObserved: false,
      finalSettlement: 'failed',
    });
  });

  it('replaces per-method settled and phase state without absorbing termination policy', () => {
    const source = readFileSync(
      path.join(rootDir, 'src/main/codex-feasibility/runner.ts'),
      'utf8',
    );
    expect(source).toContain('CodexFeasibilitySessionSupervisor');
    expect(source.match(/new CodexFeasibilitySessionSupervisor/g)).toHaveLength(1);
    expect(source).not.toContain('let settled = false');
    expect(source).not.toMatch(/let phase:\s*'/);
    expect(source).toContain('CodexFeasibilityTerminationSupervisor');
  });
});
