import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createSourceImportFailureViewModel,
  SourceImportFailurePanel,
} from '../../src/renderer/features/breakdown-shelf/source-import-failure';
import type { DomainError } from '../../src/shared/errors';

describe('source import failure UI', () => {
  it('maps every stable import failure reason to a concrete repair path', () => {
    const cases = [
      {
        reason: 'no_current_library',
        expectedRepair: 'Create or open a library',
        expectedAction: 'open_library',
      },
      {
        reason: 'dialog_cancelled',
        expectedRepair: 'Select a .txt or .md file',
        expectedAction: 'choose_file',
      },
      {
        reason: 'cancelled',
        expectedRepair: 'Select a .txt or .md file',
        expectedAction: 'choose_file',
      },
      {
        reason: 'invalid_extension',
        expectedRepair: 'Save or convert the source as .txt or .md',
        expectedAction: 'choose_file',
      },
      {
        reason: 'not_readable',
        expectedRepair: 'Check file permissions',
        expectedAction: 'choose_file',
      },
      {
        reason: 'file_too_large',
        details: {
          maxSizeBytes: 20 * 1024 * 1024,
          sizeBytes: 20 * 1024 * 1024 + 1,
        },
        expectedRepair: 'Choose a source file under 20 MiB',
        expectedAction: 'choose_smaller_file',
      },
      {
        reason: 'empty_file',
        expectedRepair: 'Choose a non-empty .txt or .md file',
        expectedAction: 'choose_file',
      },
      {
        reason: 'pending_import_not_found',
        expectedRepair: 'Start the import again',
        expectedAction: 'choose_file',
      },
      {
        reason: 'library_session_changed',
        expectedRepair: 'Choose the source file again in the current library session',
        expectedAction: 'choose_file',
      },
      {
        reason: 'copy_failed',
        expectedRepair: 'Check library write permissions and free disk space',
        expectedAction: 'retry_import',
      },
      {
        reason: 'database_write_failed',
        expectedRepair: 'Try the import again',
        expectedAction: 'retry_import',
      },
    ] as const;

    for (const testCase of cases) {
      const model = createSourceImportFailureViewModel(importError({
        reason: testCase.reason,
        ...('details' in testCase ? testCase.details : {}),
      }));

      expect(model.repair).toContain(testCase.expectedRepair);
      expect(model.actions.map((action) => action.kind)).toContain(testCase.expectedAction);
    }
  });

  it('offers explicit manual encoding retry actions from a pending import token', () => {
    const model = createSourceImportFailureViewModel(importError({
      reason: 'encoding_required',
      pendingImportId: 'pending-1',
      supportedEncodings: ['utf-8', 'gb18030'],
    }));

    expect(model.title).toBe('Choose the source text encoding');
    expect(model.repair).toContain('Retry with one of the supported encodings');
    expect(model.actions).toEqual([
      {
        kind: 'retry_encoding',
        label: 'Retry as UTF-8',
        pendingImportId: 'pending-1',
        encodingOverride: 'utf-8',
      },
      {
        kind: 'retry_encoding',
        label: 'Retry as GB18030',
        pendingImportId: 'pending-1',
        encodingOverride: 'gb18030',
      },
    ]);
  });

  it('points duplicate imports to the existing book and source ids', () => {
    const model = createSourceImportFailureViewModel(importError({
      reason: 'duplicate_source_hash',
      existingBookId: 'book-1',
      existingSourceTextId: 'source-1',
    }));

    expect(model.title).toBe('This source text is already imported');
    expect(model.repair).toContain('Open the existing book instead of importing another copy');
    expect(model.actions).toContainEqual({
      kind: 'open_existing_book',
      label: 'Open existing book',
      existingBookId: 'book-1',
      existingSourceTextId: 'source-1',
    });
  });

  it('shows the copied source relative path for target conflicts', () => {
    const model = createSourceImportFailureViewModel(importError({
      reason: 'target_conflict',
      relativePath: 'source/source-1/example.md',
    }));

    expect(model.title).toBe('The copied source target already exists');
    expect(model.repair).toContain('source/source-1/example.md');
    expect(model.actions).toContainEqual({
      kind: 'retry_import',
      label: 'Retry import',
    });
  });

  it('renders an alert panel with the repair path and action labels', () => {
    const model = createSourceImportFailureViewModel(importError({
      reason: 'invalid_extension',
    }));

    const html = renderToStaticMarkup(createElement(SourceImportFailurePanel, {
      failure: model,
      onAction: () => undefined,
    }));

    expect(html).toContain('role="alert"');
    expect(html).toContain('Choose a .txt or .md source file');
    expect(html).toContain('Save or convert the source as .txt or .md');
    expect(html).toContain('Choose another file');
    expect(html).toContain('<button');
  });

  it('keeps source import and opened-book UI copy in the renderer i18n catalog', () => {
    const failureSource = readFileSync(
      path.resolve('src/renderer/features/breakdown-shelf/source-import-failure.tsx'),
      'utf8',
    );
    const appSource = readFileSync(path.resolve('src/renderer/App.tsx'), 'utf8');

    expect(failureSource).not.toContain('Open existing book');
    expect(failureSource).not.toContain('Retry as GB18030');
    expect(appSource).not.toContain('Opened book:');
  });
});

function importError(details: Record<string, unknown>): DomainError {
  return {
    code: 'IMPORT_ERROR',
    message: 'Import failed.',
    recoverable: true,
    details,
  } as DomainError;
}
