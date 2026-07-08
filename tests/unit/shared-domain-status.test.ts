import { describe, expect, it } from 'vitest';
import {
  JOB_STATES,
  MODULE_INSTANCE_STATUSES,
  SCOPE_KINDS,
  STRUCTURE_NODE_KINDS,
} from '../../src/shared/domain';
import type {
  JobState,
  ModuleInstanceStatus,
  ScopeKind,
  StructureNodeKind,
} from '../../src/shared/domain';

const structureNodeKind: StructureNodeKind = 'chapter';
const scopeKind: ScopeKind = 'story_segment_range';
const jobState: JobState = 'resumable';
const moduleInstanceStatus: ModuleInstanceStatus = 'generated_pending_review';

// @ts-expect-error Story ranges are scopes, not title-tree structure nodes.
const invalidStructureNodeKind: StructureNodeKind = 'story_segment_range';

// @ts-expect-error Scope terminology is story_segment_range, not story_segment.
const invalidScopeKind: ScopeKind = 'story_segment';

// @ts-expect-error V1 JobState excludes estimation and waiting-confirmation states.
const invalidJobState: JobState = 'estimating';

// @ts-expect-error Module instances use generated_pending_review, not pending_review.
const invalidModuleInstanceStatus: ModuleInstanceStatus = 'pending_review';

describe('shared domain status unions', () => {
  it('keeps structure node kinds limited to the title tree', () => {
    expect(structureNodeKind).toBe('chapter');
    expect(STRUCTURE_NODE_KINDS).toEqual(['book', 'volume', 'chapter']);
  });

  it('keeps analysis scope kinds aligned with module instances', () => {
    expect(scopeKind).toBe('story_segment_range');
    expect(SCOPE_KINDS).toEqual(['book', 'volume', 'chapter', 'story_segment_range']);
  });

  it('keeps job states aligned with the technical design recovery model', () => {
    expect(jobState).toBe('resumable');
    expect(JOB_STATES).toEqual([
      'queued',
      'running',
      'paused',
      'failed',
      'resumable',
      'cancelled',
      'completed',
    ]);
  });

  it('keeps module instance statuses separate from job and book status', () => {
    expect(moduleInstanceStatus).toBe('generated_pending_review');
    expect(MODULE_INSTANCE_STATUSES).toEqual([
      'not_generated',
      'generated_pending_review',
      'confirmed',
      'stale',
      'needs_rebuild',
    ]);
  });
});
