import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CodexFeasibilityRunner,
  CodexFeasibilityRunnerError,
  sendSessionMessage,
  type CodexFeasibilityUtilityHandle,
  type ForkCodexFeasibilityUtility,
} from '../../src/main/codex-feasibility/runner';
import type { CodexFeasibilityRequest } from '../../src/main/codex-feasibility/protocol';
import { BLOCK6A_FEASIBILITY_MANIFEST } from '../../src/main/codex-feasibility/manifest';

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
    queueMicrotask(() => this.emit('exit', 1));
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

function createTerminationOwnership(events: string[] = [], utilityOwned = true) {
  return {
    bindUtility(utilityPid: number) {
      events.push(`bind:${utilityPid}`);
    },
    isUtilityOwnedAndRunning() {
      events.push('ownership-check');
      return utilityOwned;
    },
    async scanResiduals() {
      events.push('residual-scan');
      return {
        ownershipObserved: utilityOwned,
        residualScanCompleted: true,
        utilityResidualAbsent: true,
        cliResidualAbsent: true,
      };
    },
  };
}

describe('Block 6A.4 Codex feasibility utility runner', () => {
  it('centralizes the only utility kill behind ownership proof and forbids process-name termination', () => {
    const rootDir = path.resolve(__dirname, '../..');
    const runnerSource = readFileSync(
      path.join(rootDir, 'src/main/codex-feasibility/runner.ts'),
      'utf8',
    );
    const terminationSource = readFileSync(
      path.join(rootDir, 'src/main/codex-feasibility/termination-supervisor.ts'),
      'utf8',
    );

    expect(runnerSource).not.toMatch(/\.kill\s*\(/);
    expect(runnerSource.match(/child\.postMessage/g)).toHaveLength(1);
    expect(runnerSource.match(/sendSessionMessage\s*\(/g)).toHaveLength(2);
    expect(terminationSource.match(/\.kill\s*\(/g)).toHaveLength(1);
    expect(terminationSource).toContain('isUtilityOwnedAndRunning');
    expect(terminationSource).not.toMatch(/Get-Process.*ProcessName|Stop-Process.*codex/i);
  });

  it('uses one typed utility-session orchestration for every feasibility operation', () => {
    const rootDir = path.resolve(__dirname, '../..');
    const runnerSource = readFileSync(
      path.join(rootDir, 'src/main/codex-feasibility/runner.ts'),
      'utf8',
    );

    expect(runnerSource.match(/new Promise/g)).toHaveLength(1);
    expect(runnerSource.match(/child\.on\('spawn'/g)).toHaveLength(1);
    expect(runnerSource.match(/child\.on\('message'/g)).toHaveLength(1);
    expect(runnerSource.match(/child\.on\('exit'/g)).toHaveLength(1);
    expect(runnerSource).toContain('runSingleOperation');
    expect(runnerSource).toContain('runUtilitySession');
  });

  it.each(['request creation', 'utility transport'] as const)(
    'routes synchronous %s failures into sanitized termination',
    (failurePoint) => {
      let terminationFailure: CodexFeasibilityRunnerError | undefined;
      const sent = sendSessionMessage(
        {
          postMessage: () => {
            if (failurePoint === 'utility transport') {
              throw new Error('sensitive transport detail');
            }
          },
        },
        () => {
          if (failurePoint === 'request creation') {
            throw new Error('sensitive request detail');
          }
          return { version: 1 };
        },
        (error) => {
          terminationFailure = error;
        },
      );

      expect(sent).toBe(false);
      expect(terminationFailure).toBeInstanceOf(CodexFeasibilityRunnerError);
      expect(terminationFailure?.reason).toBe('crash');
      expect(terminationFailure?.message).toBe(
        'Codex feasibility utility exited before graceful cleanup.',
      );
      expect(JSON.stringify(terminationFailure)).not.toMatch(/sensitive|transport detail|request detail/i);
    },
  );

  it('records R4b as static-only remediation and keeps fresh Windows recertification mandatory', () => {
    const rootDir = path.resolve(__dirname, '../..');
    const evidence = JSON.parse(readFileSync(path.join(
      rootDir,
      'docs/engineering/evidence/block6a-remediation-r4b-safe-termination.json',
    ), 'utf8')) as {
      source: string;
      classification: string;
      assertions: Record<string, boolean>;
      limitations: string[];
    };

    expect(evidence.source).toBe('static_manifest');
    expect(evidence.classification).toBe('unified_safe_termination_hardened');
    expect(Object.values(evidence.assertions).every(Boolean)).toBe(true);
    expect(evidence.limitations).toContain(
      'Fresh Windows lifecycle and packaged recertification remains required before the final conditional-Go verdict can be reissued.',
    );
    expect(JSON.stringify(evidence)).not.toMatch(/[A-Z]:\\\\|"(?:pid|path|stdout|stderr)"\s*:/i);
  });
  it('supervises a lifecycle timeout through SDK abort, shutdown, and utility exit before rejecting', async () => {
    const terminationEvents: string[] = [];
    const fake = createFork((request, process) => {
      if (request.command === 'start-lifecycle-probe') {
        queueMicrotask(() => process.emit('message', {
          version: 1,
          requestId: request.requestId,
          command: request.command,
          ok: true,
          utilityPid: process.pid,
          result: { scenario: request.input.scenario, turnStarted: true },
        }));
        return;
      }
      if ((request as { command: string }).command === 'cancel-active-probe') {
        queueMicrotask(() => process.emit('message', {
          version: 1,
          requestId: request.requestId,
          command: 'cancel-active-probe',
          ok: true,
          utilityPid: process.pid,
          abortRequested: true,
          abortObserved: true,
          sdkPromiseSettled: true,
        }));
        return;
      }
      if (request.command === 'shutdown') {
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
      }
    });
    const runner = new CodexFeasibilityRunner({
      modulePath: 'codex-feasibility-entry.js',
      fork: fake.fork,
      createRequestId: (() => {
        let sequence = 0;
        return () => `timeout-${++sequence}`;
      })(),
    });

    const error = await runner.runLifecycleProbe({
      scenario: 'app-timeout',
      workingDirectory: 'C:\\probe\\git',
    }, 5, {
      utilityWorkingDirectory: 'C:\\probe\\git',
      utilityEnvironment: {},
      waitForTrigger: () => new Promise(() => undefined),
      terminationOwnership: createTerminationOwnership(terminationEvents),
    }).catch((value: unknown) => value);

    expect(error).toBeInstanceOf(CodexFeasibilityRunnerError);
    expect(error).toMatchObject({
      reason: 'timeout',
      timeoutCleanup: {
        classification: 'graceful',
        abortRequested: true,
        abortObserved: true,
        sdkPromiseSettled: true,
        cleanupAcknowledged: true,
        utilityExitObserved: true,
        residualScanCompleted: true,
        utilityResidualAbsent: true,
        cliResidualAbsent: true,
      },
    });
    expect(fake.processes[0]?.requests.map((request) => request.command)).toEqual([
      'start-lifecycle-probe',
      'cancel-active-probe',
      'shutdown',
    ]);
    expect(fake.processes[0]?.killCalls).toBe(0);
    expect(terminationEvents).toEqual(['bind:64004', 'residual-scan']);
  });

  it('classifies a non-responsive timeout as forced and still waits for utility exit', async () => {
    const terminationEvents: string[] = [];
    const fake = createFork((request, process) => {
      if (request.command === 'start-lifecycle-probe') {
        queueMicrotask(() => process.emit('message', {
          version: 1,
          requestId: request.requestId,
          command: request.command,
          ok: true,
          utilityPid: process.pid,
          result: { scenario: request.input.scenario, turnStarted: true },
        }));
      }
    });
    const runner = new CodexFeasibilityRunner({
      modulePath: 'codex-feasibility-entry.js',
      fork: fake.fork,
      timeoutGraceMs: 5,
      createRequestId: (() => {
        let sequence = 0;
        return () => `forced-timeout-${++sequence}`;
      })(),
    });

    const error = await runner.runLifecycleProbe({
      scenario: 'app-timeout',
      workingDirectory: 'C:\\probe\\git',
    }, 5, {
      utilityWorkingDirectory: 'C:\\probe\\git',
      utilityEnvironment: {},
      waitForTrigger: () => new Promise(() => undefined),
      terminationOwnership: createTerminationOwnership(terminationEvents),
    }).catch((value: unknown) => value);

    expect(error).toMatchObject({
      reason: 'timeout',
      timeoutCleanup: {
        classification: 'forced',
        abortRequested: false,
        abortObserved: false,
        sdkPromiseSettled: false,
        cleanupAcknowledged: false,
        utilityExitObserved: true,
        utilityKillOwnershipProven: true,
        utilityKillAttempted: true,
        residualScanCompleted: true,
        utilityResidualAbsent: true,
        cliResidualAbsent: true,
      },
    });
    expect(fake.processes[0]?.requests.map((request) => request.command)).toEqual([
      'start-lifecycle-probe',
      'cancel-active-probe',
      'shutdown',
    ]);
    expect(fake.processes[0]?.killCalls).toBe(1);
    expect(terminationEvents).toEqual([
      'bind:64004',
      'ownership-check',
      'residual-scan',
    ]);
  });

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
        sdkVersion: BLOCK6A_FEASIBILITY_MANIFEST.versions.codexSdk,
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
              runtimeFailureOrigin: null,
              safeFailureCode: null,
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
    const terminationEvents: string[] = [];
    const fake = createFork((request, process) => {
      if (request.command === 'run-capability-probe') {
        queueMicrotask(() => process.emit('message', {
          version: 1,
          requestId: 'unexpected-request',
          command: 'run-capability-probe',
          ok: true,
          utilityPid: process.pid,
          result: { outcome: 'secret-bearing-invalid-value' },
        }));
        return;
      }
      if (request.command === 'cancel-active-probe') {
        queueMicrotask(() => process.emit('message', {
          version: 1,
          requestId: request.requestId,
          command: request.command,
          ok: true,
          utilityPid: process.pid,
          abortRequested: true,
          abortObserved: true,
          sdkPromiseSettled: true,
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
      timeoutGraceMs: 5,
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
      terminationOwnership: createTerminationOwnership(terminationEvents),
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
    expect(error.terminationCleanup).toMatchObject({
      classification: 'graceful',
      abortRequested: true,
      sdkPromiseSettled: true,
      cleanupAcknowledged: true,
      utilityExitObserved: true,
      residualScanCompleted: true,
      utilityResidualAbsent: true,
      cliResidualAbsent: true,
    });
    expect(fake.processes[0]?.requests.map((request) => request.command)).toEqual([
      'run-capability-probe',
      'cancel-active-probe',
      'shutdown',
    ]);
    expect(fake.processes[0]?.killCalls).toBe(0);
    expect(terminationEvents).toEqual(['bind:64004', 'residual-scan']);
  });

  it('uses the same supervised cleanup when waitForTrigger rejects', async () => {
    const terminationEvents: string[] = [];
    const fake = createFork((request, process) => {
      if (request.command === 'start-lifecycle-probe') {
        queueMicrotask(() => process.emit('message', {
          version: 1,
          requestId: request.requestId,
          command: request.command,
          ok: true,
          utilityPid: process.pid,
          result: { scenario: request.input.scenario, turnStarted: true },
        }));
        return;
      }
      if (request.command === 'cancel-active-probe') {
        queueMicrotask(() => process.emit('message', {
          version: 1,
          requestId: request.requestId,
          command: request.command,
          ok: true,
          utilityPid: process.pid,
          abortRequested: true,
          abortObserved: true,
          sdkPromiseSettled: true,
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
      timeoutGraceMs: 5,
      createRequestId: (() => {
        let sequence = 0;
        return () => `trigger-rejection-${++sequence}`;
      })(),
    });

    const error = await runner.runLifecycleProbe({
      scenario: 'explicit-cancel',
      workingDirectory: 'C:\\probe\\git',
    }, 1_000, {
      utilityWorkingDirectory: 'C:\\probe\\git',
      utilityEnvironment: {},
      waitForTrigger: () => Promise.reject(new Error('unretained trigger failure')),
      terminationOwnership: createTerminationOwnership(terminationEvents),
    }).catch((value: unknown) => value);

    expect(error).toMatchObject({
      reason: 'lifecycle_failed',
      terminationCleanup: {
        classification: 'graceful',
        abortRequested: true,
        abortObserved: true,
        sdkPromiseSettled: true,
        cleanupAcknowledged: true,
        utilityExitObserved: true,
        residualScanCompleted: true,
      },
    });
    expect(fake.processes[0]?.requests.map((request) => request.command)).toEqual([
      'start-lifecycle-probe',
      'cancel-active-probe',
      'shutdown',
    ]);
    expect(fake.processes[0]?.killCalls).toBe(0);
    expect(terminationEvents).toEqual(['bind:64004', 'residual-scan']);
  });

  it('routes a first-response utility PID mismatch through the same cleanup coordinator', async () => {
    const terminationEvents: string[] = [];
    const fake = createFork((request, process) => {
      if (request.command === 'run-capability-probe') {
        queueMicrotask(() => process.emit('message', {
          version: 1,
          requestId: request.requestId,
          command: request.command,
          ok: true,
          utilityPid: 999,
          result: {
            scenario: request.input.scenario,
            outcome: 'login_required',
            authClassification: 'login_required',
            runtimeFailureOrigin: null,
            safeFailureCode: null,
            utilityCwdMatchedExpected: true,
            explicitWorkingDirectoryRequested: false,
            skipGitRepoCheck: false,
            envPolicy: 'explicit_allowlist_no_api_credentials',
            finalResponseMatched: null,
          },
        }));
        return;
      }
      if (request.command === 'cancel-active-probe') {
        queueMicrotask(() => process.emit('message', {
          version: 1,
          requestId: request.requestId,
          command: request.command,
          ok: true,
          utilityPid: process.pid,
          abortRequested: true,
          abortObserved: true,
          sdkPromiseSettled: true,
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
      timeoutGraceMs: 5,
      createRequestId: (() => {
        let sequence = 0;
        return () => `pid-mismatch-${++sequence}`;
      })(),
    });

    const error = await runner.runCapabilityProbe({
      scenario: 'default-git-isolated-auth',
      expectedUtilityWorkingDirectory: 'C:\\probe\\git',
      skipGitRepoCheck: false,
      authMode: 'isolated-empty',
      isolatedCodexHome: 'C:\\probe\\empty-home',
    }, 1_000, {
      utilityWorkingDirectory: 'C:\\probe\\git',
      utilityEnvironment: {},
      terminationOwnership: createTerminationOwnership(terminationEvents),
    }).catch((value: unknown) => value);

    expect(error).toMatchObject({
      reason: 'protocol',
      terminationCleanup: {
        classification: 'graceful',
        utilityExitObserved: true,
        residualScanCompleted: true,
      },
    });
    expect(fake.processes[0]?.requests.map((request) => request.command)).toEqual([
      'run-capability-probe',
      'cancel-active-probe',
      'shutdown',
    ]);
    expect(fake.processes[0]?.killCalls).toBe(0);
  });

  it('does not force-kill when current-session utility ownership is unproven', async () => {
    const terminationEvents: string[] = [];
    const fake = createFork((request, process) => {
      if (request.command === 'start-lifecycle-probe') {
        queueMicrotask(() => process.emit('message', {
          version: 1,
          requestId: request.requestId,
          command: request.command,
          ok: true,
          utilityPid: process.pid,
          result: { scenario: request.input.scenario, turnStarted: true },
        }));
      }
    });
    const runner = new CodexFeasibilityRunner({
      modulePath: 'codex-feasibility-entry.js',
      fork: fake.fork,
      timeoutGraceMs: 5,
      createRequestId: (() => {
        let sequence = 0;
        return () => `unowned-${++sequence}`;
      })(),
    });

    const error = await runner.runLifecycleProbe({
      scenario: 'app-timeout',
      workingDirectory: 'C:\\probe\\git',
    }, 5, {
      utilityWorkingDirectory: 'C:\\probe\\git',
      utilityEnvironment: {},
      waitForTrigger: () => new Promise(() => undefined),
      terminationOwnership: createTerminationOwnership(terminationEvents, false),
    }).catch((value: unknown) => value);

    expect(error).toMatchObject({
      reason: 'timeout',
      timeoutCleanup: {
        classification: 'unverified',
        utilityKillOwnershipProven: false,
        utilityKillAttempted: false,
        utilityExitObserved: false,
      },
    });
    expect(fake.processes[0]?.requests.map((request) => request.command)).toEqual([
      'start-lifecycle-probe',
      'cancel-active-probe',
      'shutdown',
    ]);
    expect(fake.processes[0]?.killCalls).toBe(0);
    expect(terminationEvents).toEqual([
      'bind:64004',
      'ownership-check',
      'residual-scan',
    ]);
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
            runtimeFailureOrigin: null,
            safeFailureCode: null,
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
            runtimeFailureOrigin: null,
            safeFailureCode: null,
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
