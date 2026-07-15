import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const statusPath = path.resolve('docs/engineering/V1-BLOCK-8A-STATUS.md');
const block8StatusPath = path.resolve('docs/engineering/V1-BLOCK-8-STATUS.md');
const contextPath = path.resolve('docs/engineering/CONTEXT.md');
const technicalDesignPath = path.resolve('docs/engineering/TECHNICAL_DESIGN.md');
const decisionsPath = path.resolve('docs/engineering/DECISIONS.md');

describe('Block 8A status record', () => {
  it('locks master status, internal numbering, and authorization boundaries', () => {
    const status = readFileSync(statusPath, 'utf8');

    for (const task of ['8.1', '8.2', '8.3', '8.4', '8.5', '8.6', '8.7', '8.8', '8.9', '8.10', '8.12', '8.13', '8.18']) {
      expect(status).toContain(`| ${task} |`);
    }
    for (const slice of ['8A-0', '8A-R1 through 8A-R6', '8A-7', '8A-8', '8A-9', '8A-10']) {
      expect(status).toContain(slice);
    }
    expect(status).toContain('8A-10 | Worker telemetry');
    expect(status).toContain('Task 8.13');
    expect(status).toContain('Master Task 8.10 means Validation');
    expect(status).toContain('Block 8B Review and freeze');
    expect(status).toContain('Block 8C Invalidation hook');
    expect(status).not.toContain('Block 8 is complete');
  });

  it('records feasibility and packaged-performance evidence without overstating it', () => {
    const status = readFileSync(statusPath, 'utf8');

    expect(status).toContain('6A/Codex SDK feasibility remains unexecuted and unrecorded');
    expect(status).not.toMatch(/6A[^\n]{0,80}\bGo\b/);
    expect(status).toContain('observation-only advisories');
    expect(status).toContain('macOS packaged performance evidence has not been recorded');
    expect(status).toContain('Task 8.9 candidate persistence and stage-separation foundation is complete');
    expect(status).toContain('draft/frozen repository and service transactions remain 8B work');
  });

  it('makes CONTEXT route readers to the durable 8A status and preserves unfinished boundaries', () => {
    const context = readFileSync(contextPath, 'utf8');

    expect(context).toContain('Current Block 8A gate facts:');
    expect(context).toContain('V1-BLOCK-8A-STATUS.md');
    expect(context).toContain('internal 8A-10 maps to master Task 8.13');
    expect(context).toContain('master Task 8.10 is validation');
    expect(context).toContain('6A feasibility remains unexecuted and unrecorded');
    expect(context).toContain('V1-BLOCK-8-STATUS.md');
    expect(context).toContain('later independent review reopened Block 8 completion');
  });

  it('records the 8C transaction seam without inventing downstream persistence or completion', () => {
    const status = readFileSync(block8StatusPath, 'utf8');
    const technicalDesign = readFileSync(technicalDesignPath, 'utf8');
    const decisions = readFileSync(decisionsPath, 'utf8');

    for (const phrase of [
      'StructureEditionChangePort', 'synchronous and DB-only', 'needs_rebuild', 'stale',
      'needs_refresh', 'invalidate_for_future_owner', 'persisted: false',
      'Block 8 is complete within the recorded Windows V1 boundary',
    ]) expect(status).toContain(phrase);
    expect(status).toContain('No downstream recomputation is started');
    expect(status).toContain('No real `AnalysisModuleInstance`, ReviewAsset/Evidence, Perspective, or CompletionGate persistence adapter exists');
    expect(technicalDesign).toContain('synchronous DB-only `StructureEditionChangePort`');
    expect(decisions).toContain('D021: Structure Edition Invalidation Transaction Seam');
    expect(decisions).toContain('CompletionGate has no admitted runtime owner');
  });

  it('reconciles every master Block 8 task and records the final certification evidence', () => {
    const status = readFileSync(block8StatusPath, 'utf8');

    for (let task = 1; task <= 18; task += 1) {
      expect(status).toContain(`| 8.${task} |`);
    }
    for (const gate of [
      'npm run check', '19/19 hashes match', 'tests/e2e/source-import.spec.ts',
      'SQLite 3.53.2', 'git diff --check', 'Inspect current packaged screenshots',
    ]) expect(status).toContain(gate);
    expect(status).toContain('90 unit files / 393 tests');
    expect(status).toContain('22 integration files / 202 tests');
    expect(status).toContain('11/11 serial packaged Electron tests');
    expect(status).toContain('The latest worktree passed this final matrix on 2026-07-15');
    expect(status).toContain('macOS, makers, signing, notarization, and release readiness remain separate unverified boundaries');
    expect(status).toContain('stale-candidate/manual fallback');
    expect(status).toContain('stale low-confidence read-only controls');
    expect(status).toContain('destructive story-range skip confirmation');
    expect(status).toContain('are now tested');
    expect(status).toContain('both packaged source-change recovery paths are now tested');
    expect(status).toContain('Manual draft authorization, monotonic replacement lineage, and persistent monotonic detection-run ordering were repaired and focused-tested');
    expect(status).toContain('No current Block 8 completion blocker remains');
    expect(status).toContain('persistent monotonic detection-run ordering were repaired and focused-tested');
    expect(status).toContain('fixture setup is not claimed as a user-facing source-replace workflow');
    expect(status).toContain('Block 8 is complete');
  });
});
