import { describe, expect, it } from 'vitest';
import {
  CodexEventProjectionError,
  CodexStreamEventProjector,
} from '../../src/main/ai/providers/codex/codex-event-projection';

const token = { attempt: 1, generation: 1 } as const;

describe('Block 13.8 Codex-private event projection', () => {
  it.each([
    [{ type: 'thread.started', thread_id: 'private-id' }, { kind: 'progress' }],
    [{ type: 'turn.started' }, { kind: 'progress' }],
    [{
      type: 'item.updated',
      item: { id: 'private-id', type: 'agent_message', text: '{"summary":"dra' },
    }, {
      kind: 'partial',
      content: '{"summary":"dra',
    }],
    [{
      type: 'item.completed',
      item: { id: 'private-id', type: 'agent_message', text: '{"summary":"done"}' },
    }, {
      kind: 'partial',
      content: '{"summary":"done"}',
    }],
    [{ type: 'turn.failed', error: { message: 'secret raw error' } }, { kind: 'error' }],
    [{ type: 'error', message: 'secret raw error' }, { kind: 'error' }],
  ] as const)('maps a recorded SDK-shaped event without leaking provider fields', (raw, expected) => {
    const projector = createProjector();
    const event = projector.project(JSON.stringify(raw));

    expect(event).toMatchObject({ ...token, sequence: 1, ...expected });
    expect(JSON.stringify(event)).not.toMatch(/private-id|secret raw error/);
  });

  it('reduces non-message item events and turn completion to payload-free progress', () => {
    for (const raw of [
      { type: 'item.started', item: { id: '1', type: 'command_execution' } },
      { type: 'item.completed', item: { id: '1', type: 'reasoning' } },
    ]) {
      expect(createProjector().project(JSON.stringify(raw))).toMatchObject({
        kind: 'progress',
      });
    }
  });

  it('emits final only when turn completion confirms the latest completed agent message', () => {
    const projector = createProjector();
    expect(projector.project(JSON.stringify({
      type: 'item.updated',
      item: { id: '1', type: 'agent_message', text: '{"summary":"draft"}' },
    }))).toMatchObject({ sequence: 1, kind: 'partial' });
    expect(projector.project(JSON.stringify({
      type: 'item.completed',
      item: { id: '1', type: 'agent_message', text: '{"summary":"done"}' },
    }))).toMatchObject({ sequence: 2, kind: 'partial' });
    expect(projector.project(JSON.stringify({
      type: 'turn.completed',
      usage: { input_tokens: 1, output_tokens: 2 },
    }))).toMatchObject({
      sequence: 3,
      kind: 'final',
      content: '{"summary":"done"}',
    });
  });

  it.each([
    ['{"type":', 'malformed_event'],
    ['null', 'malformed_event'],
    ['{"type":"thread.started"}', 'malformed_event'],
    ['{"type":"error"}', 'malformed_event'],
    ['{"type":"item.updated","item":{"type":"agent_message","text":"x"}}', 'malformed_event'],
    ['{"type":"invented"}', 'unsupported_event'],
  ] as const)('rejects malformed, truncated and unsupported frames (%s)', (line, classification) => {
    expect(() => createProjector().project(line)).toThrowError(
      expect.objectContaining({ classification }),
    );
  });

  it('checks the raw JSONL event byte ceiling before parsing', () => {
    try {
      const projector = new CodexStreamEventProjector({ token, maxEventBytes: 32 });
      projector.project(JSON.stringify({
        type: 'item.updated',
        item: { id: '1', type: 'agent_message', text: 'x'.repeat(128) },
      }));
      throw new Error('Expected projector rejection.');
    } catch (error) {
      expect(error).toBeInstanceOf(CodexEventProjectionError);
      expect(error).toMatchObject({ classification: 'event_too_large' });
      expect(String(error)).not.toContain('x'.repeat(16));
    }
  });

  it('rejects turn completion without a completed agent message', () => {
    expect(() => createProjector().project(JSON.stringify({
      type: 'turn.completed',
      usage: { input_tokens: 1, output_tokens: 2 },
    }))).toThrowError(expect.objectContaining({ classification: 'malformed_event' }));
  });
});

function createProjector(): CodexStreamEventProjector {
  return new CodexStreamEventProjector({ token, maxEventBytes: 512 });
}
