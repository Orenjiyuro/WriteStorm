export const STRUCTURE_NODE_KINDS = ['book', 'volume', 'chapter'] as const;

export type StructureNodeKind = (typeof STRUCTURE_NODE_KINDS)[number];

export const SCOPE_KINDS = ['book', 'volume', 'chapter', 'story_segment_range'] as const;

export type ScopeKind = (typeof SCOPE_KINDS)[number];

export const MODULE_INSTANCE_STATUSES = [
  'not_generated',
  'generated_pending_review',
  'confirmed',
  'stale',
  'needs_rebuild',
] as const;

export type ModuleInstanceStatus = (typeof MODULE_INSTANCE_STATUSES)[number];
