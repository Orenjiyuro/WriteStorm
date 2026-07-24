import os from 'node:os';
import path from 'node:path';
import { isCodexUtilityEnvironmentAllowlisted } from './codex-environment';
import {
  isCodexConnectionCheckRequest,
  type CodexConnectionCheckRequest,
  type CodexConnectionCheckResponse,
} from './codex-connection-check-protocol';
import { CodexScratchWorkspaceManager } from './codex-scratch-workspace';
import type { CodexUtilityLifecycleHost } from './codex-utility-lifecycle-host';

const FIXED_INPUT =
  'Return exactly one JSON object with the single field status set to WS13.';
const FIXED_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  properties: Object.freeze({
    status: Object.freeze({ type: 'string', const: 'WS13' }),
  }),
  required: Object.freeze(['status']),
});

type ConnectionCheckClient = {
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

export class CodexConnectionCheckUtilityHost {
  private started = false;

  constructor(private readonly dependencies: {
    readonly createClient: () => ConnectionCheckClient;
    readonly lifecycle: CodexUtilityLifecycleHost;
    readonly postMessage: (message: CodexConnectionCheckResponse) => void;
    readonly scratch?: CodexScratchWorkspaceManager;
    readonly environment?: NodeJS.ProcessEnv;
  }) {}

  accepts(message: unknown): message is CodexConnectionCheckRequest {
    return isCodexConnectionCheckRequest(message);
  }

  accept(request: CodexConnectionCheckRequest): void {
    if (this.started) throw new Error('Codex connection check already started.');
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
      type: 'ai.connection-check.started',
      token: request.token,
    });
  }

  private async execute(
    request: CodexConnectionCheckRequest,
    signal: AbortSignal,
  ): Promise<void> {
    const workspace = (this.dependencies.scratch ?? new CodexScratchWorkspaceManager()).create();
    let outcome: 'authenticated' | 'runtime_unavailable' = 'runtime_unavailable';
    try {
      if (!isInside(os.tmpdir(), workspace.directory)
        || !isCodexUtilityEnvironmentAllowlisted(
          this.dependencies.environment ?? process.env,
        )) {
        throw new Error('Codex connection-check runtime boundary is unavailable.');
      }
      const client = this.dependencies.createClient();
      const thread = client.startThread({
        ...workspace.threadOptions,
        sandboxMode: 'read-only',
        approvalPolicy: 'never',
        networkAccessEnabled: false,
        webSearchMode: 'disabled',
      });
      const turn = await thread.run(FIXED_INPUT, {
        outputSchema: FIXED_SCHEMA,
        signal,
      });
      outcome = isExpectedResponse(turn.finalResponse)
        ? 'authenticated'
        : 'runtime_unavailable';
    } catch {
      outcome = 'runtime_unavailable';
    } finally {
      try {
        workspace.cleanup();
      } catch {
        outcome = 'runtime_unavailable';
      }
    }
    this.dependencies.postMessage({
      version: 1,
      origin: 'utility',
      type: 'ai.connection-check.result',
      token: request.token,
      outcome,
    });
  }
}

function isExpectedResponse(value: string): boolean {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isPlainRecord(parsed)
      && Object.keys(parsed).length === 1
      && parsed.status === 'WS13';
  } catch {
    return false;
  }
}

function isInside(parent: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}
