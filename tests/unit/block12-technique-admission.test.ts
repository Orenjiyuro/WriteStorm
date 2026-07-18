import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRODUCT_IPC_CHANNELS } from '../../src/shared/contracts';
import {
  techniqueEntrySchema,
  type BreakdownBookId,
  type LibraryId,
  type ReusableTechniqueCandidateId,
  type SourceSnapshotId,
  type TechniqueEntryId,
  type WorkTechniqueObservationId,
} from '../../src/shared/domain';

describe('Block 12 Technique persistence blocked state', () => {
  it('accepts the current minimal TechniqueEntry schema witness', () => {
    expect(techniqueEntrySchema.safeParse(currentTechniqueEntry).success).toBe(true);
  });

  it.each([
    ['title', 'Escalate a private choice into a public consequence'],
    ['summary', 'An abstract reusable technique without source-specific expression.'],
    ['tags', ['escalation', 'consequence']],
    ['applicableScope', 'Scenes where a local choice needs visible social pressure.'],
    ['limitations', ['Requires an established rule or relationship consequence.']],
    ['revision', 1],
    ['createdAt', '2026-07-16T00:00:00.000Z'],
    ['updatedAt', '2026-07-16T00:00:00.000Z'],
  ] as const)('keeps future field %s outside the current strict schema', (field, value) => {
    expect(techniqueEntrySchema.safeParse({
      ...currentTechniqueEntry,
      [field]: value,
    }).success).toBe(false);
  });

  it('has no typed natural candidate-adoption producer', () => {
    expect(
      PRODUCT_IPC_CHANNELS.filter(
        (channel) => channel.startsWith('techniques:') && channel.includes('adopt'),
      ),
    ).toEqual([]);
  });

  it('keeps Technique production tables outside the migration registry and owner map', () => {
    const migrationRegistry = readFileSync('src/main/db/migrations/index.ts', 'utf8');
    const ownerMap = readFileSync('tests/integration/db/app-schema.test.ts', 'utf8');

    for (const tableName of [
      'technique_entries',
      'source_snapshots',
      'reusable_technique_candidates',
      'work_technique_observations',
    ]) {
      expect(migrationRegistry).not.toContain(tableName);
      expect(ownerMap).not.toContain(`${tableName}:`);
    }
  });
});

const currentTechniqueEntry = {
  id: 'technique-entry-1' as TechniqueEntryId,
  ownerKind: 'technique_library',
  libraryId: 'library-1' as LibraryId,
  status: 'draft',
  sourceSnapshot: {
    id: 'snapshot-1' as SourceSnapshotId,
    sourceBookId: 'book-1' as BreakdownBookId,
    sourceCandidateId: 'candidate-1' as ReusableTechniqueCandidateId,
    sourceObservationIds: ['observation-1' as WorkTechniqueObservationId],
    capturedAt: '2026-07-16T00:00:00.000Z',
    summary: {
      kind: 'redacted_summary',
      text: 'Source function summarized without names, settings, or original sentences.',
      excludes: [
        'character_names',
        'proprietary_setting_terms',
        'original_sentences',
        'full_original_excerpts',
      ],
    },
    evidenceSummary: {
      kind: 'redacted_evidence_summary',
      text: 'Evidence summarized by function and scope.',
      excludes: [
        'character_names',
        'proprietary_setting_terms',
        'original_sentences',
        'full_original_excerpts',
      ],
    },
    traceability: 'readonly_source_trace',
  },
} as const;
