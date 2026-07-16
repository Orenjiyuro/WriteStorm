import type { SchemaSemanticBoundary } from '../schema-semantic-witness';

function insert(values: {
  readonly id?: string;
  readonly key?: string;
  readonly name?: string;
  readonly category?: string;
  readonly createsModuleInstance?: number;
  readonly sortOrder?: number;
} = {}): string {
  return `INSERT INTO analysis_modules
    (id, key, name, category, creates_module_instance, sort_order)
    VALUES (
      '${values.id ?? 'plot_causality'}',
      '${values.key ?? 'plot_causality'}',
      '${values.name ?? 'Plot'}',
      '${values.category ?? 'analysis'}',
      ${values.createsModuleInstance ?? 1},
      ${values.sortOrder ?? 1}
    )`;
}

function check(id: string, acceptSql: string, rejectSql: string): SchemaSemanticBoundary {
  return {
    id: `003.analysis_module.${id}`,
    migrationId: 3,
    kind: 'check',
    accept: { sql: acceptSql },
    reject: { sql: rejectSql, code: 'SQLITE_CONSTRAINT_CHECK' },
  };
}

export const ANALYSIS_MODULE_DEFINITIONS_SEMANTIC_BOUNDARIES = [
  check('key_allowlist', insert(), insert({ id: 'eighth', key: 'eighth' })),
  check('identity_matches_key', insert(), insert({ id: 'different-id' })),
  check('name_non_blank', insert(), insert({ name: ' ' })),
  check('category', insert(), insert({ category: 'secondary_system_page' })),
  check('creates_instance', insert(), insert({ createsModuleInstance: 0 })),
  check('sort_order', insert(), insert({ sortOrder: 7 })),
] as const satisfies readonly SchemaSemanticBoundary[];
