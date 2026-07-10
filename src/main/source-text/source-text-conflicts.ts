import type { BreakdownBookId, SourceTextId } from '../../shared/domain';
import type { SqliteDatabase } from '../db/sqlite';
import type { SourceTextCopyResult } from './source-text-copy';

export type SourceTextDuplicateCheckResult =
  | { readonly ok: true }
  | {
    readonly ok: false;
    readonly reason: 'duplicate_source_hash';
    readonly message: string;
    readonly existingBookId: BreakdownBookId;
    readonly existingSourceTextId: SourceTextId;
  };

export type SourceTextTargetConflict = {
  readonly ok: false;
  readonly reason: 'target_conflict';
  readonly message: string;
  readonly relativePath: string;
};

export function detectSourceTextDuplicateByHash(
  database: SqliteDatabase,
  input: { readonly contentHash: string },
): SourceTextDuplicateCheckResult {
  const contentHash = input.contentHash.trim();

  if (contentHash.length === 0) {
    throw new Error('Source text content hash is required for duplicate detection.');
  }

  const existing = database.prepare(`
    SELECT
      id AS existingSourceTextId,
      book_id AS existingBookId
    FROM source_texts
    WHERE content_hash = ?
    ORDER BY imported_at ASC, id ASC
    LIMIT 1
  `).get(contentHash) as {
    existingSourceTextId: string;
    existingBookId: string;
  } | undefined;

  if (!existing) {
    return { ok: true };
  }

  return {
    ok: false,
    reason: 'duplicate_source_hash',
    message: 'This source text has already been imported.',
    existingBookId: existing.existingBookId as BreakdownBookId,
    existingSourceTextId: existing.existingSourceTextId as SourceTextId,
  };
}

export function toSourceTextTargetConflict(
  copyResult: SourceTextCopyResult,
): SourceTextTargetConflict | null {
  if (copyResult.ok || copyResult.reason !== 'target_conflict') {
    return null;
  }

  if (!copyResult.relativePath) {
    throw new Error('Source text target conflict must include the copied source relative path.');
  }

  return {
    ok: false,
    reason: 'target_conflict',
    message: 'The library already contains a copied source at the target path.',
    relativePath: copyResult.relativePath,
  };
}
