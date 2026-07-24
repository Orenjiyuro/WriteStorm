import { z } from 'zod';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AiAttemptController,
  createAiAttemptResourceLimits,
} from '../../src/main/ai/ai-attempt-controller';
import {
  createAiExecutionEvent,
} from '../../src/main/ai/ai-execution-port';
import {
  createAiStructuredOutputContract,
} from '../../src/main/ai/ai-structured-output';

const outputContract = createAiStructuredOutputContract({
  schema: z.object({ summary: z.string() }).strict(),
  maxFinalBytes: 256,
});

const generousLimits = createAiAttemptResourceLimits({
  maxEventBytes: 512,
  maxTotalBytes: 2_048,
  maxEventCount: 8,
  maxPartialBytes: 256,
});

describe('Block 13.8 provider-neutral attempt controller', () => {
  it('projects progress and replace-style partial snapshots only to memory candidates', () => {
    const controller = new AiAttemptController({
      structuredOutput: outputContract,
      resourceLimits: generousLimits,
    });
    const started = controller.startAttempt();
    expect(started.accepted).toBe(true);
    if (!started.accepted) return;

    const progress = controller.accept(createAiExecutionEvent({
      ...started.token,
      sequence: 1,
      kind: 'progress',
    }));
    expect(progress).toMatchObject({
      disposition: 'accepted',
      checkpointCandidate: {
        kind: 'checkpoint_candidate',
        sequence: 1,
        progressEventCount: 1,
        partial: null,
      },
      terminalCandidate: null,
    });

    const partial = controller.accept(createAiExecutionEvent({
      ...started.token,
      sequence: 2,
      kind: 'partial',
      content: '{"summary":"draft"}',
    }));
    expect(partial).toMatchObject({
      disposition: 'accepted',
      checkpointCandidate: {
        kind: 'checkpoint_candidate',
        sequence: 2,
        partial: '{"summary":"draft"}',
      },
      terminalCandidate: null,
    });
    expect(controller.read().phase).toBe('active');
    expect(Object.isFrozen(partial)).toBe(true);
    if (partial.disposition === 'accepted') {
      expect(Object.isFrozen(partial.checkpointCandidate)).toBe(true);
    }
  });

  it('admits one locally validated final as a terminal candidate without persistence', () => {
    const controller = createController();
    const token = begin(controller);

    const result = controller.accept(createAiExecutionEvent({
      ...token,
      sequence: 1,
      kind: 'final',
      content: '{"summary":"done"}',
    }));

    expect(result).toMatchObject({
      disposition: 'accepted',
      checkpointCandidate: null,
      terminalCandidate: {
        kind: 'terminal_state_candidate',
        state: 'succeeded',
        sequence: 1,
      },
    });
    if (result.disposition !== 'accepted'
      || result.terminalCandidate?.state !== 'succeeded') return;
    expect(result.terminalCandidate.value.data).toEqual({ summary: 'done' });
    expect(controller.read().phase).toBe('terminal');
  });

  it.each([
    ['{"summary":"done","extra":true}', 'extra_field'],
    ['{"summary":42}', 'invalid_value'],
    ['{"summary":', 'invalid_json'],
    [`{"summary":"${'x'.repeat(300)}"}`, 'output_too_large'],
  ] as const)('fails closed for an invalid final (%s)', (content, classification) => {
    const controller = createController();
    const token = begin(controller);

    expect(controller.accept(createAiExecutionEvent({
      ...token,
      sequence: 1,
      kind: 'final',
      content,
    }))).toMatchObject({
      disposition: 'accepted',
      terminalCandidate: {
        state: 'failed',
        reason: 'invalid_final',
        finalClassification: classification,
      },
    });
  });

  it('ignores a duplicate final and every event after the terminal candidate', () => {
    const controller = createController();
    const token = begin(controller);
    controller.accept(createAiExecutionEvent({
      ...token,
      sequence: 1,
      kind: 'final',
      content: '{"summary":"first"}',
    }));

    expect(controller.accept(createAiExecutionEvent({
      ...token,
      sequence: 2,
      kind: 'final',
      content: '{"summary":"second"}',
    }))).toEqual({ disposition: 'ignored', reason: 'attempt_terminal' });
    expect(controller.accept(createAiExecutionEvent({
      ...token,
      sequence: 3,
      kind: 'partial',
      content: 'late',
    }))).toEqual({ disposition: 'ignored', reason: 'attempt_terminal' });
  });

  it('fails the current attempt on duplicate or out-of-order sequence numbers', () => {
    for (const sequence of [1, 3]) {
      const controller = createController();
      const token = begin(controller);
      controller.accept(createAiExecutionEvent({
        ...token,
        sequence: 1,
        kind: 'progress',
      }));

      expect(controller.accept(createAiExecutionEvent({
        ...token,
        sequence,
        kind: 'progress',
      }))).toMatchObject({
        disposition: 'accepted',
        terminalCandidate: {
          state: 'failed',
          reason: 'event_sequence_violation',
        },
      });
    }
  });

  it('makes every old generation permanently stale after an explicit new attempt', () => {
    const controller = createController();
    const oldToken = begin(controller);
    controller.cancel(oldToken);
    const replacement = controller.startAttempt();
    expect(replacement.accepted).toBe(true);
    if (!replacement.accepted) return;
    expect(replacement.token.attempt).toBe(oldToken.attempt + 1);
    expect(replacement.token.generation).toBe(oldToken.generation + 1);

    expect(controller.accept(createAiExecutionEvent({
      ...oldToken,
      sequence: 1,
      kind: 'final',
      content: '{"summary":"late"}',
    }))).toEqual({ disposition: 'ignored', reason: 'stale_generation' });
    expect(controller.read()).toMatchObject({
      phase: 'active',
      token: replacement.token,
    });
  });

  it('rejects concurrent starts and ignores output that continues after cancellation', () => {
    const controller = createController();
    const token = begin(controller);
    expect(controller.startAttempt()).toEqual({
      accepted: false,
      reason: 'attempt_active',
    });
    expect(controller.cancel(token)).toMatchObject({
      disposition: 'accepted',
      terminalCandidate: { state: 'cancelled' },
    });
    expect(controller.accept(createAiExecutionEvent({
      ...token,
      sequence: 1,
      kind: 'partial',
      content: 'continued',
    }))).toEqual({ disposition: 'ignored', reason: 'attempt_terminal' });
  });

  it('turns a stream ending without final/error into an incomplete-stream candidate', () => {
    const controller = createController();
    const token = begin(controller);
    controller.accept(createAiExecutionEvent({
      ...token,
      sequence: 1,
      kind: 'partial',
      content: '{"summary":"truncated',
    }));

    expect(controller.endInput(token)).toMatchObject({
      disposition: 'accepted',
      terminalCandidate: {
        state: 'failed',
        reason: 'incomplete_stream',
      },
    });
  });

  it.each([
    {
      name: 'single event bytes',
      limits: { maxEventBytes: 80, maxTotalBytes: 2_048, maxEventCount: 8, maxPartialBytes: 256 },
      events: [{ kind: 'partial', content: 'x'.repeat(100) }],
      resource: 'event_bytes',
    },
    {
      name: 'total projected bytes',
      limits: { maxEventBytes: 512, maxTotalBytes: 170, maxEventCount: 8, maxPartialBytes: 256 },
      events: [{ kind: 'progress' }, { kind: 'progress' }, { kind: 'progress' }],
      resource: 'total_bytes',
    },
    {
      name: 'event count',
      limits: { maxEventBytes: 512, maxTotalBytes: 2_048, maxEventCount: 1, maxPartialBytes: 256 },
      events: [{ kind: 'progress' }, { kind: 'progress' }],
      resource: 'event_count',
    },
    {
      name: 'partial memory',
      limits: { maxEventBytes: 512, maxTotalBytes: 2_048, maxEventCount: 8, maxPartialBytes: 4 },
      events: [{ kind: 'partial', content: '12345' }],
      resource: 'partial_bytes',
    },
  ] as const)('fails closed when $name exceeds its limit', ({ limits, events, resource }) => {
    const controller = new AiAttemptController({
      structuredOutput: outputContract,
      resourceLimits: createAiAttemptResourceLimits(limits),
    });
    const token = begin(controller);
    let last: ReturnType<typeof controller.accept> | undefined;
    events.forEach((event, index) => {
      last = controller.accept(createAiExecutionEvent({
        ...token,
        sequence: index + 1,
        ...event,
      }));
    });
    expect(last).toMatchObject({
      disposition: 'accepted',
      terminalCandidate: {
        state: 'failed',
        reason: 'resource_limit',
        resource,
      },
    });
  });

  it('turns an application-neutral error event into a sanitized failure candidate', () => {
    const controller = createController();
    const token = begin(controller);

    expect(controller.accept(createAiExecutionEvent({
      ...token,
      sequence: 1,
      kind: 'error',
    }))).toMatchObject({
      disposition: 'accepted',
      terminalCandidate: {
        state: 'failed',
        reason: 'runtime_error',
      },
    });
  });

  it('rejects malformed event envelopes and invalid resource policies', () => {
    expect(() => createAiExecutionEvent({
      attempt: 1,
      generation: 1,
      sequence: 1,
      kind: 'progress',
      extra: true,
    } as never)).toThrowError(expect.objectContaining({
      code: 'AI_EXECUTION_EVENT_INVALID',
    }));
    expect(() => createAiExecutionEvent({
      attempt: 0,
      generation: 1,
      sequence: 1,
      kind: 'progress',
    })).toThrow();
    expect(() => createAiAttemptResourceLimits({
      ...generousLimits,
      maxEventCount: 0,
    })).toThrow();
  });

  it('has no persistence, Job, timer or automatic retry dependency', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../../src/main/ai/ai-attempt-controller.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/better-sqlite3|sqlite|Job(?:Service|Repository)|CheckpointRepository/i);
    expect(source).not.toMatch(/writeFile|appendFile|setTimeout|setInterval|retry/i);
    expect(source).not.toMatch(/codex|openai|jsonl|child_process/i);
  });
});

function createController(): AiAttemptController {
  return new AiAttemptController({
    structuredOutput: outputContract,
    resourceLimits: generousLimits,
  });
}

function begin(controller: AiAttemptController) {
  const started = controller.startAttempt();
  if (!started.accepted) throw new Error('Expected an accepted attempt.');
  return started.token;
}
