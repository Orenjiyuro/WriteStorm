import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AiAttemptToken } from '../../ai-execution-port';
import { isCodexUtilityEnvironmentAllowlisted } from './codex-environment';
import { loadCodexProductProbeFixture } from './codex-product-probe-fixture';
import {
  isCodexProductProbeRequest,
  type CodexProductProbeRequest,
  type CodexProductProbeResponse,
  type CodexProductProbeResultResponse,
} from './codex-product-probe-protocol';
import { CodexScratchWorkspaceManager } from './codex-scratch-workspace';
import type { CodexUtilityLifecycleHost } from './codex-utility-lifecycle-host';

type CodexProductProbeClient = {
  startThread(options: {
    readonly workingDirectory: string;
    readonly skipGitRepoCheck: true;
    readonly sandboxMode: 'read-only';
    readonly approvalPolicy: 'never';
    readonly networkAccessEnabled: false;
    readonly webSearchMode: 'disabled';
  }): {
    run(input: string, options: {
      readonly outputSchema: unknown;
      readonly signal: AbortSignal;
    }): Promise<{ readonly finalResponse: string }>;
  };
};

type CodexClientFactory = () => CodexProductProbeClient;

export class CodexProductProbeUtilityHost {
  private started = false;

  constructor(private readonly dependencies: {
    readonly createClient: CodexClientFactory;
    readonly lifecycle: CodexUtilityLifecycleHost;
    readonly postMessage: (message: CodexProductProbeResponse) => void;
    readonly scratch?: CodexScratchWorkspaceManager;
  }) {}

  accepts(message: unknown): message is CodexProductProbeRequest {
    return isCodexProductProbeRequest(message);
  }

  accept(request: CodexProductProbeRequest): void {
    if (this.started) {
      throw new Error('Codex product probe utility session already started.');
    }
    this.started = true;
    const controller = new AbortController();
    const settled = this.execute(request, controller.signal);
    this.dependencies.lifecycle.bindActiveExecution({
      token: request.token,
      abort: () => controller.abort(),
      settled,
    });
    this.dependencies.postMessage({
      version: 1,
      origin: 'utility',
      type: 'ai.product-probe.started',
      token: request.token,
      scenario: request.scenario,
    });
  }

  private async execute(
    request: CodexProductProbeRequest,
    signal: AbortSignal,
  ): Promise<void> {
    const fixture = loadCodexProductProbeFixture();
    const workspace = (this.dependencies.scratch ?? new CodexScratchWorkspaceManager()).create();
    const assertions = {
      sdkImported: true,
      clientConstructed: false,
      scratchInsideOsTemp: isInside(os.tmpdir(), workspace.directory),
      nonGitWorkspace: !hasGitAncestor(workspace.directory),
      skipGitRepoCheck: workspace.threadOptions.skipGitRepoCheck,
      environmentAllowlisted: isCodexUtilityEnvironmentAllowlisted(process.env),
      finalJsonParsed: false,
      strictValidatorAccepted: false,
      expectedValueMatched: false,
      abortObserved: false,
      scratchCleanupCompleted: false,
    };
    let outcome: CodexProductProbeResultResponse['outcome'] = 'runtime_unavailable';

    try {
      const client = this.dependencies.createClient();
      assertions.clientConstructed = true;
      const thread = client.startThread({
        ...workspace.threadOptions,
        sandboxMode: 'read-only',
        approvalPolicy: 'never',
        networkAccessEnabled: false,
        webSearchMode: 'disabled',
      });
      const turn = await thread.run(fixture.input, {
        outputSchema: fixture.outputSchema,
        signal,
      });
      const validation = validateFixedResponse(turn.finalResponse);
      assertions.finalJsonParsed = validation.parsed;
      assertions.strictValidatorAccepted = validation.strict;
      assertions.expectedValueMatched =
        validation.strict && validation.canonical === fixture.expectedJson;
      outcome = assertions.expectedValueMatched ? 'success' : 'runtime_unavailable';
    } catch (error) {
      if (signal.aborted && isAbortError(error)) {
        assertions.abortObserved = true;
        outcome = 'aborted';
      }
    } finally {
      try {
        workspace.cleanup();
        assertions.scratchCleanupCompleted = true;
      } catch {
        assertions.scratchCleanupCompleted = false;
      }
    }

    this.dependencies.postMessage({
      version: 1,
      origin: 'utility',
      type: 'ai.product-probe.result',
      token: request.token,
      scenario: request.scenario,
      outcome,
      assertions,
    });
  }
}

function validateFixedResponse(value: string): {
  readonly parsed: boolean;
  readonly strict: boolean;
  readonly canonical: string | null;
} {
  try {
    const parsed = JSON.parse(value) as unknown;
    const strict = isPlainRecord(parsed)
      && Object.keys(parsed).length === 1
      && parsed.status === 'WS13';
    return {
      parsed: true,
      strict,
      canonical: strict ? JSON.stringify(parsed) : null,
    };
  } catch {
    return { parsed: false, strict: false, canonical: null };
  }
}

function hasGitAncestor(directory: string): boolean {
  let current = path.resolve(directory);
  while (true) {
    if (existsSync(path.join(current, '.git'))) return true;
    const parent = path.dirname(current);
    if (parent === current) return false;
    current = parent;
  }
}

function isInside(parent: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}
