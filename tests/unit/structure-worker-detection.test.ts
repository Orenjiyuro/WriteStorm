import { describe, expect, it } from 'vitest';
import { executeStructureWorkerDetection } from '../../src/main/structure/worker/structure-worker-detection';

describe('structure utility worker detection', () => {
  it('runs the real title and story-range detectors as one typed operation', () => {
    const result = executeStructureWorkerDetection({
      bookTitle: 'Worker fixture',
      sourceText: [
        'Chapter 1: Start',
        'Body',
        'Chapter 2: Continue',
        'Body',
        '',
        '---',
        '',
        'Chapter 3: Aftermath',
        'Body',
      ].join('\n'),
    });

    expect(result).toMatchObject({
      structure: {
        status: 'candidate_ready',
        nodes: [
          { kind: 'book', title: 'Worker fixture' },
          { kind: 'chapter', title: 'Chapter 1: Start' },
          { kind: 'chapter', title: 'Chapter 2: Continue' },
          { kind: 'chapter', title: 'Chapter 3: Aftermath' },
        ],
      },
      storyRanges: {
        status: 'needs_manual_review',
        ranges: [{
          coveredChapterIds: expect.any(Array),
          suggestedFunctionTags: ['structural_break'],
        }],
      },
    });
    expect(result.storyRanges?.ranges[0]?.coveredChapterIds).toEqual(
      result.structure.status === 'structure_detection_failed'
        ? []
        : result.structure.nodes
          .filter((node) => node.kind === 'chapter')
          .slice(0, 2)
          .map((node) => node.id),
    );
  });

  it('does not fabricate story ranges after structure detection fails', () => {
    expect(executeStructureWorkerDetection({
      bookTitle: 'No headings',
      sourceText: 'Only prose remains.',
    })).toMatchObject({
      structure: {
        status: 'structure_detection_failed',
        failureCode: 'no_reliable_chapter',
      },
      storyRanges: null,
    });
  });
});
