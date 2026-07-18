import { describe, expect, it } from 'vitest';
import { getContract, type ContractRequest } from '../../src/shared/contracts';
import type {
  BreakdownBookId,
  TypeDefinitionId,
  TypeDefinitionVersionId,
} from '../../src/shared/domain';

const bookId = 'book-type-contract' as BreakdownBookId;
const mainType = reference('builtin_main_001');
const contentFocus = reference('builtin_focus_001');

describe('shared TypeLibrary IPC contracts', () => {
  it('accepts only the narrow list, read, and CAS update request shapes', () => {
    expect(getContract('type-library:list-options').request.parse({})).toEqual({});
    expect(getContract('type-library:list-options').request.parse({ version: 1 })).toEqual({ version: 1 });
    expect(getContract('type-library:get-book-binding').request.parse({ bookId })).toEqual({ bookId });

    const update = {
      bookId,
      expectedRevision: 0,
      typeLibraryVersion: 1,
      mainType,
      contentFocuses: [contentFocus],
    } satisfies ContractRequest<'type-library:update-book-binding'>;
    expect(getContract('type-library:update-book-binding').request.parse(update)).toEqual(update);
  });

  it('rejects extra paths, SQLite details, credentials, SDK values, and persistence fields', () => {
    const requests = [
      ['type-library:list-options', {}],
      ['type-library:get-book-binding', { bookId }],
      ['type-library:update-book-binding', {
        bookId,
        expectedRevision: 0,
        typeLibraryVersion: 1,
        mainType: null,
        contentFocuses: [],
      }],
    ] as const;

    for (const [channel, request] of requests) {
      for (const [field, value] of Object.entries({
        rootPath: 'C:/unsafe',
        databasePath: 'C:/unsafe.sqlite',
        sqliteRowId: 7,
        secret: 'secret',
        token: 'token',
        sdkClient: 'codex',
        updatedAt: '2026-07-17T00:00:00.000Z',
      })) {
        expect(getContract(channel).request.safeParse({ ...request, [field]: value }).success).toBe(false);
      }
    }
  });

  it('validates DTO-only success responses and rejects leaked persistence fields', () => {
    const option = {
      typeDefinitionId: mainType.typeDefinitionId,
      typeDefinitionVersionId: mainType.typeDefinitionVersionId,
      kind: 'main_type' as const,
      origin: 'built_in' as const,
      stableKey: 'builtin_main_001',
      displayName: '日轻校园',
      selectionDescription: '用户主动选择的内置类型。',
      sortOrder: 0,
    };
    const binding = {
      bookId,
      typeLibraryVersion: 1,
      revision: 1,
      mainType,
      contentFocuses: [{ priority: 1, ...contentFocus }],
      updatedAt: '2026-07-17T00:00:00.000Z',
    };

    expect(getContract('type-library:list-options').response.parse({
      ok: true,
      data: { version: 1, options: [option] },
    })).toEqual({ ok: true, data: { version: 1, options: [option] } });
    expect(getContract('type-library:list-options').response.parse({
      ok: true,
      data: { version: 1, options: [] },
    })).toEqual({ ok: true, data: { version: 1, options: [] } });
    expect(getContract('type-library:get-book-binding').response.parse({ ok: true, data: null }))
      .toEqual({ ok: true, data: null });
    expect(getContract('type-library:update-book-binding').response.parse({ ok: true, data: binding }))
      .toEqual({ ok: true, data: binding });

    for (const leaked of [
      { rowid: 1 },
      { databasePath: 'C:/unsafe.sqlite' },
      { token: 'secret' },
      { sourceText: 'private source excerpt' },
    ]) {
      expect(getContract('type-library:update-book-binding').response.safeParse({
        ok: true,
        data: { ...binding, ...leaked },
      }).success).toBe(false);
    }
  });
});

function reference(stableKey: string): {
  readonly typeDefinitionId: TypeDefinitionId;
  readonly typeDefinitionVersionId: TypeDefinitionVersionId;
} {
  return {
    typeDefinitionId: stableKey as TypeDefinitionId,
    typeDefinitionVersionId: `${stableKey}_v1` as TypeDefinitionVersionId,
  };
}
