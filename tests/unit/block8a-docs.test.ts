import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const statusPath = path.resolve('docs/engineering/V1-BLOCK-8A-STATUS.md');

describe('Block 8A historical status record', () => {
  it('locks numbering and the historical/current authority boundary', () => {
    const status = readFileSync(statusPath, 'utf8');

    expect(status).toContain('HISTORICAL 8A DETECTION EVIDENCE / SUPERSEDED');
    expect(status).toContain('`V1-BLOCK-8-STATUS.md` is the current whole-Block authority');
    expect(status).toContain('8A-0 through 8A-10 are execution-slice labels, not master Task numbers');
    expect(status).toContain('8A Detection engine');
    expect(status).toContain('8B Review and freeze');
    expect(status).toContain('8C Invalidation hook');
    expect(status).toContain('At the 8A checkpoint, 6A/Codex SDK feasibility was unexecuted and unrecorded');
    expect(status).toContain('local deterministic parsing only');
  });

  it('states the candidate-only historical boundary without claiming 8B is still incomplete', () => {
    const status = readFileSync(statusPath, 'utf8');

    expect(status).toContain('Candidate side only at the 8A checkpoint');
    expect(status).toContain('draft/frozen repository and service transactions were then deferred to 8B');
    expect(status).toContain('event-loop probe, not a product Detect structure button');
    expect(status).toContain('are now recorded in');
    expect(status).not.toContain('Block 8B/8C remain incomplete');
    expect(status).not.toContain('Task 8.17 remains 8B work');
  });

  it('records the cancellation transaction order, public service entry, hard gates, and reproduction commands', () => {
    const status = readFileSync(statusPath, 'utf8');

    expect(status).toContain('markCancelled -> persist run=failed and Job=cancelled -> AbortController.abort');
    expect(status).toContain('`startDetection` is the only public detection execution entrypoint');
    expect(status).toContain('npm run typecheck');
    expect(status).toContain('npm run build');
    expect(status).toContain('tests/e2e/structure-performance-recorder.spec.ts');
  });
});
