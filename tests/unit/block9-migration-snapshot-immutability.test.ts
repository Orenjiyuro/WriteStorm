import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_MODULE_DEFINITION_SEED_003,
  ANALYSIS_MODULE_KEY_ALLOWLIST_003,
} from '../../src/main/db/migrations/003_analysis_module_definitions';
import {
  MODULE_INSTANCE_STATUS_VOCABULARY_004,
} from '../../src/main/db/migrations/004_analysis_module_instances';
import {
  ANALYSIS_MODULE_DEFINITIONS,
  ANALYSIS_MODULE_KEYS,
  MODULE_INSTANCE_STATUSES,
} from '../../src/shared/domain';

describe('Block 9 immutable migration snapshots', () => {
  it('admits frozen migration 003 module definitions only while they equal the current contract', () => {
    expect(ANALYSIS_MODULE_KEY_ALLOWLIST_003).toEqual(ANALYSIS_MODULE_KEYS);
    expect(ANALYSIS_MODULE_DEFINITION_SEED_003).toEqual(
      ANALYSIS_MODULE_DEFINITIONS.map((definition, sortOrder) => ({
        id: String(definition.id),
        key: definition.key,
        name: definition.name,
        category: definition.category,
        createsModuleInstance: 1,
        sortOrder,
      })),
    );
  });

  it('admits frozen migration 004 statuses only while they equal the current vocabulary', () => {
    expect(MODULE_INSTANCE_STATUS_VOCABULARY_004).toEqual(MODULE_INSTANCE_STATUSES);
  });

  it('keeps historical migrations independent from mutable shared-domain constants', () => {
    const migration003 = readFileSync(
      'src/main/db/migrations/003_analysis_module_definitions.ts',
      'utf8',
    );
    const migration004 = readFileSync(
      'src/main/db/migrations/004_analysis_module_instances.ts',
      'utf8',
    );
    const migration005 = readFileSync(
      'src/main/db/migrations/005_analysis_module_asset_placeholders.ts',
      'utf8',
    );
    const migration006 = readFileSync(
      'src/main/db/migrations/006_type_library_registry.ts',
      'utf8',
    );
    const migration007 = readFileSync(
      'src/main/db/migrations/007_type_library_book_bindings.ts',
      'utf8',
    );

    expect(migration003).not.toMatch(/^import(?! type).*from ['"][^'"]*shared\/domain/m);
    expect(migration004).not.toMatch(/^import(?! type).*from ['"][^'"]*shared\/domain/m);
    expect(migration005).not.toMatch(/^import(?! type).*from ['"][^'"]*shared\/domain/m);
    expect(migration006).not.toMatch(/^import(?! type).*from ['"][^'"]*shared\/domain/m);
    expect(migration007).not.toMatch(/^import(?! type).*from ['"][^'"]*shared\/domain/m);
    expect(migration004).toContain('ANALYSIS_MODULE_DEFINITION_SEED_003');
  });
});
