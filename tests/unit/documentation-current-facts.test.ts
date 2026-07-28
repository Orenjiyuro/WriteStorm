import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string): string => readFileSync(path.resolve(relativePath), 'utf8');

describe('current documentation facts', () => {
  it('keeps the canonical source-copy contract aligned with implementation', () => {
    const documents = [
      read('docs/product/FLOWS.md'),
      read('docs/product/write-storm-product-design.md'),
      read('docs/engineering/TECHNICAL_DESIGN.md'),
    ];
    const sourceMetadata = read('src/main/source-text/source-text-metadata.ts');

    for (const document of documents) {
      expect(document).toContain('source/{sourceTextId}/{originalFileName}');
      expect(document).not.toContain('breakdown-books/');
      expect(document).not.toContain('original.txt');
    }
    expect(sourceMetadata).toContain(
      'return `source/${id}/${normalizeOriginalFileName(originalFileName)}`',
    );
  });

  it('keeps SQLite authoritative and JSON derived', () => {
    const product = read('docs/product/write-storm-product-design.md');
    const flows = read('docs/product/FLOWS.md');

    expect(product).toContain('sqlite_is_transactional_source_of_truth: true');
    expect(product).toContain('json_is_derived_only: true');
    expect(product).not.toContain('json_is_source_of_truth: true');
    expect(flows).toContain('transactional_source_of_truth: sqlite');
  });

  it('does not expose disabled recovery, export or Technique actions as current flows', () => {
    const flows = read('docs/product/FLOWS.md');
    const jobRecoveryPanel = read(
      'src/renderer/features/job-recovery/JobRecoveryPanel.tsx',
    );
    const exportStatusPanel = read(
      'src/renderer/features/export-status/ExportStatusPanel.tsx',
    );

    for (const disabledFact of [
      'Resume remains disabled',
      'Export execution unavailable',
      'Technique Library empty/read-only shell',
      'Production AI module-body generation is not implemented',
    ]) {
      expect(flows).toContain(disabledFact);
    }
    expect(flows).not.toContain('TASK-001-breakdown-workbench-foundation.md');
    expect(flows).not.toContain('启动、暂停、恢复、取消');
    expect(jobRecoveryPanel).toMatch(
      /<button type="button" disabled aria-describedby=\{resumeReasonId\}>\{text\.resume\}<\/button>/,
    );
    expect(exportStatusPanel).toMatch(
      /<button type="button" disabled aria-describedby=\{reasonId\}>/,
    );
  });

  it('registers D132 and the REV3.2 quality authority without claiming completion', () => {
    const product = read('docs/product/write-storm-product-design.md');
    const task002 = read('docs/tasks/TASK-002-v1-work-breakdown-master-plan.md');
    const task002AuthorityEntry = task002.slice(0, task002.indexOf('## 0A.'));
    const tutorial = read('docs/engineering/V1-BLOCK-14-LITERARY-ANALYSIS-TUTORIAL.md');
    const qualityGate = read(
      'docs/engineering/V1-BLOCK-14-SYSTEM-PRODUCTION-QUALITY-GATE.md',
    );

    expect(product).toContain('D122–D132');
    expect(product).toContain('V1-BLOCK-14-SYSTEM-PRODUCTION-QUALITY-GATE.md');
    expect(product).toContain('BLOCK14_NOT_FROZEN / QUALITY_UNPROVEN');
    expect(task002AuthorityEntry).toContain('D122–D132');
    expect(task002AuthorityEntry).toContain('V1-BLOCK-14-SYSTEM-PRODUCTION-QUALITY-GATE.md');
    expect(tutorial).toContain('截至 D132，当前状态是');
    expect(tutorial).toContain('BLOCK14_NOT_FROZEN / QUALITY_UNPROVEN');
    expect(qualityGate).toContain(
      'USER_CONFIRMED_DIRECTION / REV3.2_CONFIRMED / BLOCK14_NOT_FROZEN / QUALITY_UNPROVEN',
    );
  });
});
