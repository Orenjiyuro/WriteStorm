import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CODEX_FEASIBILITY_OPERATIONS,
  createCodexFeasibilityOperationRequest,
  isCodexFeasibilityOperationResponse,
} from '../../src/main/codex-feasibility/operations';
import {
  isCodexFeasibilityRequest,
  isCodexFeasibilityResponse,
} from '../../src/main/codex-feasibility/protocol';

const rootDir = path.resolve(__dirname, '../..');

describe('Block 6A remediation R3a operation descriptor', () => {
  it('freezes every wire operation, payload and failure classification', () => {
    expect(CODEX_FEASIBILITY_OPERATIONS).toEqual({
      inspect: {
        operation: 'inspect',
        command: 'inspect-runtime',
        phase: 'inspect',
        payloadKeys: [],
        failureReason: 'inspection_failed',
      },
      capability: {
        operation: 'capability',
        command: 'run-capability-probe',
        phase: 'capability',
        payloadKeys: ['input'],
        failureReason: 'capability_failed',
      },
      outputSchema: {
        operation: 'output-schema',
        command: 'run-output-schema-probe',
        phase: 'output-schema',
        payloadKeys: ['input'],
        failureReason: 'output_schema_failed',
      },
      startLifecycle: {
        operation: 'start-lifecycle',
        command: 'start-lifecycle-probe',
        phase: 'start-lifecycle',
        payloadKeys: ['input'],
        failureReason: 'lifecycle_failed',
      },
      cancelLifecycle: {
        operation: 'cancel-lifecycle',
        command: 'cancel-lifecycle-probe',
        phase: 'cancel-lifecycle',
        payloadKeys: ['trigger'],
        failureReason: 'lifecycle_failed',
      },
      cancelActive: {
        operation: 'cancel-active',
        command: 'cancel-active-probe',
        phase: 'cancel-active',
        payloadKeys: [],
        failureReason: null,
      },
      shutdown: {
        operation: 'shutdown',
        command: 'shutdown',
        phase: 'shutdown',
        payloadKeys: [],
        failureReason: null,
      },
    });
  });

  it('builds only strict versioned requests from descriptor-owned commands', () => {
    const inspect = createCodexFeasibilityOperationRequest(
      CODEX_FEASIBILITY_OPERATIONS.inspect,
      'inspect-1',
      {},
    );
    const capability = createCodexFeasibilityOperationRequest(
      CODEX_FEASIBILITY_OPERATIONS.capability,
      'capability-1',
      {
        input: {
          scenario: 'current-auth-explicit-git',
          expectedUtilityWorkingDirectory: 'C:\\probe\\utility',
          workingDirectory: 'C:\\probe\\workspace',
          skipGitRepoCheck: false,
          authMode: 'current',
        },
      },
    );

    expect(inspect).toEqual({
      version: 1,
      origin: 'main',
      requestId: 'inspect-1',
      command: 'inspect-runtime',
    });
    expect(isCodexFeasibilityRequest(inspect)).toBe(true);
    expect(isCodexFeasibilityRequest(capability)).toBe(true);
    expect(() => createCodexFeasibilityOperationRequest(
      CODEX_FEASIBILITY_OPERATIONS.inspect,
      'inspect-extra',
      { producerInventedField: true } as never,
    )).toThrow('Invalid Codex feasibility operation request');
  });

  it('matches a response only when both descriptor command and requestId agree', () => {
    const response = {
      version: 1,
      requestId: 'inspect-1',
      command: 'inspect-runtime',
      ok: true,
      utilityPid: 7,
      result: {
        sdkVersion: '0.144.6',
        cliVersion: '0.144.6',
        platformPackageVersion: '0.144.6-win32-x64',
        nodeRuntime: '24.17.0',
        platform: 'win32',
        architecture: 'x64',
        sdkImported: true,
        sdkClientConstructed: true,
        projectLocalCliResolved: true,
      },
    };
    expect(isCodexFeasibilityResponse(response)).toBe(true);
    if (!isCodexFeasibilityResponse(response)) return;

    expect(isCodexFeasibilityOperationResponse(
      CODEX_FEASIBILITY_OPERATIONS.inspect,
      'inspect-1',
      response,
    )).toBe(true);
    expect(isCodexFeasibilityOperationResponse(
      CODEX_FEASIBILITY_OPERATIONS.inspect,
      'wrong-request',
      response,
    )).toBe(false);
    expect(isCodexFeasibilityOperationResponse(
      CODEX_FEASIBILITY_OPERATIONS.shutdown,
      'inspect-1',
      response,
    )).toBe(false);
  });

  it('keeps the runner on descriptors without changing supervision ownership', () => {
    const source = readFileSync(
      path.join(rootDir, 'src/main/codex-feasibility/runner.ts'),
      'utf8',
    );
    const utilitySource = readFileSync(
      path.join(rootDir, 'src/main/codex-feasibility/utility-entry.ts'),
      'utf8',
    );
    expect(source).toContain('CODEX_FEASIBILITY_OPERATIONS');
    expect(utilitySource).toContain('CODEX_FEASIBILITY_OPERATIONS');
    expect(source).toContain('CodexFeasibilityTerminationSupervisor');
    expect(source).not.toMatch(/command:\s*'(?:inspect-runtime|run-capability-probe|run-output-schema-probe|start-lifecycle-probe|cancel-lifecycle-probe|cancel-active-probe|shutdown)'/);
  });
});
