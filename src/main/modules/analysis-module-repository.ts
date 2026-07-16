import type { AnalysisModuleDefinition } from '../../shared/domain';
import { ANALYSIS_MODULE_DEFINITIONS } from '../../shared/domain';
import type { SqliteDatabase } from '../db/sqlite';

export type AnalysisModuleRepositoryErrorReason = 'module_contract_unavailable';

export class AnalysisModuleRepositoryError extends Error {
  readonly reason: AnalysisModuleRepositoryErrorReason;

  constructor(reason: AnalysisModuleRepositoryErrorReason) {
    super('Persisted analysis module definitions do not match the shared contract snapshot.');
    this.name = 'AnalysisModuleRepositoryError';
    this.reason = reason;
  }
}

type PersistedAnalysisModuleRow = {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly category: string;
  readonly createsModuleInstance: number;
  readonly sortOrder: number;
};

export class AnalysisModuleRepository {
  list(database: SqliteDatabase): AnalysisModuleDefinition[] {
    const rows = database.prepare(`
      SELECT
        id,
        key,
        name,
        category,
        creates_module_instance AS createsModuleInstance,
        sort_order AS sortOrder
      FROM analysis_modules
      ORDER BY sort_order ASC
    `).all() as PersistedAnalysisModuleRow[];

    if (!matchesSharedContract(rows)) {
      throw new AnalysisModuleRepositoryError('module_contract_unavailable');
    }

    return rows.map((row) => ({
      id: row.id as AnalysisModuleDefinition['id'],
      key: row.key as AnalysisModuleDefinition['key'],
      name: row.name,
      category: row.category as AnalysisModuleDefinition['category'],
      createsModuleInstance: true,
    }));
  }
}

function matchesSharedContract(rows: readonly PersistedAnalysisModuleRow[]): boolean {
  return rows.length === ANALYSIS_MODULE_DEFINITIONS.length && rows.every((row, index) => {
    const expected = ANALYSIS_MODULE_DEFINITIONS[index];
    return row.id === expected.id &&
      row.key === expected.key &&
      row.name === expected.name &&
      row.category === expected.category &&
      row.createsModuleInstance === 1 &&
      row.sortOrder === index;
  });
}
