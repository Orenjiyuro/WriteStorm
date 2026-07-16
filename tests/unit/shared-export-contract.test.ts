import { describe, expect, it } from 'vitest';
import { exportStatusSchema, type ExportStatusDto } from '../../src/shared/contracts';
import {
  EXPORT_BLOCKER_DEFINITIONS,
  EXPORT_EXCLUDED_CONTENT_POLICY,
  EXPORT_EXCLUDED_CONTENT_KINDS,
  EXPORT_OWNER_KINDS,
  EXPORT_OWNER_RUNTIME_POLICY,
  EXPORT_OWNER_UNAVAILABLE_BLOCKER_CODES,
  EXPORT_RUNTIME_BLOCKER_CODES,
  EXPORT_TARGET_AVAILABILITIES,
  EXPORT_TARGET_KINDS,
  type BreakdownBookId,
  type ExportAvailability,
  type ExportBlockerCode,
  type ExportOwnerAvailability,
} from '../../src/shared/domain';

const bookId = 'book-export-contract' as BreakdownBookId;
const targetAvailability: ExportAvailability = 'blocked';
const ownerAvailability: ExportOwnerAvailability = 'available';
const futureBlocker: ExportBlockerCode = 'review_asset_unreviewed';

// @ts-expect-error Export targets do not report executable availability in Block 11.
const executableTargetAvailability: ExportAvailability = 'available';

// @ts-expect-error Owner participation is separate from target blocked/unavailable state.
const blockedOwnerAvailability: ExportOwnerAvailability = 'blocked';

const status = {
  bookId,
  targets: [
    {
      kind: 'markdown_package',
      availability: 'blocked',
      blockers: [
        'export_execution_not_admitted',
        'analysis_module_not_generated',
        'analysis_module_body_missing',
        'review_asset_owner_unavailable',
        'evidence_anchor_owner_unavailable',
        'technique_asset_owner_unavailable',
        'perspective_view_owner_unavailable',
        'completion_gate_owner_unavailable',
      ],
      preview: {
        structure: {
          status: 'frozen',
          structureEdition: 1,
        },
        moduleInstances: {
          expectedCount: 7,
          actualCount: 7,
          nonEmptyBodyCount: 0,
          statusCounts: {
            not_generated: 7,
            generated_pending_review: 0,
            confirmed: 0,
            stale: 0,
            needs_rebuild: 0,
          },
        },
      },
    },
    {
      kind: 'machine_package',
      availability: 'unavailable',
      blockers: [
        'export_execution_not_admitted',
        'analysis_module_not_generated',
        'analysis_module_body_missing',
        'review_asset_owner_unavailable',
        'evidence_anchor_owner_unavailable',
        'technique_asset_owner_unavailable',
        'perspective_view_owner_unavailable',
        'completion_gate_owner_unavailable',
      ],
      preview: {
        structure: {
          status: 'frozen',
          structureEdition: 1,
        },
        moduleInstances: {
          expectedCount: 7,
          actualCount: 7,
          nonEmptyBodyCount: 0,
          statusCounts: {
            not_generated: 7,
            generated_pending_review: 0,
            confirmed: 0,
            stale: 0,
            needs_rebuild: 0,
          },
        },
      },
    },
  ],
  owners: [...EXPORT_OWNER_RUNTIME_POLICY],
  excludedContent: [...EXPORT_EXCLUDED_CONTENT_KINDS],
} satisfies ExportStatusDto;

describe('Export blocked-state contract', () => {
  it('separates target availability from owner participation', () => {
    expect(EXPORT_TARGET_AVAILABILITIES).toEqual(['blocked', 'unavailable']);
    expect(targetAvailability).toBe('blocked');
    expect(ownerAvailability).toBe('available');
    expect(executableTargetAvailability).toBe('available');
    expect(blockedOwnerAvailability).toBe('blocked');
  });

  it('freezes stable target, owner, and exclusion order', () => {
    expect(EXPORT_TARGET_KINDS).toEqual(['markdown_package', 'machine_package']);
    expect(EXPORT_OWNER_KINDS).toEqual([
      'book',
      'structure',
      'analysis_modules',
      'review_assets',
      'evidence_anchors',
      'technique_assets',
      'perspective_views',
      'completion_gate',
    ]);
    expect(EXPORT_EXCLUDED_CONTENT_KINDS).toEqual([
      'credentials',
      'authentication_tokens',
      'secret_keys',
      'secure_storage',
      'full_sensitive_logs',
    ]);
    expect(EXPORT_EXCLUDED_CONTENT_POLICY).toEqual(
      EXPORT_EXCLUDED_CONTENT_KINDS.map((kind) => ({
        kind,
        access: 'never_read',
        dtoParticipation: 'exclusion_marker_only',
      })),
    );
  });

  it('keeps future blocker vocabulary separate from runtime-emittable blockers', () => {
    expect(futureBlocker).toBe('review_asset_unreviewed');
    expect(EXPORT_BLOCKER_DEFINITIONS.map(({ code }) => code)).toEqual([
      'export_execution_not_admitted',
      'structure_not_frozen',
      'analysis_module_not_generated',
      'analysis_module_pending_review',
      'analysis_module_stale',
      'analysis_module_needs_rebuild',
      'analysis_module_body_missing',
      'review_asset_unreviewed',
      'evidence_insufficient',
      'technique_candidate_not_adopted',
      'perspective_partial',
      'perspective_stale',
      'completion_gate_not_satisfied',
      'review_asset_owner_unavailable',
      'evidence_anchor_owner_unavailable',
      'technique_asset_owner_unavailable',
      'perspective_view_owner_unavailable',
      'completion_gate_owner_unavailable',
    ]);
    expect(EXPORT_BLOCKER_DEFINITIONS.find(
      ({ code }) => code === futureBlocker,
    )).toMatchObject({
      category: 'future_fact',
      runtimeEmittable: false,
    });
    expect(EXPORT_RUNTIME_BLOCKER_CODES).toEqual(
      EXPORT_BLOCKER_DEFINITIONS
        .filter(({ runtimeEmittable }) => runtimeEmittable)
        .map(({ code }) => code),
    );
    expect(EXPORT_OWNER_UNAVAILABLE_BLOCKER_CODES).toEqual([
      'review_asset_owner_unavailable',
      'evidence_anchor_owner_unavailable',
      'technique_asset_owner_unavailable',
      'perspective_view_owner_unavailable',
      'completion_gate_owner_unavailable',
    ]);
    expect(EXPORT_RUNTIME_BLOCKER_CODES).not.toContain(futureBlocker);
    expect(EXPORT_RUNTIME_BLOCKER_CODES).toContain('export_execution_not_admitted');
  });

  it('requires both targets to remain execution-blocked without record or Job fields', () => {
    expect(exportStatusSchema.parse(status)).toEqual(status);
    expect(status.targets.every(
      ({ blockers }) => blockers.includes('export_execution_not_admitted'),
    )).toBe(true);

    expect(exportStatusSchema.safeParse({
      ...status,
      exportId: 'export-record',
      latestJobId: 'export-job',
      updatedAt: '2026-07-16T00:00:00.000Z',
    }).success).toBe(false);
    expect(exportStatusSchema.safeParse({
      ...status,
      targets: status.targets.map((target) => ({
        ...target,
        blockers: target.blockers.filter(
          (blocker) => blocker !== 'export_execution_not_admitted',
        ),
      })),
    }).success).toBe(false);
  });

  it('rejects target availability outside the frozen runtime matrix', () => {
    expect(exportStatusSchema.safeParse({
      ...status,
      targets: status.targets.map((target) => ({
        ...target,
        availability: target.kind === 'markdown_package' ? 'unavailable' : 'blocked',
      })),
    }).success).toBe(false);
  });

  it('rejects preview module counts outside the authoritative runtime matrix', () => {
    const impossibleFrozenPreview = {
      structure: {
        status: 'frozen' as const,
        structureEdition: 1,
      },
      moduleInstances: {
        expectedCount: 8,
        actualCount: 7,
        nonEmptyBodyCount: 7,
        statusCounts: {
          not_generated: 0,
          generated_pending_review: 0,
          confirmed: 7,
          stale: 0,
          needs_rebuild: 0,
        },
      },
    };
    const impossibleNotFrozenPreview = {
      structure: {
        status: 'not_frozen' as const,
        structureEdition: null,
      },
      moduleInstances: {
        expectedCount: 7,
        actualCount: 1,
        nonEmptyBodyCount: 1,
        statusCounts: {
          not_generated: 0,
          generated_pending_review: 0,
          confirmed: 1,
          stale: 0,
          needs_rebuild: 0,
        },
      },
    };

    expect(exportStatusSchema.safeParse({
      ...status,
      targets: status.targets.map((target) => ({
        ...target,
        blockers: [
          'export_execution_not_admitted',
          ...EXPORT_OWNER_UNAVAILABLE_BLOCKER_CODES,
        ],
        preview: impossibleFrozenPreview,
      })),
    }).success).toBe(false);
    expect(exportStatusSchema.safeParse({
      ...status,
      targets: status.targets.map((target) => ({
        ...target,
        blockers: [
          'export_execution_not_admitted',
          'structure_not_frozen',
          ...EXPORT_OWNER_UNAVAILABLE_BLOCKER_CODES,
        ],
        preview: impossibleNotFrozenPreview,
      })),
    }).success).toBe(false);
  });

  it('rejects targets that describe different SQLite preview facts', () => {
    expect(exportStatusSchema.safeParse({
      ...status,
      targets: [
        status.targets[0],
        {
          ...status.targets[1],
          blockers: [
            'export_execution_not_admitted',
            'structure_not_frozen',
            ...EXPORT_OWNER_UNAVAILABLE_BLOCKER_CODES,
          ],
          preview: {
            structure: {
              status: 'not_frozen',
              structureEdition: null,
            },
            moduleInstances: {
              expectedCount: 7,
              actualCount: 0,
              nonEmptyBodyCount: 0,
              statusCounts: {
                not_generated: 0,
                generated_pending_review: 0,
                confirmed: 0,
                stale: 0,
                needs_rebuild: 0,
              },
            },
          },
        },
      ],
    }).success).toBe(false);
  });

  it('rejects blockers that disagree with the preview facts', () => {
    expect(exportStatusSchema.safeParse({
      ...status,
      targets: status.targets.map((target) => ({
        ...target,
        blockers: target.blockers.filter(
          (blocker) => blocker !== 'analysis_module_body_missing',
        ),
      })),
    }).success).toBe(false);
    expect(exportStatusSchema.safeParse({
      ...status,
      targets: status.targets.map((target) => ({
        ...target,
        blockers: [
          ...target.blockers.slice(0, 3),
          'analysis_module_pending_review',
          ...target.blockers.slice(3),
        ],
      })),
    }).success).toBe(false);
  });

  it('rejects future facts and sensitive/path-bearing preview fields from runtime DTOs', () => {
    expect(exportStatusSchema.safeParse({
      ...status,
      targets: [{
        ...status.targets[0],
        blockers: ['export_execution_not_admitted', futureBlocker],
      }, status.targets[1]],
    }).success).toBe(false);
    expect(exportStatusSchema.safeParse({
      ...status,
      targets: [{
        ...status.targets[0],
        preview: {
          ...status.targets[0].preview,
          rootPath: 'C:\\library',
          token: 'secret',
          logBody: 'sensitive log',
        },
      }, status.targets[1]],
    }).success).toBe(false);
    expect(exportStatusSchema.safeParse({
      ...status,
      owners: status.owners.map((owner) => owner.ownerKind === 'review_assets'
        ? { ...owner, reason: 'review_asset_unreviewed' }
        : owner),
    }).success).toBe(false);
    expect(exportStatusSchema.safeParse({
      ...status,
      targets: status.targets.map((target) => ({
        ...target,
        blockers: target.blockers.filter(
          (blocker) => blocker !== 'review_asset_owner_unavailable',
        ),
      })),
    }).success).toBe(false);
  });
});
