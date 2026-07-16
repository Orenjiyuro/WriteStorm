import { describe, expect, it } from 'vitest';
import { calculateExportStatus } from '../../src/main/exports/export-status-calculator';
import {
  ANALYSIS_MODULE_DEFINITIONS,
  EXPORT_BLOCKER_DEFINITIONS,
  EXPORT_OWNER_UNAVAILABLE_BLOCKER_CODES,
  type BreakdownBookId,
  type ModuleInstanceStatus,
} from '../../src/shared/domain';

const bookId = 'book-export-calculator' as BreakdownBookId;

describe('Export status calculator', () => {
  it('returns the execution and structure blockers before a structure is frozen', () => {
    const status = calculateExportStatus({
      bookId,
      structure: { status: 'not_frozen', structureEdition: null },
      moduleInstances: [],
    });

    expect(status.targets.map(({ kind, availability, blockers }) => ({
      kind,
      availability,
      blockers,
    }))).toEqual([
      {
        kind: 'markdown_package',
        availability: 'blocked',
        blockers: [
          'export_execution_not_admitted',
          'structure_not_frozen',
          ...EXPORT_OWNER_UNAVAILABLE_BLOCKER_CODES,
        ],
      },
      {
        kind: 'machine_package',
        availability: 'unavailable',
        blockers: [
          'export_execution_not_admitted',
          'structure_not_frozen',
          ...EXPORT_OWNER_UNAVAILABLE_BLOCKER_CODES,
        ],
      },
    ]);
    expect(status.targets[0].preview.moduleInstances).toMatchObject({
      expectedCount: 7,
      actualCount: 0,
      nonEmptyBodyCount: 0,
    });
  });

  it('summarizes admitted module statuses and non-empty Markdown bodies in stable blocker order', () => {
    const statuses: ModuleInstanceStatus[] = [
      'not_generated',
      'generated_pending_review',
      'confirmed',
      'stale',
      'needs_rebuild',
      'confirmed',
      'confirmed',
    ];
    const status = calculateExportStatus({
      bookId,
      structure: { status: 'frozen', structureEdition: 3 },
      moduleInstances: ANALYSIS_MODULE_DEFINITIONS.map((definition, index) => ({
        moduleId: definition.id,
        status: statuses[index],
        bodyMarkdown: index === 6 ? '  ' : `Body ${index}`,
      })),
    });

    expect(status.targets[0].blockers).toEqual([
      'export_execution_not_admitted',
      'analysis_module_not_generated',
      'analysis_module_pending_review',
      'analysis_module_stale',
      'analysis_module_needs_rebuild',
      'analysis_module_body_missing',
      ...EXPORT_OWNER_UNAVAILABLE_BLOCKER_CODES,
    ]);
    expect(status.targets[0].preview).toEqual({
      structure: { status: 'frozen', structureEdition: 3 },
      moduleInstances: {
        expectedCount: 7,
        actualCount: 7,
        nonEmptyBodyCount: 6,
        statusCounts: {
          not_generated: 1,
          generated_pending_review: 1,
          confirmed: 3,
          stale: 1,
          needs_rebuild: 1,
        },
      },
    });
    expect(status.targets[1].preview).toEqual(status.targets[0].preview);
  });

  it('never turns confirmed admitted content into executable export availability', () => {
    const status = calculateExportStatus({
      bookId,
      structure: { status: 'frozen', structureEdition: 1 },
      moduleInstances: ANALYSIS_MODULE_DEFINITIONS.map((definition) => ({
        moduleId: definition.id,
        status: 'confirmed',
        bodyMarkdown: `# ${definition.name}`,
      })),
    });

    expect(status.targets).toEqual([
      expect.objectContaining({
        kind: 'markdown_package',
        availability: 'blocked',
        blockers: [
          'export_execution_not_admitted',
          ...EXPORT_OWNER_UNAVAILABLE_BLOCKER_CODES,
        ],
      }),
      expect.objectContaining({
        kind: 'machine_package',
        availability: 'unavailable',
        blockers: [
          'export_execution_not_admitted',
          ...EXPORT_OWNER_UNAVAILABLE_BLOCKER_CODES,
        ],
      }),
    ]);
  });

  it('emits owner unavailability instead of pretending future owner facts exist', () => {
    const status = calculateExportStatus({
      bookId,
      structure: { status: 'frozen', structureEdition: 1 },
      moduleInstances: ANALYSIS_MODULE_DEFINITIONS.map((definition) => ({
        moduleId: definition.id,
        status: 'confirmed',
        bodyMarkdown: `# ${definition.name}`,
      })),
    });
    const futureFactCodes = EXPORT_BLOCKER_DEFINITIONS
      .filter(({ category }) => category === 'future_fact')
      .map(({ code }) => code);

    expect(status.targets.every(({ blockers }) =>
      EXPORT_OWNER_UNAVAILABLE_BLOCKER_CODES.every((code) => blockers.includes(code)),
    )).toBe(true);
    expect(status.targets.every(({ blockers }) =>
      futureFactCodes.every((code) => !blockers.includes(code as never)),
    )).toBe(true);
  });
});
