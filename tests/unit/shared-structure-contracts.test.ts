import { describe, expect, it } from 'vitest';
import * as domain from '../../src/shared/domain';
import { structureSourceSnapshotSchema } from '../../src/shared/contracts/structure';
import { DOMAIN_ERROR_CODES } from '../../src/shared/errors';

const structureDomain = domain as Record<string, unknown>;

describe('shared structure candidate contracts', () => {
  it('parses structure wire data through the structure-owned schema', () => {
    expect(structureSourceSnapshotSchema.safeParse({
      sourceTextId: 'source-1',
      sourceTextEdition: 1,
      contentHash: 'sha256:abc',
      decodedTextLength: 10,
      offsetUnit: 'utf16_code_unit',
    }).success).toBe(true);
  });
  it('uses decoded UTF-16 end-exclusive offsets and preserves distinct heading spans', () => {
    expect(structureDomain.STRUCTURE_OFFSET_UNIT).toBe('utf16_code_unit');
    expect(structureDomain.STRUCTURE_OFFSET_RANGE_BOUNDARY).toEqual({
      start: 'inclusive',
      end: 'exclusive',
    });
    expect(structureDomain.STRUCTURE_HEADING_SPAN_POLICY).toEqual({
      rawHeadingTextMatches: 'headingStartOffset_headingEndOffset',
      nodeCoverageMatches: 'startOffset_endOffset',
      newlineNormalization: 'preserve_crlf_lf',
      bomHandling: 'remove_after_decode',
    });
  });

  it('keeps candidate, draft, and frozen sets distinct while retaining global identities', () => {
    expect(structureDomain.STRUCTURE_SET_STAGES).toEqual([
      'candidate',
      'draft',
      'frozen',
    ]);
    expect(structureDomain.STRUCTURE_IDENTITY_POLICY).toEqual({
      nodeIds: 'globally_unique',
      storySegmentRangeIds: 'globally_unique',
      draftClone: 'new_id_with_origin_id',
      freeze: 'seal_draft_in_place',
      unfreeze: 'new_draft_ids_with_origin_id',
      scopeRefTargets: 'frozen_only',
    });
  });

  it('requires every low-confidence item to be accepted or corrected before freeze', () => {
    expect(structureDomain.STRUCTURE_CONFIDENCE_LEVELS).toEqual([
      'high',
      'medium',
      'low',
      'unusable',
    ]);
    expect(structureDomain.STRUCTURE_LOW_CONFIDENCE_RESOLUTIONS).toEqual([
      'unresolved',
      'accepted',
      'corrected',
    ]);
    expect(structureDomain.STRUCTURE_STORY_RANGE_MODES).toEqual([
      'included',
      'skipped_by_user',
    ]);
  });

  it('binds detection runs to visible Job checkpoints instead of replacing Job lifecycle', () => {
    expect(structureDomain.STRUCTURE_DETECTION_RUN_STATES).toEqual([
      'queued',
      'running',
      'completed',
      'failed',
    ]);
    expect(structureDomain.STRUCTURE_JOB_CHECKPOINT_KINDS).toEqual([
      'structure_draft',
      'structure_edition',
    ]);
    expect(structureDomain.STRUCTURE_DETECTION_JOB_LIFECYCLE_POLICY).toEqual({
      detectionRunJobId: 'required',
      queued: 'queued',
      running: 'running',
      completed: 'completed',
      failed: 'failed',
      cancellation: 'persist_cancelled_job_and_failed_run_then_abort_utility_process',
      failureImportEffect: 'preserve_successful_source_import',
    });
    expect(DOMAIN_ERROR_CODES).toContain('STRUCTURE_ERROR');
  });
});
