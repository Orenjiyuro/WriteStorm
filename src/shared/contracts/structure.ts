import { z } from 'zod';
import { STRUCTURE_NODE_KINDS } from '../domain/status';
import { bookRequestSchema } from './books';
import {
  breakdownBookIdSchema,
  domainErrorSchema,
  isoDateTimeStringSchema,
  jobIdSchema,
  sourceTextIdSchema,
  storySegmentRangeIdSchema,
  structureDetectionRunIdSchema,
  structureNodeIdSchema,
  structureSetIdSchema,
} from './common';
import { jobSummarySchema } from './jobs';

const STRUCTURE_OFFSET_UNIT = 'utf16_code_unit' as const;
const STRUCTURE_CONFIDENCE_LEVELS = ['high', 'medium', 'low', 'unusable'] as const;
const STRUCTURE_LOW_CONFIDENCE_RESOLUTIONS = ['unresolved', 'accepted', 'corrected'] as const;
const STRUCTURE_SET_STAGES = ['candidate', 'draft', 'frozen'] as const;
const STRUCTURE_STORY_RANGE_MODES = ['included', 'skipped_by_user'] as const;
const STRUCTURE_DETECTION_RUN_STATES = ['queued', 'running', 'completed', 'failed'] as const;

export const structureSourceSnapshotSchema = z.object({
  sourceTextId: sourceTextIdSchema,
  sourceTextEdition: z.number().int().positive(),
  contentHash: z.string().min(1),
  decodedTextLength: z.number().int().nonnegative(),
  offsetUnit: z.literal(STRUCTURE_OFFSET_UNIT),
}).strict();

export const structureHeadingSpanSchema = z.object({
  rawHeadingText: z.string().min(1),
  headingStartOffset: z.number().int().nonnegative(),
  headingEndOffset: z.number().int().nonnegative(),
}).strict().superRefine((heading, context) => {
  if (heading.headingEndOffset <= heading.headingStartOffset) {
    context.addIssue({
      code: 'custom',
      path: ['headingEndOffset'],
      message: 'headingEndOffset must be greater than headingStartOffset.',
    });
  }
});

export const structureConfidenceSchema = z.object({
  score: z.number().min(0).max(1),
  level: z.enum(STRUCTURE_CONFIDENCE_LEVELS),
  lowConfidenceResolution: z.enum(STRUCTURE_LOW_CONFIDENCE_RESOLUTIONS).nullable(),
}).strict().superRefine((confidence, context) => {
  if (confidence.level === 'low' && confidence.lowConfidenceResolution === null) {
    context.addIssue({
      code: 'custom',
      path: ['lowConfidenceResolution'],
      message: 'Low-confidence items require an explicit review resolution.',
    });
  }

  if (confidence.level !== 'low' && confidence.lowConfidenceResolution !== null) {
    context.addIssue({
      code: 'custom',
      path: ['lowConfidenceResolution'],
      message: 'Only low-confidence items may carry a review resolution.',
    });
  }
});

export const structureSetNodeSchema = z.object({
  id: structureNodeIdSchema,
  originId: structureNodeIdSchema.nullable(),
  kind: z.enum(STRUCTURE_NODE_KINDS),
  title: z.string().min(1),
  parentId: structureNodeIdSchema.nullable(),
  order: z.number().int().nonnegative(),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
  heading: structureHeadingSpanSchema.nullable(),
  confidence: structureConfidenceSchema,
}).strict().superRefine((node, context) => {
  if (node.endOffset <= node.startOffset) {
    context.addIssue({
      code: 'custom',
      path: ['endOffset'],
      message: 'endOffset must be greater than startOffset.',
    });
  }

  if (node.heading && (
    node.heading.headingStartOffset < node.startOffset ||
    node.heading.headingEndOffset > node.endOffset
  )) {
    context.addIssue({
      code: 'custom',
      path: ['heading'],
      message: 'Heading span must stay inside the node coverage range.',
    });
  }
});

const boundaryEvidenceSchema = z.object({
  kind: z.enum([
    'chapter_window',
    'explicit_separator',
    'blank_line_cluster',
    'markdown_subheading',
    'length_window',
    'transition_hint',
  ]),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
}).strict().superRefine((evidence, context) => {
  if (evidence.endOffset <= evidence.startOffset) {
    context.addIssue({
      code: 'custom',
      path: ['endOffset'],
      message: 'Boundary evidence endOffset must be greater than startOffset.',
    });
  }
});

export const structureSetStoryRangeSchema = z.object({
  id: storySegmentRangeIdSchema,
  originId: storySegmentRangeIdSchema.nullable(),
  title: z.string().min(1),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
  coveredChapterIds: z.array(structureNodeIdSchema).min(1),
  suggestedFunctionTags: z.array(z.string().min(1)),
  boundaryEvidence: z.array(boundaryEvidenceSchema).min(1),
  startReason: z.string().min(1),
  endReason: z.string().min(1),
  confidence: structureConfidenceSchema,
}).strict().superRefine((range, context) => {
  if (range.endOffset <= range.startOffset) {
    context.addIssue({
      code: 'custom',
      path: ['endOffset'],
      message: 'endOffset must be greater than startOffset.',
    });
  }
});

const structureSetBaseSchema = z.object({
  id: structureSetIdSchema,
  bookId: breakdownBookIdSchema,
  sourceSnapshot: structureSourceSnapshotSchema,
  nodes: z.array(structureSetNodeSchema),
  storyRanges: z.array(structureSetStoryRangeSchema),
  storyRangeMode: z.enum(STRUCTURE_STORY_RANGE_MODES),
  createdAt: isoDateTimeStringSchema,
  updatedAt: isoDateTimeStringSchema,
}).strict().superRefine((set, context) => {
  if (set.storyRangeMode === 'skipped_by_user' && set.storyRanges.length > 0) {
    context.addIssue({
      code: 'custom',
      path: ['storyRanges'],
      message: 'Skipped story range mode cannot retain story ranges.',
    });
  }
});

export const candidateStructureSetSchema = structureSetBaseSchema.extend({
  stage: z.literal(STRUCTURE_SET_STAGES[0]),
  detectionRunId: structureDetectionRunIdSchema,
  draftRevision: z.null(),
  structureEdition: z.null(),
}).superRefine((candidate, context) => {
  for (const [collection, items] of [
    ['nodes', candidate.nodes],
    ['storyRanges', candidate.storyRanges],
  ] as const) {
    items.forEach((item, index) => {
      if (item.confidence.level === 'unusable') {
        context.addIssue({
          code: 'custom',
          path: [collection, index, 'confidence', 'level'],
          message: 'Unusable structure items cannot enter ordinary candidate success.',
        });
      }
    });
  }
});

export const draftStructureSetSchema = structureSetBaseSchema.extend({
  stage: z.literal(STRUCTURE_SET_STAGES[1]),
  detectionRunId: z.null(),
  draftRevision: z.number().int().nonnegative(),
  structureEdition: z.null(),
});

export const frozenStructureSetSchema = structureSetBaseSchema.extend({
  stage: z.literal(STRUCTURE_SET_STAGES[2]),
  detectionRunId: z.null(),
  draftRevision: z.null(),
  structureEdition: z.number().int().positive(),
  frozenAt: isoDateTimeStringSchema,
});

export const structureDetectionRunSchema = z.object({
  id: structureDetectionRunIdSchema,
  bookId: breakdownBookIdSchema,
  job: z.object({
    jobId: jobIdSchema,
    checkpointKind: z.literal('structure_draft'),
  }).strict(),
  sourceSnapshot: structureSourceSnapshotSchema,
  state: z.enum(STRUCTURE_DETECTION_RUN_STATES),
  failureReason: z.string().min(1).nullable(),
  createdAt: isoDateTimeStringSchema,
  updatedAt: isoDateTimeStringSchema,
}).strict().superRefine((run, context) => {
  if (run.state === 'failed' && run.failureReason === null) {
    context.addIssue({
      code: 'custom',
      path: ['failureReason'],
      message: 'Failed structure detection runs require a failure reason.',
    });
  }

  if (run.state !== 'failed' && run.failureReason !== null) {
    context.addIssue({
      code: 'custom',
      path: ['failureReason'],
      message: 'Only failed structure detection runs may carry a failure reason.',
    });
  }
});

export const structureWorkspaceSchema = z.object({
  bookId: breakdownBookIdSchema,
  detectionRun: structureDetectionRunSchema.nullable(),
  candidate: candidateStructureSetSchema.nullable(),
  draft: draftStructureSetSchema.nullable(),
  frozen: frozenStructureSetSchema.nullable(),
}).strict().superRefine((workspace, context) => {
  for (const [key, value] of Object.entries({
    detectionRun: workspace.detectionRun,
    candidate: workspace.candidate,
    draft: workspace.draft,
    frozen: workspace.frozen,
  })) {
    if (value && value.bookId !== workspace.bookId) {
      context.addIssue({
        code: 'custom',
        path: [key, 'bookId'],
        message: 'Structure workspace records must belong to the requested book.',
      });
    }
  }
});

export type StructureWorkspace = z.infer<typeof structureWorkspaceSchema>;

export const structureNodeSchema = z.object({
  id: structureNodeIdSchema,
  bookId: breakdownBookIdSchema,
  sourceTextId: sourceTextIdSchema,
  kind: z.enum(STRUCTURE_NODE_KINDS),
  title: z.string().min(1),
  parentId: structureNodeIdSchema.nullable(),
  order: z.number().int().nonnegative(),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative().nullable(),
  structureEdition: z.number().int().positive(),
}).strict().superRefine((node, context) => {
  if (node.endOffset !== null && node.endOffset <= node.startOffset) {
    context.addIssue({
      code: 'custom',
      path: ['endOffset'],
      message: 'endOffset must be null or greater than startOffset.',
    });
  }
});

export type StructureNodeDto = z.infer<typeof structureNodeSchema>;

export const storySegmentRangeSchema = z.object({
  id: storySegmentRangeIdSchema,
  bookId: breakdownBookIdSchema,
  sourceTextId: sourceTextIdSchema,
  title: z.string().min(1),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
  coveredChapterIds: z.array(structureNodeIdSchema).min(1),
  functionTags: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1),
  structureEdition: z.number().int().positive(),
}).strict().superRefine((range, context) => {
  if (range.endOffset <= range.startOffset) {
    context.addIssue({
      code: 'custom',
      path: ['endOffset'],
      message: 'endOffset must be greater than startOffset.',
    });
  }
});

export type StorySegmentRangeDto = z.infer<typeof storySegmentRangeSchema>;

export const structureDetectionStartResultSchema = z.object({
  detectionRun: structureDetectionRunSchema,
  job: jobSummarySchema,
}).strict();

export type StructureDetectionStartResult = z.infer<
  typeof structureDetectionStartResultSchema
>;

export const STRUCTURE_DETECTION_ERROR_REASONS = [
  'no_current_library',
  'book_not_found',
  'source_missing',
  'source_encoding_invalid',
  'source_read_failed',
  'source_decode_failed',
  'source_hash_mismatch',
  'library_session_changed',
  'source_snapshot_stale',
  'structure_detection_in_progress',
  'structure_detection_recovery_required',
  'structure_validation_failed',
  'candidate_persistence_failed',
  'structure_worker_failed',
  'UTILITY_WORKER_TIMEOUT',
  'UTILITY_WORKER_CRASH',
  'UTILITY_WORKER_CANCELLED',
  'UTILITY_WORKER_PROTOCOL',
  'UTILITY_WORKER_DISPOSED',
] as const;

export const structureDetectionErrorReasonSchema = z.enum(
  STRUCTURE_DETECTION_ERROR_REASONS,
);
export const structureDetectionErrorDetailsSchema = z.object({
  reason: structureDetectionErrorReasonSchema,
}).strict();

const structureDetectionDomainErrorSchema = domainErrorSchema.superRefine((error, context) => {
  if (error.code !== 'STRUCTURE_ERROR') {
    return;
  }

  if (!structureDetectionErrorDetailsSchema.safeParse(error.details).success) {
    context.addIssue({
      code: 'custom',
      path: ['details'],
      message: 'STRUCTURE_ERROR details must include a stable structure detection reason.',
    });
  }
});

export const structureDetectionResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    data: structureDetectionStartResultSchema,
  }).strict(),
  z.object({
    ok: z.literal(false),
    error: structureDetectionDomainErrorSchema,
  }).strict(),
]);

export const structureDetectionRequestSchema = bookRequestSchema;

export const updateStructureNodeRequestSchema = z.object({
  nodeId: structureNodeIdSchema,
  patch: z.object({
    title: z.string().min(1).optional(),
    parentId: structureNodeIdSchema.nullable().optional(),
    order: z.number().int().nonnegative().optional(),
    startOffset: z.number().int().nonnegative().optional(),
    endOffset: z.number().int().nonnegative().nullable().optional(),
  }).strict().superRefine((patch, context) => {
    if (
      patch.startOffset !== undefined &&
      patch.endOffset !== undefined &&
      patch.endOffset !== null &&
      patch.endOffset <= patch.startOffset
    ) {
      context.addIssue({
        code: 'custom',
        path: ['endOffset'],
        message: 'endOffset must be null or greater than startOffset when both offsets are patched.',
      });
    }
  }),
}).strict();

export const updateStorySegmentRangeRequestSchema = z.object({
  rangeId: storySegmentRangeIdSchema,
  patch: z.object({
    title: z.string().min(1).optional(),
    startOffset: z.number().int().nonnegative().optional(),
    endOffset: z.number().int().nonnegative().optional(),
    coveredChapterIds: z.array(structureNodeIdSchema).min(1).optional(),
    functionTags: z.array(z.string().min(1)).optional(),
    confidence: z.number().min(0).max(1).optional(),
  }).strict().superRefine((patch, context) => {
    if (
      patch.startOffset !== undefined &&
      patch.endOffset !== undefined &&
      patch.endOffset <= patch.startOffset
    ) {
      context.addIssue({
        code: 'custom',
        path: ['endOffset'],
        message: 'endOffset must be greater than startOffset when both offsets are patched.',
      });
    }
  }),
}).strict();

export const freezeStructureResponseDataSchema = z.object({
  bookId: breakdownBookIdSchema,
  structureEdition: z.number().int().positive(),
}).strict();
