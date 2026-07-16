import {
  exportStatusSchema,
  type ExportStatusDto,
} from '../../shared/contracts';
import {
  ANALYSIS_MODULE_DEFINITIONS,
  EXPORT_EXCLUDED_CONTENT_POLICY,
  EXPORT_OWNER_RUNTIME_POLICY,
  EXPORT_TARGET_RUNTIME_POLICY,
  MODULE_INSTANCE_STATUSES,
  deriveExportRuntimeBlockers,
  type BreakdownBookId,
  type ExportStructurePreview,
  type ModuleInstanceStatus,
} from '../../shared/domain';
import type { ExportModuleFact } from './export-status-repository';

export function calculateExportStatus(input: {
  readonly bookId: BreakdownBookId;
  readonly structure: ExportStructurePreview;
  readonly moduleInstances: readonly ExportModuleFact[];
}): ExportStatusDto {
  const statusCounts = createEmptyStatusCounts();
  let nonEmptyBodyCount = 0;

  for (const instance of input.moduleInstances) {
    statusCounts[instance.status] += 1;
    if (instance.bodyMarkdown.trim().length > 0) nonEmptyBodyCount += 1;
  }

  const preview = {
    structure: input.structure,
    moduleInstances: {
      expectedCount: ANALYSIS_MODULE_DEFINITIONS.length,
      actualCount: input.moduleInstances.length,
      nonEmptyBodyCount,
      statusCounts,
    },
  };
  const blockers = deriveExportRuntimeBlockers(preview);

  return exportStatusSchema.parse({
    bookId: input.bookId,
    targets: EXPORT_TARGET_RUNTIME_POLICY.map(({ kind, availability }) => ({
      kind,
      availability,
      blockers,
      preview,
    })),
    owners: EXPORT_OWNER_RUNTIME_POLICY,
    excludedContent: EXPORT_EXCLUDED_CONTENT_POLICY.map(({ kind }) => kind),
  });
}

function createEmptyStatusCounts(): Record<ModuleInstanceStatus, number> {
  return Object.fromEntries(
    MODULE_INSTANCE_STATUSES.map((status) => [status, 0]),
  ) as Record<ModuleInstanceStatus, number>;
}
