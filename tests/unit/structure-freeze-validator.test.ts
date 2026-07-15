import { describe, expect, it } from 'vitest';
import { validateDraftForFreeze } from '../../src/main/structure/validation/structure-freeze-validator';
import type {
  BreakdownBookId, DraftStructureSet, SourceTextId, StructureNodeId, StructureSetId,
} from '../../src/shared/domain';

describe('structure freeze validator', () => {
  it('accepts a fresh coherent draft without mutating the aggregate', () => {
    const fixture = freezeFixture();
    const before = structuredClone(fixture.draft);
    expect(validateDraftForFreeze({
      draft: fixture.draft,
      currentSourceSnapshot: fixture.draft.sourceSnapshot,
      sourceText: fixture.sourceText,
    })).toEqual({ valid: true, stale: false, issues: [] });
    expect(fixture.draft).toEqual(before);
  });

  it('blocks stale, unresolved-low-confidence, and malformed drafts with stable issues', () => {
    const fixture = freezeFixture();
    fixture.draft.nodes[1].confidence = {
      score: 0.4, level: 'low', lowConfidenceResolution: 'unresolved',
    };
    fixture.draft.nodes[1].endOffset = fixture.sourceText.length + 1;
    const result = validateDraftForFreeze({
      draft: fixture.draft,
      currentSourceSnapshot: {
        ...fixture.draft.sourceSnapshot,
        sourceTextEdition: 2,
        contentHash: 'sha256:changed',
      },
      sourceText: fixture.sourceText,
    });
    expect(result).toMatchObject({ valid: false, stale: true });
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'source_snapshot_stale', severity: 'error' }),
      expect.objectContaining({ code: 'unresolved_low_confidence', severity: 'error' }),
      expect.objectContaining({ code: 'node_offset_out_of_bounds', severity: 'error' }),
    ]));
  });

  it('accepts an explicitly skipped draft only when it contains no story ranges', () => {
    const fixture = freezeFixture();
    fixture.draft.storyRangeMode = 'skipped_by_user';
    expect(validateDraftForFreeze({
      draft: fixture.draft,
      currentSourceSnapshot: fixture.draft.sourceSnapshot,
      sourceText: fixture.sourceText,
    }).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'skipped_story_ranges_present', severity: 'error' }),
    ]));
    fixture.draft.storyRanges = [];
    expect(validateDraftForFreeze({
      draft: fixture.draft,
      currentSourceSnapshot: fixture.draft.sourceSnapshot,
      sourceText: fixture.sourceText,
    })).toEqual({ valid: true, stale: false, issues: [] });
  });
});

function freezeFixture(): { sourceText: string; draft: DraftStructureSet } {
  const sourceText = 'Chapter 1\nBody';
  const rootId = 'freeze-root' as StructureNodeId;
  const chapterId = 'freeze-chapter' as StructureNodeId;
  return {
    sourceText,
    draft: {
      id: 'freeze-draft' as StructureSetId,
      originSetId: 'freeze-candidate' as StructureSetId,
      bookId: 'freeze-book' as BreakdownBookId,
      stage: 'draft',
      detectionRunId: null,
      draftRevision: 1,
      structureEdition: null,
      storyRangeMode: 'included',
      sourceSnapshot: {
        sourceTextId: 'freeze-source' as SourceTextId,
        sourceTextEdition: 1,
        contentHash: 'sha256:freeze-source',
        decodedTextLength: sourceText.length,
        offsetUnit: 'utf16_code_unit',
      },
      nodes: [
        {
          id: rootId, originId: null, kind: 'book', title: 'Book', parentId: null,
          order: 0, startOffset: 0, endOffset: sourceText.length, heading: null,
          confidence: { score: 1, level: 'high', lowConfidenceResolution: null },
        },
        {
          id: chapterId, originId: null, kind: 'chapter', title: 'Chapter 1', parentId: rootId,
          order: 0, startOffset: 0, endOffset: sourceText.length,
          heading: { rawHeadingText: 'Chapter 1', headingStartOffset: 0, headingEndOffset: 9 },
          confidence: { score: 1, level: 'high', lowConfidenceResolution: null },
        },
      ],
      storyRanges: [{
        id: 'freeze-range' as import('../../src/shared/domain').StorySegmentRangeId,
        originId: null,
        title: 'Story', startOffset: 0, endOffset: sourceText.length,
        coveredChapterIds: [chapterId], suggestedFunctionTags: ['setup'],
        boundaryEvidence: [{ kind: 'chapter_window', startOffset: 0, endOffset: sourceText.length }],
        startReason: 'source_start', endReason: 'source_end',
        confidence: { score: 1, level: 'high', lowConfidenceResolution: null },
      }],
      createdAt: '2026-07-14T00:00:00.000Z',
      updatedAt: '2026-07-14T00:00:00.000Z',
    },
  };
}
