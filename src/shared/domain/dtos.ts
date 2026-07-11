import type { BreakdownBookId, StorySegmentRangeId, StructureNodeId } from './ids';
import type { ScopeKind } from './status';

export type IsoDateTimeString = string;

export type ScopeRef =
  | {
      kind: Extract<ScopeKind, 'book'>;
      bookId: BreakdownBookId;
    }
  | {
      kind: Extract<ScopeKind, 'volume' | 'chapter'>;
      nodeId: StructureNodeId;
    }
  | {
      kind: Extract<ScopeKind, 'story_segment_range'>;
      rangeId: StorySegmentRangeId;
    };
