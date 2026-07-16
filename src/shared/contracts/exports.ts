import { z } from 'zod';
import {
  EXPORT_EXCLUDED_CONTENT_KINDS,
  EXPORT_OWNER_AVAILABILITIES,
  EXPORT_OWNER_KINDS,
  EXPORT_OWNER_RUNTIME_POLICY,
  EXPORT_OWNER_UNAVAILABLE_BLOCKER_CODES,
  EXPORT_RUNTIME_BLOCKER_CODES,
  EXPORT_TARGET_AVAILABILITIES,
  EXPORT_TARGET_KINDS,
  EXPORT_TARGET_RUNTIME_POLICY,
  deriveExportRuntimeBlockers,
} from '../domain/export';
import { ANALYSIS_MODULE_KEYS } from '../domain/analysis';
import { MODULE_INSTANCE_STATUSES } from '../domain/status';
import { breakdownBookIdSchema } from './common';

const AUTHORITATIVE_MODULE_COUNT = ANALYSIS_MODULE_KEYS.length;

export const exportTargetKindSchema = z.enum(EXPORT_TARGET_KINDS);
export const exportAvailabilitySchema = z.enum(EXPORT_TARGET_AVAILABILITIES);
export const exportOwnerKindSchema = z.enum(EXPORT_OWNER_KINDS);
export const exportOwnerAvailabilitySchema = z.enum(EXPORT_OWNER_AVAILABILITIES);
export const exportRuntimeBlockerCodeSchema = z.enum(EXPORT_RUNTIME_BLOCKER_CODES);
export const exportExcludedContentKindSchema = z.enum(EXPORT_EXCLUDED_CONTENT_KINDS);

const exportModuleStatusCountsSchema = z.object(
  Object.fromEntries(
    MODULE_INSTANCE_STATUSES.map((status) => [status, z.number().int().nonnegative()]),
  ) as Record<(typeof MODULE_INSTANCE_STATUSES)[number], z.ZodNumber>,
).strict();

const exportStructurePreviewSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('frozen'),
    structureEdition: z.number().int().positive(),
  }).strict(),
  z.object({
    status: z.literal('not_frozen'),
    structureEdition: z.null(),
  }).strict(),
]);

export const exportTargetPreviewSchema = z.object({
  structure: exportStructurePreviewSchema,
  moduleInstances: z.object({
    expectedCount: z.number().int().nonnegative(),
    actualCount: z.number().int().nonnegative(),
    nonEmptyBodyCount: z.number().int().nonnegative(),
    statusCounts: exportModuleStatusCountsSchema,
  }).strict(),
}).strict().superRefine((preview, context) => {
  if (preview.moduleInstances.expectedCount !== AUTHORITATIVE_MODULE_COUNT) {
    context.addIssue({
      code: 'custom',
      path: ['moduleInstances', 'expectedCount'],
      message: `expectedCount must equal the authoritative ${AUTHORITATIVE_MODULE_COUNT} modules.`,
    });
  }
  const statusTotal = Object.values(preview.moduleInstances.statusCounts)
    .reduce((total, count) => total + count, 0);
  if (statusTotal !== preview.moduleInstances.actualCount) {
    context.addIssue({
      code: 'custom',
      path: ['moduleInstances', 'statusCounts'],
      message: 'Module status counts must equal actualCount.',
    });
  }
  if (preview.moduleInstances.nonEmptyBodyCount > preview.moduleInstances.actualCount) {
    context.addIssue({
      code: 'custom',
      path: ['moduleInstances', 'nonEmptyBodyCount'],
      message: 'nonEmptyBodyCount cannot exceed actualCount.',
    });
  }
  if (preview.structure.status === 'not_frozen') {
    if (
      preview.moduleInstances.actualCount !== 0 ||
      preview.moduleInstances.nonEmptyBodyCount !== 0 ||
      statusTotal !== 0
    ) {
      context.addIssue({
        code: 'custom',
        path: ['moduleInstances'],
        message: 'A not-frozen Book must not report module instance facts.',
      });
    }
  } else if (preview.moduleInstances.actualCount !== AUTHORITATIVE_MODULE_COUNT) {
    context.addIssue({
      code: 'custom',
      path: ['moduleInstances', 'actualCount'],
      message: `A frozen Book must report all ${AUTHORITATIVE_MODULE_COUNT} module instances.`,
    });
  }
});

export const exportTargetStatusSchema = z.object({
  kind: exportTargetKindSchema,
  availability: exportAvailabilitySchema,
  blockers: z.array(exportRuntimeBlockerCodeSchema),
  preview: exportTargetPreviewSchema,
}).strict().superRefine((target, context) => {
  if (!target.blockers.includes('export_execution_not_admitted')) {
    context.addIssue({
      code: 'custom',
      path: ['blockers'],
      message: 'Block 11 targets must include export_execution_not_admitted.',
    });
  }
  let previousIndex = -1;
  for (const blocker of target.blockers) {
    const currentIndex = EXPORT_RUNTIME_BLOCKER_CODES.indexOf(blocker);
    if (currentIndex <= previousIndex) {
      context.addIssue({
        code: 'custom',
        path: ['blockers'],
        message: 'Export blockers must be unique and use stable contract order.',
      });
      break;
    }
    previousIndex = currentIndex;
  }
});

export const exportOwnerParticipationSchema = z.discriminatedUnion('availability', [
  z.object({
    ownerKind: exportOwnerKindSchema,
    availability: z.literal('available'),
    reason: z.null(),
  }).strict(),
  z.object({
    ownerKind: exportOwnerKindSchema,
    availability: z.literal('unavailable'),
    reason: z.enum(EXPORT_OWNER_UNAVAILABLE_BLOCKER_CODES),
  }).strict(),
]);

export const exportStatusSchema = z.object({
  bookId: breakdownBookIdSchema,
  targets: z.array(exportTargetStatusSchema),
  owners: z.array(exportOwnerParticipationSchema),
  excludedContent: z.array(exportExcludedContentKindSchema),
}).strict().superRefine((status, context) => {
  if (!matchesTargetRuntimePolicy(status.targets)) {
    context.addIssue({
      code: 'custom',
      path: ['targets'],
      message: 'Export targets must match the Block 11 runtime availability policy.',
    });
  }
  if (!matchesSharedTargetPreview(status.targets)) {
    context.addIssue({
      code: 'custom',
      path: ['targets'],
      message: 'Export targets must share the same Book preview facts.',
    });
  }
  if (!matchesOrderedOwnerPolicy(status.owners)) {
    context.addIssue({
      code: 'custom',
      path: ['owners'],
      message: 'Export owners must match the Block 11 runtime admission policy.',
    });
  }
  for (const [targetIndex, target] of status.targets.entries()) {
    const expectedBlockers = deriveExportRuntimeBlockers(target.preview);
    if (!matchesOrderedValues(target.blockers, expectedBlockers)) {
      context.addIssue({
        code: 'custom',
        path: ['targets', targetIndex, 'blockers'],
        message: 'Export target blockers must exactly match the preview facts and owner policy.',
      });
    }
  }
  if (!matchesOrderedValues(status.excludedContent, EXPORT_EXCLUDED_CONTENT_KINDS)) {
    context.addIssue({
      code: 'custom',
      path: ['excludedContent'],
      message: 'Excluded content must use stable contract order.',
    });
  }
});

export type ExportStatusDto = z.infer<typeof exportStatusSchema>;

function matchesOrderedValues<TValue>(
  actual: readonly TValue[],
  expected: readonly TValue[],
): boolean {
  return actual.length === expected.length &&
    actual.every((value, index) => value === expected[index]);
}

function matchesOrderedOwnerPolicy(
  owners: readonly z.infer<typeof exportOwnerParticipationSchema>[],
): boolean {
  return owners.length === EXPORT_OWNER_RUNTIME_POLICY.length &&
    owners.every((owner, index) => {
      const expected = EXPORT_OWNER_RUNTIME_POLICY[index];
      return owner.ownerKind === expected.ownerKind &&
        owner.availability === expected.availability &&
        owner.reason === expected.reason;
    });
}

function matchesTargetRuntimePolicy(
  targets: readonly z.infer<typeof exportTargetStatusSchema>[],
): boolean {
  return targets.length === EXPORT_TARGET_RUNTIME_POLICY.length &&
    targets.every((target, index) => {
      const expected = EXPORT_TARGET_RUNTIME_POLICY[index];
      return target.kind === expected.kind &&
        target.availability === expected.availability;
    });
}

function matchesSharedTargetPreview(
  targets: readonly z.infer<typeof exportTargetStatusSchema>[],
): boolean {
  if (targets.length !== EXPORT_TARGET_RUNTIME_POLICY.length) return false;
  const [first, ...remaining] = targets;
  return remaining.every(({ preview }) => (
    preview.structure.status === first.preview.structure.status &&
    preview.structure.structureEdition === first.preview.structure.structureEdition &&
    preview.moduleInstances.expectedCount === first.preview.moduleInstances.expectedCount &&
    preview.moduleInstances.actualCount === first.preview.moduleInstances.actualCount &&
    preview.moduleInstances.nonEmptyBodyCount ===
      first.preview.moduleInstances.nonEmptyBodyCount &&
    MODULE_INSTANCE_STATUSES.every(
      (moduleStatus) => preview.moduleInstances.statusCounts[moduleStatus] ===
        first.preview.moduleInstances.statusCounts[moduleStatus],
    )
  ));
}
