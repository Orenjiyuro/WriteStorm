import { EventEmitter } from 'node:events';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectStructureCandidates } from '../../src/main/structure/detection/structure-detector';
import { detectStorySegmentRanges } from '../../src/main/structure/detection/story-range-detector';
import {
  UtilityWorkerRunner,
  UtilityWorkerRunnerError,
  resolveUtilityWorkerModulePath,
  type ForkUtilityProcess,
  type UtilityProcessHandle,
  type UtilityWorkerRequest,
} from '../../src/main/structure/worker/structure-worker-runner';

class FakeUtilityProcess extends EventEmitter implements UtilityProcessHandle {
  readonly pid = 4242;
  killed = false;
  requests: UtilityWorkerRequest[] = [];

  constructor(
    private readonly onRequest: (
      request: UtilityWorkerRequest,
      process: FakeUtilityProcess,
    ) => void,
    private readonly exitSynchronouslyOnKill = false,
  ) {
    super();
    queueMicrotask(() => this.emit('spawn'));
  }

  postMessage(message: unknown): void {
    const request = message as UtilityWorkerRequest;
    this.requests.push(request);
    this.onRequest(request, this);
  }

  kill(): boolean {
    this.killed = true;
    if (this.exitSynchronouslyOnKill) {
      this.emit('exit', 143);
    }
    return true;
  }
}

function createFork(
  onRequest: (request: UtilityWorkerRequest, process: FakeUtilityProcess) => void,
  options: { readonly exitSynchronouslyOnKill?: boolean } = {},
): { fork: ForkUtilityProcess; processes: FakeUtilityProcess[] } {
  const processes: FakeUtilityProcess[] = [];
  const fork: ForkUtilityProcess = () => {
    const process = new FakeUtilityProcess(onRequest, options.exitSynchronouslyOnKill);
    processes.push(process);
    return process;
  };

  return { fork, processes };
}

describe('Structure utility worker runner', () => {
  it('resolves the worker next to the main Vite bundle in dev and packaged layouts', () => {
    expect(resolveUtilityWorkerModulePath('C:\\repo\\.vite\\build')).toBe(
      path.join('C:\\repo\\.vite\\build', 'structure-worker-entry.js'),
    );
    expect(resolveUtilityWorkerModulePath('C:\\app\\resources\\app\\.vite\\build')).toBe(
      path.join('C:\\app\\resources\\app\\.vite\\build', 'structure-worker-entry.js'),
    );
  });

  it('round trips a typed echo response and reaps the worker', async () => {
    const { fork, processes } = createFork((request, process) => {
      if (request.command !== 'echo') {
        throw new Error('Expected an echo request.');
      }
      queueMicrotask(() => process.emit('message', {
        version: 2,
        requestId: request.requestId,
        command: 'echo',
        ok: true,
        workerPid: process.pid,
        payload: request.payload,
      }));
    }, { exitSynchronouslyOnKill: true });
    const runner = new UtilityWorkerRunner({
      modulePath: 'structure-worker-entry.js',
      fork,
      createRequestId: () => 'request-1',
    });

    await expect(runner.echo('typed round trip', 100)).resolves.toEqual({
      payload: 'typed round trip',
      workerPid: 4242,
    });
    expect(processes[0].requests).toEqual([{
      version: 2,
      requestId: 'request-1',
      command: 'echo',
      payload: 'typed round trip',
    }]);
    expect(processes[0].killed).toBe(true);
    expect(runner.activeCount).toBe(0);
  });

  it('round trips a typed real-detection result and reaps the worker', async () => {
    const performanceSamples: unknown[] = [];
    const times = [100, 115];
    const { fork, processes } = createFork((request, process) => {
      if (request.command !== 'detect') {
        throw new Error('Expected a detection request.');
      }
      const structure = detectStructureCandidates(request.input);
      const storyRanges = structure.status === 'structure_detection_failed'
        ? null
        : detectStorySegmentRanges({
          sourceText: request.input.sourceText,
          chapters: structure.nodes.filter((node) => node.kind === 'chapter'),
        });

      queueMicrotask(() => process.emit('message', {
        version: 2,
        requestId: request.requestId,
        command: 'detect',
        ok: true,
        workerPid: process.pid,
        result: { structure, storyRanges },
        telemetry: DETECTION_TELEMETRY,
      }));
    });
    const runner = new UtilityWorkerRunner({
      modulePath: 'structure-worker-entry.js',
      fork,
      createRequestId: () => 'request-detect',
      now: () => times.shift()!,
      onDetectionComplete: (sample) => performanceSamples.push(sample),
    });

    const result = await runner.detect(DETECTION_INPUT, 100);

    expect(result.workerPid).toBe(4242);
    expect(result.telemetry).toEqual(DETECTION_TELEMETRY);
    expect(result.result).toMatchObject({
      structure: {
        status: 'candidate_ready',
        nodes: [
          { kind: 'book', title: 'Worker fixture' },
          { kind: 'chapter', title: 'Chapter 1: Start' },
          { kind: 'chapter', title: 'Chapter 2: Continue' },
        ],
      },
      storyRanges: {
        status: 'no_reliable_story_ranges',
      },
    });
    expect(processes[0].requests).toEqual([{
      version: 2,
      requestId: 'request-detect',
      command: 'detect',
      input: DETECTION_INPUT,
    }]);
    expect(processes[0].killed).toBe(true);
    expect(runner.activeCount).toBe(0);
    expect(performanceSamples).toEqual([{
      input: DETECTION_INPUT,
      mainElapsedMs: 15,
      workerPid: 4242,
      telemetry: DETECTION_TELEMETRY,
    }]);
  });

  it('maps an unresponsive detection worker to timeout and kills it', async () => {
    const { fork, processes } = createFork(() => undefined);
    const runner = new UtilityWorkerRunner({
      modulePath: 'structure-worker-entry.js',
      fork,
      createRequestId: () => 'request-detect-timeout',
    });

    await expect(runner.detect(DETECTION_INPUT, 5)).rejects.toMatchObject({
      code: 'UTILITY_WORKER_TIMEOUT',
    } satisfies Partial<UtilityWorkerRunnerError>);
    expect(processes[0].killed).toBe(true);
    expect(runner.activeCount).toBe(0);
  });

  it('keeps timeout mapping stable when kill synchronously emits exit', async () => {
    const { fork } = createFork(() => undefined, { exitSynchronouslyOnKill: true });
    const runner = new UtilityWorkerRunner({
      modulePath: 'structure-worker-entry.js',
      fork,
      createRequestId: () => 'request-timeout-race',
    });

    await expect(runner.detect(DETECTION_INPUT, 5)).rejects.toMatchObject({
      code: 'UTILITY_WORKER_TIMEOUT',
    } satisfies Partial<UtilityWorkerRunnerError>);
  });

  it('maps a detection worker exit to a stable crash error', async () => {
    const { fork, processes } = createFork((_request, process) => {
      queueMicrotask(() => process.emit('exit', 27));
    });
    const runner = new UtilityWorkerRunner({
      modulePath: 'structure-worker-entry.js',
      fork,
      createRequestId: () => 'request-detect-crash',
    });

    await expect(runner.detect(DETECTION_INPUT, 100)).rejects.toMatchObject({
      code: 'UTILITY_WORKER_CRASH',
    } satisfies Partial<UtilityWorkerRunnerError>);
    expect(processes[0].killed).toBe(false);
    expect(runner.activeCount).toBe(0);
  });

  it('cancels one active detection through AbortSignal and kills its worker', async () => {
    const { fork, processes } = createFork(() => undefined);
    const runner = new UtilityWorkerRunner({
      modulePath: 'structure-worker-entry.js',
      fork,
      createRequestId: () => 'request-detect-cancel',
    });
    const controller = new AbortController();
    const pending = runner.detect(DETECTION_INPUT, 10_000, { signal: controller.signal });
    await new Promise((resolve) => setImmediate(resolve));

    controller.abort();

    await expect(pending).rejects.toMatchObject({
      code: 'UTILITY_WORKER_CANCELLED',
    } satisfies Partial<UtilityWorkerRunnerError>);
    expect(processes[0].killed).toBe(true);
    expect(runner.activeCount).toBe(0);
  });

  it('keeps cancellation mapping stable when kill synchronously emits exit', async () => {
    const { fork } = createFork(() => undefined, { exitSynchronouslyOnKill: true });
    const runner = new UtilityWorkerRunner({
      modulePath: 'structure-worker-entry.js',
      fork,
      createRequestId: () => 'request-cancel-race',
    });
    const controller = new AbortController();
    const pending = runner.detect(DETECTION_INPUT, 10_000, { signal: controller.signal });
    await new Promise((resolve) => setImmediate(resolve));

    controller.abort();

    await expect(pending).rejects.toMatchObject({
      code: 'UTILITY_WORKER_CANCELLED',
    } satisfies Partial<UtilityWorkerRunnerError>);
  });

  it('maps a hung worker to a stable timeout and kills it', async () => {
    const { fork, processes } = createFork(() => undefined);
    const runner = new UtilityWorkerRunner({
      modulePath: 'structure-worker-entry.js',
      fork,
      createRequestId: () => 'request-timeout',
    });

    await expect(runner.hang(5)).rejects.toMatchObject({
      code: 'UTILITY_WORKER_TIMEOUT',
    } satisfies Partial<UtilityWorkerRunnerError>);
    expect(processes[0].killed).toBe(true);
    expect(runner.activeCount).toBe(0);
  });

  it('maps an early process exit to a stable crash error', async () => {
    const { fork, processes } = createFork((_request, process) => {
      queueMicrotask(() => process.emit('exit', 19));
    });
    const runner = new UtilityWorkerRunner({
      modulePath: 'structure-worker-entry.js',
      fork,
      createRequestId: () => 'request-crash',
    });

    await expect(runner.crash(100)).rejects.toMatchObject({
      code: 'UTILITY_WORKER_CRASH',
    } satisfies Partial<UtilityWorkerRunnerError>);
    expect(processes[0].killed).toBe(false);
    expect(runner.activeCount).toBe(0);
  });

  it('kills active workers and rejects pending work when the app disposes the runner', async () => {
    const { fork, processes } = createFork(
      () => undefined,
      { exitSynchronouslyOnKill: true },
    );
    const runner = new UtilityWorkerRunner({
      modulePath: 'structure-worker-entry.js',
      fork,
      createRequestId: () => 'request-dispose',
    });
    const pending = runner.hang(10_000);
    await new Promise((resolve) => setImmediate(resolve));

    const killedPids = runner.dispose();

    await expect(pending).rejects.toMatchObject({
      code: 'UTILITY_WORKER_DISPOSED',
    } satisfies Partial<UtilityWorkerRunnerError>);
    expect(killedPids).toEqual([4242]);
    expect(processes[0].killed).toBe(true);
    expect(runner.activeCount).toBe(0);
  });
});

const DETECTION_INPUT = {
  bookTitle: 'Worker fixture',
  sourceText: 'Chapter 1: Start\nBody\nChapter 2: Continue\nBody',
} as const;

const DETECTION_TELEMETRY = {
  durationMs: 12.5,
  rssBeforeBytes: 40_000_000,
  rssAfterBytes: 45_000_000,
  heapUsedBeforeBytes: 8_000_000,
  heapUsedAfterBytes: 10_000_000,
  maxRssBytes: 48_000_000,
} as const;
