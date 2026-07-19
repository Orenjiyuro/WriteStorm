import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import {
  CodexFeasibilityRunner,
  CodexFeasibilityRunnerError,
  type CodexFeasibilityUtilityHandle,
  type ForkCodexFeasibilityUtility,
} from '../../src/main/codex-feasibility/runner';
import type { CodexFeasibilityRequest } from '../../src/main/codex-feasibility/protocol';

class FakeCodexUtility extends EventEmitter implements CodexFeasibilityUtilityHandle {
  private currentPid: number | undefined = 64004;
  readonly requests: CodexFeasibilityRequest[] = [];
  killCalls = 0;

  get pid(): number | undefined {
    return this.currentPid;
  }

  clearPidAfterExit(): void {
    this.currentPid = undefined;
  }

  constructor(
    private readonly respond: (
      request: CodexFeasibilityRequest,
      process: FakeCodexUtility,
    ) => void,
  ) {
    super();
    queueMicrotask(() => this.emit('spawn'));
  }

  postMessage(message: unknown): void {
    const request = message as CodexFeasibilityRequest;
    this.requests.push(request);
    this.respond(request, this);
  }

  kill(): boolean {
    this.killCalls += 1;
    return true;
  }
}

function createFork(
  respond: (request: CodexFeasibilityRequest, process: FakeCodexUtility) => void,
): { fork: ForkCodexFeasibilityUtility; processes: FakeCodexUtility[] } {
  const processes: FakeCodexUtility[] = [];
  return {
    processes,
    fork: () => {
      const process = new FakeCodexUtility(respond);
      processes.push(process);
      return process;
    },
  };
}

describe('Block 6A.4 Codex feasibility utility runner', () => {
  it('uses a typed inspect then shutdown exchange and waits for graceful utility exit', async () => {
    const fake = createFork((request, process) => {
      if (request.command === 'inspect-runtime') {
        queueMicrotask(() => process.emit('message', {
          version: 1,
          requestId: request.requestId,
          command: 'inspect-runtime',
          ok: true,
          utilityPid: process.pid,
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
        }));
        return;
      }

      queueMicrotask(() => {
        process.emit('message', {
          version: 1,
          requestId: request.requestId,
          command: 'shutdown',
          ok: true,
          utilityPid: process.pid,
          cleanupAcknowledged: true,
        });
        process.emit('exit', 0);
      });
    });
    const runner = new CodexFeasibilityRunner({
      modulePath: 'codex-feasibility-entry.js',
      fork: fake.fork,
      createRequestId: (() => {
        let sequence = 0;
        return () => `request-${++sequence}`;
      })(),
    });

    await expect(runner.inspectRuntime(1_000)).resolves.toMatchObject({
      utilityPid: 64004,
      cleanupAcknowledged: true,
      result: {
        sdkVersion: '0.144.6',
        projectLocalCliResolved: true,
      },
    });
    expect(fake.processes[0]?.requests.map((request) => request.command)).toEqual([
      'inspect-runtime',
      'shutdown',
    ]);
    expect(fake.processes[0]?.killCalls).toBe(0);
  });

  it('maps utility failures to a stable classification without forwarding raw error text', async () => {
    const fake = createFork((request, process) => {
      if (request.command === 'inspect-runtime') {
        queueMicrotask(() => process.emit('message', {
          version: 1,
          requestId: request.requestId,
          command: 'inspect-runtime',
          ok: false,
          utilityPid: process.pid,
          error: { code: 'SDK_IMPORT_FAILED' },
        }));
        return;
      }

      queueMicrotask(() => {
        process.emit('message', {
          version: 1,
          requestId: request.requestId,
          command: 'shutdown',
          ok: true,
          utilityPid: process.pid,
          cleanupAcknowledged: true,
        });
        process.emit('exit', 0);
      });
    });
    const runner = new CodexFeasibilityRunner({
      modulePath: 'codex-feasibility-entry.js',
      fork: fake.fork,
      createRequestId: (() => {
        let sequence = 0;
        return () => `failure-${++sequence}`;
      })(),
    });

    const error = await runner.inspectRuntime(1_000).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(CodexFeasibilityRunnerError);
    expect(error).toMatchObject({
      reason: 'inspection_failed',
      utilityErrorCode: 'SDK_IMPORT_FAILED',
      message: 'Codex feasibility utility could not inspect the installed runtime.',
    });
    expect(String(error)).not.toContain('stderr');
    expect(fake.processes[0]?.killCalls).toBe(0);
  });

  it('passes cwd and an explicit utility environment without putting prompt text in the protocol', async () => {
    let forkOptions: Parameters<ForkCodexFeasibilityUtility>[2] | undefined;
    const processes: FakeCodexUtility[] = [];
    const fork: ForkCodexFeasibilityUtility = (_modulePath, _args, options) => {
      forkOptions = options;
      const process = new FakeCodexUtility((request, child) => {
        if (request.command === 'run-capability-probe') {
          queueMicrotask(() => child.emit('message', {
            version: 1,
            requestId: request.requestId,
            command: 'run-capability-probe',
            ok: true,
            utilityPid: child.pid,
            result: {
              scenario: request.input.scenario,
              outcome: 'login_required',
              authClassification: 'login_required',
              utilityCwdMatchedExpected: true,
              explicitWorkingDirectoryRequested: false,
              skipGitRepoCheck: false,
              envPolicy: 'explicit_allowlist_no_api_credentials',
              finalResponseMatched: null,
            },
          }));
          return;
        }
        queueMicrotask(() => {
          child.emit('message', {
            version: 1,
            requestId: request.requestId,
            command: 'shutdown',
            ok: true,
            utilityPid: child.pid,
            cleanupAcknowledged: true,
          });
          child.emit('exit', 0);
        });
      });
      processes.push(process);
      return process;
    };
    const runner = new CodexFeasibilityRunner({
      modulePath: 'codex-feasibility-entry.js',
      fork,
      createRequestId: (() => {
        let sequence = 0;
        return () => `capability-${++sequence}`;
      })(),
    });
    const input = {
      scenario: 'default-git-isolated-auth',
      expectedUtilityWorkingDirectory: 'C:\\probe\\default-git',
      skipGitRepoCheck: false,
      authMode: 'isolated-empty' as const,
      isolatedCodexHome: 'C:\\probe\\codex-home-empty',
    } as const;

    await expect(runner.runCapabilityProbe(input, 1_000, {
      utilityWorkingDirectory: input.expectedUtilityWorkingDirectory,
      utilityEnvironment: {
        WRITESTORM_CODEX_SYNTHETIC_INPUT: 'test-only-placeholder',
        WRITESTORM_CODEX_SYNTHETIC_EXPECTED: 'test-only-placeholder',
      },
    })).resolves.toMatchObject({
      utilityPid: 64004,
      cleanupAcknowledged: true,
      result: { outcome: 'login_required' },
    });
    expect(forkOptions).toMatchObject({
      cwd: 'C:\\probe\\default-git',
      env: expect.objectContaining({
        WRITESTORM_CODEX_SYNTHETIC_INPUT: 'test-only-placeholder',
      }),
    });
    expect(processes[0]?.requests[0]).not.toHaveProperty('prompt');
  });

  it('reduces invalid utility messages to field-presence diagnostics without retaining values', async () => {
    const fake = createFork((_request, process) => {
      queueMicrotask(() => process.emit('message', {
        version: 1,
        requestId: 'unexpected-request',
        command: 'run-capability-probe',
        ok: true,
        utilityPid: process.pid,
        result: { outcome: 'secret-bearing-invalid-value' },
      }));
    });
    const runner = new CodexFeasibilityRunner({
      modulePath: 'codex-feasibility-entry.js',
      fork: fake.fork,
      createRequestId: () => 'expected-request',
    });
    const error = await runner.runCapabilityProbe({
      scenario: 'default-git-isolated-auth',
      expectedUtilityWorkingDirectory: 'C:\\probe\\default-git',
      skipGitRepoCheck: false,
      authMode: 'isolated-empty',
      isolatedCodexHome: 'C:\\probe\\codex-home-empty',
    }, 1_000, {
      utilityWorkingDirectory: 'C:\\probe\\default-git',
      utilityEnvironment: {},
    }).catch((value: unknown) => value);

    expect(error).toBeInstanceOf(CodexFeasibilityRunnerError);
    if (!(error instanceof CodexFeasibilityRunnerError)) {
      throw new Error('Expected a CodexFeasibilityRunnerError.');
    }
    expect(error).toMatchObject({
      reason: 'protocol',
      protocolDiagnostic: {
        phase: 'capability',
        valueKind: 'object',
        hasDataEnvelope: false,
        versionRecognized: true,
        commandRecognized: true,
        requestIdPresent: true,
        utilityPidValid: true,
      },
    });
    expect(JSON.stringify(error.protocolDiagnostic)).not.toContain('secret-bearing-invalid-value');
  });

  it('uses the validated response PID when Electron clears child.pid on exit', async () => {
    const fake = createFork((request, process) => {
      if (request.command === 'run-capability-probe') {
        queueMicrotask(() => process.emit('message', {
          version: 1,
          requestId: request.requestId,
          command: 'run-capability-probe',
          ok: true,
          utilityPid: process.pid,
          result: {
            scenario: request.input.scenario,
            outcome: 'login_required',
            authClassification: 'login_required',
            utilityCwdMatchedExpected: true,
            explicitWorkingDirectoryRequested: false,
            skipGitRepoCheck: false,
            envPolicy: 'explicit_allowlist_no_api_credentials',
            finalResponseMatched: null,
          },
        }));
        return;
      }
      queueMicrotask(() => {
        process.emit('message', {
          version: 1,
          requestId: request.requestId,
          command: 'shutdown',
          ok: true,
          utilityPid: process.pid,
          cleanupAcknowledged: true,
        });
        process.clearPidAfterExit();
        process.emit('exit', 0);
      });
    });
    const runner = new CodexFeasibilityRunner({
      modulePath: 'codex-feasibility-entry.js',
      fork: fake.fork,
      createRequestId: (() => {
        let sequence = 0;
        return () => `pid-lifecycle-${++sequence}`;
      })(),
    });

    await expect(runner.runCapabilityProbe({
      scenario: 'default-git-isolated-auth',
      expectedUtilityWorkingDirectory: 'C:\\probe\\default-git',
      skipGitRepoCheck: false,
      authMode: 'isolated-empty',
      isolatedCodexHome: 'C:\\probe\\codex-home-empty',
    }, 1_000, {
      utilityWorkingDirectory: 'C:\\probe\\default-git',
      utilityEnvironment: {},
    })).resolves.toMatchObject({ utilityPid: 64004, cleanupAcknowledged: true });
  });

  it('runs the closed output-schema scenario and then shuts down without schema injection', async () => {
    const fake = createFork((request, process) => {
      if (request.command === 'run-output-schema-probe') {
        queueMicrotask(() => process.emit('message', {
          version: 1,
          requestId: request.requestId,
          command: 'run-output-schema-probe',
          ok: true,
          utilityPid: process.pid,
          result: {
            scenario: request.input.scenario,
            outcome: 'success',
            authClassification: 'authenticated',
            finalJsonParsed: true,
            strictValidatorAccepted: true,
            expectedValueMatched: true,
            invalidSchemaRejectedBySdk: false,
          },
        }));
        return;
      }
      queueMicrotask(() => {
        process.emit('message', {
          version: 1,
          requestId: request.requestId,
          command: 'shutdown',
          ok: true,
          utilityPid: process.pid,
          cleanupAcknowledged: true,
        });
        process.emit('exit', 0);
      });
    });
    const runner = new CodexFeasibilityRunner({
      modulePath: 'codex-feasibility-entry.js',
      fork: fake.fork,
      createRequestId: (() => {
        let sequence = 0;
        return () => `output-schema-${++sequence}`;
      })(),
    });

    await expect(runner.runOutputSchemaProbe({
      scenario: 'valid-minimal',
      workingDirectory: 'C:\\probe\\git',
    }, 1_000, {
      utilityWorkingDirectory: 'C:\\probe\\git',
      utilityEnvironment: {},
    })).resolves.toMatchObject({
      cleanupAcknowledged: true,
      result: { outcome: 'success', strictValidatorAccepted: true },
    });
    expect(fake.processes[0]?.requests.map((request) => request.command)).toEqual([
      'run-output-schema-probe',
      'shutdown',
    ]);
    expect(fake.processes[0]?.requests[0]).not.toHaveProperty('input.outputSchema');
  });
});
