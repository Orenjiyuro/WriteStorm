import { describe, expect, it } from 'vitest';
import type { StructureNodeId } from '../../src/shared/domain';
import { detectStructureCandidates } from '../../src/main/structure/detection/structure-detector';

describe('structure detector', () => {
  it('builds a book-volume-chapter tree from deterministic multilingual heading rules', () => {
    const sourceText = [
      '# 第一卷：起航',
      '第１章　始まり',
      '正文。',
      '第２章　月光',
      '```markdown',
      '# faux heading inside a fence',
      '```',
      '# Volume II: Return',
      'Chapter 1: English restart',
    ].join('\n');

    const result = detectStructureCandidates({
      bookTitle: 'Example Book',
      sourceText,
      idFactory: deterministicIdFactory(),
    });

    expect(result.status).toBe('candidate_ready');
    if (result.status === 'structure_detection_failed') {
      throw new Error('Expected structure candidate, received failure.');
    }

    expect(result.nodes.map((node) => ({
      kind: node.kind,
      title: node.title,
      parentId: node.parentId,
    }))).toEqual([
      { kind: 'book', title: 'Example Book', parentId: null },
      { kind: 'volume', title: '第一卷：起航', parentId: 'detector:book:0' },
      { kind: 'chapter', title: '第１章　始まり', parentId: 'detector:volume:1' },
      { kind: 'chapter', title: '第２章　月光', parentId: 'detector:volume:1' },
      { kind: 'volume', title: 'Volume II: Return', parentId: 'detector:book:0' },
      { kind: 'chapter', title: 'Chapter 1: English restart', parentId: 'detector:volume:4' },
    ]);
    expect(result.nodes.find((node) => node.title.includes('faux heading'))).toBeUndefined();
    expect(result.nodes.slice(1).map((node) => sourceText.slice(
      node.heading?.headingStartOffset,
      node.heading?.headingEndOffset,
    ))).toEqual([
      '# 第一卷：起航',
      '第１章　始まり',
      '第２章　月光',
      '# Volume II: Return',
      'Chapter 1: English restart',
    ]);
    expect(result.nodes.slice(1).map((node) => node.heading?.rawHeadingText)).toEqual([
      '# 第一卷：起航',
      '第１章　始まり',
      '第２章　月光',
      '# Volume II: Return',
      'Chapter 1: English restart',
    ]);
  });

  it('requires manual review instead of ordinary candidate success for duplicate chapter numbering', () => {
    const result = detectStructureCandidates({
      bookTitle: 'Duplicate chapters',
      sourceText: 'Chapter 1: First\nChapter 1: Duplicate',
      idFactory: deterministicIdFactory(),
    });

    expect(result.status).toBe('needs_manual_review');
    if (result.status === 'structure_detection_failed') {
      throw new Error('Expected reviewable candidate, received failure.');
    }

    expect(result.nodes.at(-1)?.confidence).toEqual({
      score: 0.4,
      level: 'low',
      lowConfidenceResolution: 'unresolved',
    });
  });

  it('returns a stable failure with manual recovery routes when no reliable chapter is found', () => {
    const result = detectStructureCandidates({
      bookTitle: 'No chapters',
      sourceText: '# Foreword\nOnly body text follows.',
      idFactory: deterministicIdFactory(),
    });

    expect(result).toMatchObject({
      status: 'structure_detection_failed',
      failureCode: 'no_reliable_chapter',
      recoveryActions: [
        'adjust_rules',
        'mark_chapters_manually',
        'create_book_root_shell',
      ],
      root: {
        kind: 'book',
        title: 'No chapters',
        confidence: {
          level: 'unusable',
        },
      },
    });
  });

  it('does not mistake a volume-only title tree for a usable chapter candidate', () => {
    expect(detectStructureCandidates({
      bookTitle: 'Volumes only',
      sourceText: '# Part I: Opening\n# Volume II: Return',
      idFactory: deterministicIdFactory(),
    })).toMatchObject({
      status: 'structure_detection_failed',
      failureCode: 'no_reliable_chapter',
      recoveryActions: [
        'adjust_rules',
        'mark_chapters_manually',
        'create_book_root_shell',
      ],
      root: {
        kind: 'book',
        confidence: {
          score: 0,
          level: 'unusable',
          lowConfidenceResolution: null,
        },
      },
    });
  });

  it('uses non-overlapping identities for independent detections', () => {
    const first = detectStructureCandidates({
      bookTitle: 'First',
      sourceText: 'Chapter 1: First\nChapter 2: Second',
    });
    const second = detectStructureCandidates({
      bookTitle: 'Second',
      sourceText: 'Chapter 1: First\nChapter 2: Second',
    });

    if (first.status === 'structure_detection_failed' || second.status === 'structure_detection_failed') {
      throw new Error('Expected two structure candidates.');
    }

    const allIds = [...first.nodes, ...second.nodes].map((node) => node.id);
    expect(new Set(allIds)).toHaveLength(allIds.length);
  });

  it('recognizes Japanese episode headings and scores Setext headings as Markdown evidence', () => {
    const result = detectStructureCandidates({
      bookTitle: 'Episodes',
      sourceText: [
        '第１話　始まり',
        '======',
        '第２話　続き',
        '------',
      ].join('\n'),
      idFactory: deterministicIdFactory(),
    });

    expect(result.status).toBe('candidate_ready');
    if (result.status === 'structure_detection_failed') {
      throw new Error('Expected Setext episode chapters.');
    }

    expect(result.nodes.slice(1).map((node) => ({
      title: node.title,
      score: node.confidence.score,
      rawHeadingText: node.heading?.rawHeadingText,
    }))).toEqual([
      { title: '第１話　始まり', score: 0.95, rawHeadingText: '第１話　始まり' },
      { title: '第２話　続き', score: 0.95, rawHeadingText: '第２話　続き' },
    ]);
  });

  it('keeps code fenced headings hidden until the matching marker and minimum fence length close', () => {
    const result = detectStructureCandidates({
      bookTitle: 'Fence handling',
      sourceText: [
        '```markdown',
        'Chapter 1: Hidden',
        '~~~',
        'Chapter 2: Still hidden',
        '```',
        '~~~~',
        'Chapter 3: Hidden by tilde fence',
        '~~~',
        'Chapter 4: Still hidden by tilde fence',
        '~~~~',
        'Chapter 5: Visible',
      ].join('\n'),
      idFactory: deterministicIdFactory(),
    });

    expect(result.status).toBe('candidate_ready');
    if (result.status === 'structure_detection_failed') {
      throw new Error('Expected the post-fence chapter.');
    }

    expect(result.nodes.map((node) => node.title)).toEqual([
      'Fence handling',
      'Chapter 5: Visible',
    ]);
  });

  it('does not detect pseudo headings after an unclosed fence', () => {
    expect(detectStructureCandidates({
      bookTitle: 'Unclosed fence',
      sourceText: '~~~markdown\n第１話　hidden',
      idFactory: deterministicIdFactory(),
    })).toMatchObject({
      status: 'structure_detection_failed',
      failureCode: 'no_reliable_chapter',
    });
  });
});

function deterministicIdFactory() {
  let nodeIndex = 0;

  return {
    createStructureNodeId: (kind: 'book' | 'volume' | 'chapter') =>
      `detector:${kind}:${nodeIndex++}` as StructureNodeId,
    createStorySegmentRangeId: () => 'unused-story-range-id' as never,
  };
}
