import type { SchemaSemanticBoundary } from '../schema-semantic-witness';

const BOOK_SETUP = `INSERT INTO books VALUES ('book', 'Book', NULL, 'now', 'now')`;
const JOB_SETUP = `INSERT INTO jobs VALUES ('job', NULL, 'source_import', 'queued', 0, NULL, 1, '{}', NULL, NULL, 'now', 'now')`;

function check(
  id: string,
  acceptSql: string,
  rejectSql: string,
  setupSql?: string,
): SchemaSemanticBoundary {
  return {
    id: `001.${id}`,
    migrationId: 1,
    kind: 'check',
    accept: { setupSql, sql: acceptSql },
    reject: { setupSql, sql: rejectSql, code: 'SQLITE_CONSTRAINT_CHECK' },
  };
}

function source(values: { fileName?: string; size?: number; format?: string; edition?: number }): string {
  return `INSERT INTO source_texts VALUES ('source', 'book', '${values.fileName ?? 'source.txt'}', ${values.size ?? 1}, '${values.format ?? 'txt'}', 'hash', 'utf8', ${values.edition ?? 1}, 'source.txt', 'now')`;
}

function job(values: { state?: string; completed?: number; total?: string; payloadVersion?: number }): string {
  return `INSERT INTO jobs VALUES ('job', NULL, 'source_import', '${values.state ?? 'queued'}', ${values.completed ?? 0}, ${values.total ?? 'NULL'}, ${values.payloadVersion ?? 1}, '{}', NULL, NULL, 'now', 'now')`;
}

function checkpoint(sequence: number, payloadVersion: number): string {
  return `INSERT INTO job_checkpoints VALUES ('checkpoint', 'job', ${sequence}, 'progress', ${payloadVersion}, '{}', 'now')`;
}

export const V1_RUNTIME_BASELINE_SEMANTIC_BOUNDARIES = [
  check('library.singleton_key',
    `INSERT INTO library VALUES (1, 'lib', 'Library', '1.0.0', 2, 'now', 'now')`,
    `INSERT INTO library VALUES (2, 'lib', 'Library', '1.0.0', 2, 'now', 'now')`),
  check('library.schema_epoch',
    `INSERT INTO library VALUES (1, 'lib', 'Library', '1.0.0', 2, 'now', 'now')`,
    `INSERT INTO library VALUES (1, 'lib', 'Library', '1.0.0', 1, 'now', 'now')`),
  check('source_text.original_file_name', source({ fileName: 'source.txt' }), source({ fileName: ' ' }), BOOK_SETUP),
  check('source_text.size_bytes', source({ size: 1 }), source({ size: 0 }), BOOK_SETUP),
  check('source_text.format', source({ format: 'txt' }), source({ format: 'pdf' }), BOOK_SETUP),
  check('source_text.source_edition', source({ edition: 1 }), source({ edition: 0 }), BOOK_SETUP),
  check('job.state', job({ state: 'queued' }), job({ state: 'unknown' })),
  check('job.completed_units', job({ completed: 0 }), job({ completed: -1 })),
  check('job.total_units', job({ total: 'NULL' }), job({ total: '-1' })),
  check('job.payload_schema_version', job({ payloadVersion: 1 }), job({ payloadVersion: 0 })),
  check('checkpoint.sequence', checkpoint(1, 1), checkpoint(0, 1), JOB_SETUP),
  check('checkpoint.payload_schema_version', checkpoint(1, 1), checkpoint(1, 0), JOB_SETUP),
] as const satisfies readonly SchemaSemanticBoundary[];
