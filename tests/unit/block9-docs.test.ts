import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Block 9 durable engineering status', () => {
  it('records the Task 9.1 pure authoritative-snapshot gate', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');

    for (const document of [context, decisions]) {
      expect(document).toContain('Task 9.1');
      expect(document).toContain('module_contract_unavailable');
      expect(document).toContain('module/scope/asset/dependency');
      expect(document).toContain('pure function');
    }
    expect(decisions).toContain('D025: Authoritative Module Workspace Gate');
  });

  it('records the Task 9.2 definition-only schema admission boundary', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');

    for (const document of [context, decisions]) {
      expect(document).toContain('Task 9.2');
      expect(document).toContain('migration 003');
      expect(document).toContain('analysis_modules');
      expect(document).toContain('AI 约束摘要');
      expect(document).toContain('analysis_module_instances');
    }
    expect(context).toContain('At the Task 9.2 checkpoint, schema version was 3');
    expect(decisions).toContain('D023: Analysis Module Definition Admission');
  });

  it('freezes the Task 9.3 instance identity and source-edition contract', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');

    for (const document of [context, decisions]) {
      expect(document).toContain('Task 9.3');
      expect(document).toContain('migration 004');
      expect(document).toContain('book');
      expect(document).toContain('volume');
      expect(document).toContain('chapter');
      expect(document).toContain('story_segment_range');
      expect(document).toContain('source structure snapshot');
      expect(document).toContain('injectable ID factory');
    }
    expect(context).toContain('At the Task 9.3 checkpoint, schema version was 4');
    expect(context).toContain('004: 4 CHECKs, 5 triggers, and 4 partial indexes');
    expect(decisions).toContain('D024: Analysis Module Instance Identity and Source Edition');
  });

  it('records immutable migration-local Block 9 snapshots', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');

    for (const document of [context, decisions]) {
      expect(document).toContain('migration-local');
      expect(document).toContain('forward migration');
      expect(document).toContain('ANALYSIS_MODULE_DEFINITION_SEED_003');
      expect(document).toContain('MODULE_INSTANCE_STATUS_VOCABULARY_004');
    }
    expect(decisions).toContain('D026: Immutable Block 9 Migration Snapshots');
  });

  it('records the Task 9.4 transactional future-freeze creation path', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');

    for (const document of [context, decisions]) {
      expect(document).toContain('Task 9.4');
      expect(document).toContain('AnalysisModuleInstanceEditionChangePort');
      expect(document).toContain('same freeze transaction');
      expect(document).toContain('needs_rebuild');
      expect(document).toContain('source structure snapshot');
    }
    expect(decisions).toContain('D027: Runtime Book-Scope Shell Creation');
  });

  it('records the Task 9.5 matrix-derived asset placeholders', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');

    for (const document of [context, decisions]) {
      expect(document).toContain('Task 9.5');
      expect(document).toContain('migration 005');
      expect(document).toContain('尚无资产');
      expect(document).toContain('ai_constraint');
      expect(document).toContain('ai_constraint_summary');
      expect(document).toContain('speculative asset tables');
    }
    expect(context).toContain('current schema version is 5');
    expect(decisions).toContain('D028: Matrix-Derived Asset Placeholders');
  });

  it('records the Task 9.6 frozen-structure workbench placement and 9.8 boundary', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');

    for (const document of [context, decisions]) {
      expect(document).toContain('Task 9.6');
      expect(document).toContain('AnalysisModuleWorkbench');
      expect(document).toContain('Breakdown shelf');
      expect(document).toContain('frozen');
      expect(document).toContain('Task 9.8');
      expect(document).toContain('modules:list-instances');
    }
    expect(decisions).toContain('D029: Frozen-Structure Module Workbench Placement');
  });

  it('records the Task 9.7 honest disabled AI action shell', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');

    for (const document of [context, decisions]) {
      expect(document).toContain('Task 9.7');
      expect(document).toContain('Run analysis');
      expect(document).toContain('Rerun module');
      expect(document).toContain('View rerun diff');
      expect(document).toContain('Codex SDK compatibility spike');
      expect(document).toContain('AI Job runtime');
      expect(document).toContain('rerun candidate');
    }
    expect(decisions).toContain('D030: Honest Disabled AI Action Shell');
  });

  it('records the Task 9.8 session-scoped module instance read path', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');

    for (const document of [context, decisions]) {
      expect(document).toContain('Task 9.8');
      expect(document).toContain('modules:list-instances');
      expect(document).toContain('AnalysisModuleInstanceService');
      expect(document).toContain('sessionId');
      expect(document).toContain('bookId');
      expect(document).toContain('MODULE_ERROR');
      expect(document).toContain('module_contract_unavailable');
      expect(document).toContain('book_scope_instances_incomplete');
      expect(document).toContain('non-recoverable');
      expect(document).toContain('session identity change');
      expect(document).toContain('previously opened Book');
      expect(document).toContain('modules:update-body');
    }
    expect(decisions).toContain('D031: Session-Scoped Module Instance Read Path');
  });

  it('records the Task 9.9 final module/instance boundary and natural-entry acceptance', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');

    for (const document of [context, decisions]) {
      expect(document).toContain('Task 9.9');
      expect(document).toContain('AnalysisModule');
      expect(document).toContain('AnalysisModuleInstance');
      expect(document).toContain('ai_constraint_summary');
      expect(document).toContain('Library');
      expect(document).toContain('Breakdown shelf');
      expect(document).toContain('packaged');
    }
    expect(context).toContain('Block 9 is complete');
    expect(decisions).toContain('D032: Module Workbench Boundary Acceptance');
  });
});
