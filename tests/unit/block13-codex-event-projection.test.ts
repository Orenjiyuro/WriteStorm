import { describe, expect, it } from 'vitest';
import {
  CodexEventProjectionError,
  projectCodexStreamLine,
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
      kind: 'final',
      content: '{"summary":"done"}',
    }],
    [{ type: 'turn.failed', error: { message: 'secret raw error' } }, { kind: 'error' }],
    [{ type: 'error', message: 'secret raw error' }, { kind: 'error' }],
  ] as const)('maps a recorded SDK-shaped event without leaking provider fields', (raw, expected) => {
    const event = projectCodexStreamLine({
      token,
      sequence: 1,
      line: JSON.stringify(raw),
      maxEventBytes: 512,
    });

    expect(event).toMatchObject({ ...token, sequence: 1, ...expected });
    expect(JSON.stringify(event)).not.toMatch(/private-id|secret raw error/);
  });

  it('reduces non-message item events and turn completion to payload-free progress', () => {
    for (const raw of [
      { type: 'item.started', item: { id: '1', type: 'command_execution' } },
      { type: 'item.completed', item: { id: '1', type: 'reasoning' } },
      { type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 2 } },
    ]) {
      expect(projectCodexStreamLine({
        token,
        sequence: 1,
        line: JSON.stringify(raw),
        maxEventBytes: 512,
      })).toMatchObject({ kind: 'progress' });
    }
  });

  it.each([
    ['{"type":', 'malformed_event'],
    ['null', 'malformed_event'],
    ['{"type":"thread.started"}', 'malformed_event'],
    ['{"type":"error"}', 'malformed_event'],
    ['{"type":"item.updated","item":{"type":"agent_message","text":"x"}}', 'malformed_event'],
    ['{"type":"invented"}', 'unsupported_event'],
  ] as const)('rejects malformed, truncated and unsupported frames (%s)', (line, classification) => {
    expect(() => projectCodexStreamLine({
      token,
      sequence: 1,
      line,
      maxEventBytes: 512,
    })).toThrowError(expect.objectContaining({ classification }));
  });

  it('checks the raw JSONL event byte ceiling before parsing', () => {
    try {
      projectCodexStreamLine({
        token,
        sequence: 1,
        line: JSON.stringify({
          type: 'item.updated',
          item: { type: 'agent_message', text: 'x'.repeat(128) },
        }),
        maxEventBytes: 32,
      });
      throw new Error('Expected projector rejection.');
    } catch (error) {
      expect(error).toBeInstanceOf(CodexEventProjectionError);
      expect(error).toMatchObject({ classification: 'event_too_large' });
      expect(String(error)).not.toContain('x'.repeat(16));
    }
  });
});
