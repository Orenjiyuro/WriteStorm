import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Block 7 deferral documentation gate', () => {
  it('records the 6A deferral override and non-AI Block 7 boundary in engineering docs', () => {
    const context = readFileSync(path.resolve('docs/engineering/CONTEXT.md'), 'utf8');
    const statusPath = path.resolve('docs/engineering/V1-BLOCK-7-STATUS.md');

    expect(existsSync(statusPath)).toBe(true);

    const status = readFileSync(statusPath, 'utf8');

    for (const document of [context, status]) {
      expect(document).toContain('Block 7 6A deferral override');
      expect(document).toContain('6A has not run and has no recorded Go/No-Go');
      expect(document).toContain('Block 7 may continue only as non-AI Foundation work');
      expect(document).toContain('AI/Codex/prompt/runtime remain blocked');
      expect(document).toContain('structure detection and module generation remain blocked');
    }

    expect(status).toContain('Authorized scope: Task 7.0 through Task 7.12 only');
    expect(status).toContain('No structure detection, AI, or module generation');
  });

  it('records the unpublished Task 7.2 migration reset into the current baseline', () => {
    const context = readFileSync(path.resolve('docs/engineering/CONTEXT.md'), 'utf8');
    const status = readFileSync(path.resolve('docs/engineering/V1-BLOCK-7-STATUS.md'), 'utf8');

    for (const document of [context, status]) {
      expect(document).toContain('migration 001');
      expect(document).toContain('migration 002');
      expect(document).toMatch(/schema version (?:is )?2|reaches version 2/);
      expect(document).toContain('source_texts.original_file_name');
      expect(document).toContain('source_texts.size_bytes');
      expect(document).toContain('idx_source_texts_content_hash');
      expect(document).toContain('does not implement file dialog, preflight, source copy, SQLite import writes, renderer import UI, BookService, or SourceTextService');
    }
  });

  it('records Task 7.3 as main-side dialog and pending-token boundary only', () => {
    const context = readFileSync(path.resolve('docs/engineering/CONTEXT.md'), 'utf8');
    const status = readFileSync(path.resolve('docs/engineering/V1-BLOCK-7-STATUS.md'), 'utf8');

    for (const document of [context, status]) {
      expect(document).toContain('Task 7.3 main-side file dialog adapter is implemented');
      expect(document).toContain('selects `.txt` and `.md` files only through main-side dialog options');
      expect(document).toContain('pending import tokens are main-only, scoped to the current library session, TTL-bound, and renderer-visible tokens do not contain source paths');
      expect(document).toContain('does not implement preflight, encoding detection, source copy, SQLite import writes, renderer import UI, BookService, or SourceTextService');
    }

    expect(status).not.toContain('Main-side pending import token storage is not implemented yet');
    expect(status).toContain('PendingImportStore is implemented as a main-only in-memory helper');
    expect(status).toContain('wired into `books:import-source` for manual encoding retry');
  });

  it('records Task 7.4 as source preflight only without encoding or import writes', () => {
    const context = readFileSync(path.resolve('docs/engineering/CONTEXT.md'), 'utf8');
    const status = readFileSync(path.resolve('docs/engineering/V1-BLOCK-7-STATUS.md'), 'utf8');

    for (const document of [context, status]) {
      expect(document).toContain('Task 7.4 source text preflight is implemented');
      expect(document).toContain('checks extension, 20 MiB size limit, readability, non-file selections, and empty files');
      expect(document).toContain('only `.txt` and `.md` are accepted');
      expect(document).toContain('does not implement encoding detection, source copy, SQLite import writes, renderer import UI, BookService, or SourceTextService');
    }
  });

  it('records Task 7.5 as UTF-8 auto decoding plus manual GB18030 retry only', () => {
    const context = readFileSync(path.resolve('docs/engineering/CONTEXT.md'), 'utf8');
    const status = readFileSync(path.resolve('docs/engineering/V1-BLOCK-7-STATUS.md'), 'utf8');

    for (const document of [context, status]) {
      expect(document).toContain('Task 7.5 source text encoding helper is implemented');
      expect(document).toContain('UTF-8 and UTF-8 BOM decode automatically');
      expect(document).toContain('GB18030 is available only through the manual retry encoding override');
      expect(document).toContain('does not implement source copy, SQLite import writes, renderer import UI, BookService, or SourceTextService');
    }

    expect(status).not.toContain('GB18030 is automatically detected');
  });

  it('records Task 7.6 as staging source copy only without SQLite import writes', () => {
    const context = readFileSync(path.resolve('docs/engineering/CONTEXT.md'), 'utf8');
    const status = readFileSync(path.resolve('docs/engineering/V1-BLOCK-7-STATUS.md'), 'utf8');

    for (const document of [context, status]) {
      expect(document).toContain('Task 7.6 source text copy helper is implemented');
      expect(document).toContain('stages copied bytes in the library source directory before final rename');
      expect(document).toContain('returns copied source relative path, size, and content hash');
      expect(document).toContain('does not implement SQLite import writes, renderer import UI, BookService, or SourceTextService');
    }
  });

  it('records Task 7.7 as metadata shape only without import transaction', () => {
    const context = readFileSync(path.resolve('docs/engineering/CONTEXT.md'), 'utf8');
    const status = readFileSync(path.resolve('docs/engineering/V1-BLOCK-7-STATUS.md'), 'utf8');

    for (const document of [context, status]) {
      expect(document).toContain('Task 7.7 source text metadata helper is implemented');
      expect(document).toContain('maps filename, ext, size, hash, encoding, import time, relative path, and source_text_edition');
      expect(document).toContain('produces the shared SourceTextMetadata DTO and source_texts insert row shape');
      expect(document).toContain('does not implement book + source_text transaction, renderer import UI, BookService, or SourceTextService');
    }
  });

  it('records Task 7.8 as book and source_text transaction only', () => {
    const context = readFileSync(path.resolve('docs/engineering/CONTEXT.md'), 'utf8');
    const status = readFileSync(path.resolve('docs/engineering/V1-BLOCK-7-STATUS.md'), 'utf8');

    for (const document of [context, status]) {
      expect(document).toContain('Task 7.8 book + source_text transaction helper is implemented');
      expect(document).toContain('inserts book and source_text rows in one SQLite transaction');
      expect(document).toContain('rolls back the book row when source_text insertion fails');
      expect(document).toContain('does not implement duplicate/conflict policy, renderer import UI, BookService, or SourceTextService');
    }
  });

  it('records Task 7.9 as duplicate/conflict policy helper only', () => {
    const context = readFileSync(path.resolve('docs/engineering/CONTEXT.md'), 'utf8');
    const status = readFileSync(path.resolve('docs/engineering/V1-BLOCK-7-STATUS.md'), 'utf8');

    for (const document of [context, status]) {
      expect(document).toContain('Task 7.9 source import duplicate/conflict policy helper is implemented');
      expect(document).toContain('duplicate content hash blocks import');
      expect(document).toContain('returns existing book/source ids');
      expect(document).toContain('target_conflict');
      expect(document).toContain('does not implement BookService, SourceTextService, or the full workbench UI; review remediation supplies the import orchestration and executable failure actions.');
    }
  });

  it('records Task 7.10 as failure UI only without full import orchestration', () => {
    const context = readFileSync(path.resolve('docs/engineering/CONTEXT.md'), 'utf8');
    const status = readFileSync(path.resolve('docs/engineering/V1-BLOCK-7-STATUS.md'), 'utf8');

    for (const document of [context, status]) {
      expect(document).toContain('Task 7.10 source import failure UI is implemented');
      expect(document).toContain('maps every stable `IMPORT_ERROR.details.reason` to a concrete repair path');
      expect(document).toContain('encoding_required offers explicit UTF-8 and GB18030 retry actions when a pending token is present');
      expect(document).toContain('does not implement full workbench UI, BookService, SourceTextService, or native dialog e2e; review remediation supplies the minimum import action wiring.');
    }
  });

  it('records Task 7.11 as packaged Electron import smoke only', () => {
    const context = readFileSync(path.resolve('docs/engineering/CONTEXT.md'), 'utf8');
    const status = readFileSync(path.resolve('docs/engineering/V1-BLOCK-7-STATUS.md'), 'utf8');

    for (const document of [context, status]) {
      expect(document).toContain('Task 7.11 packaged Electron import smoke is implemented');
      expect(document).toContain('production import selection remains main-side native dialog selection');
      expect(document).toContain('packaged e2e uses a main-process import dialog stub');
      expect(document).toContain('does not use Playwright web filechooser');
      expect(document).toContain('does not implement Unicode corpus, structure detection, AI, module generation, BookService, SourceTextService, or full workbench UI');
    }
  });

  it('records Task 7.12 as Unicode/newline corpus only', () => {
    const context = readFileSync(path.resolve('docs/engineering/CONTEXT.md'), 'utf8');
    const status = readFileSync(path.resolve('docs/engineering/V1-BLOCK-7-STATUS.md'), 'utf8');

    for (const document of [context, status]) {
      expect(document).toContain('Task 7.12 Unicode/newline corpus is implemented');
      expect(document).toContain('covers UTF-8 BOM, GB18030 manual retry, Japanese text, English text, fullwidth digits, CRLF/LF, and an overlong line');
      expect(document).toContain('encoding_required returns a pending import token and supported manual encodings');
      expect(document).toContain('does not implement structure detection, AI, module generation, BookService, SourceTextService, or full workbench UI');
    }
  });

  it('records the post-7.12 review remediation facts without stale boundaries', () => {
    const context = readFileSync(path.resolve('docs/engineering/CONTEXT.md'), 'utf8');
    const status = readFileSync(path.resolve('docs/engineering/V1-BLOCK-7-STATUS.md'), 'utf8');

    for (const document of [context, status]) {
      expect(document).toContain('Review remediation after Task 7.12');
      expect(document).toContain('book, source_text, and completed import job share one SQLite transaction');
      expect(document).toContain('books:import-source re-queries duplicate ids after a unique hash conflict');
      expect(document).toContain('actual source reads are bounded by the 20 MiB limit');
      expect(document).toContain('failure actions render executable buttons');
      expect(document).toContain('books:list reads persisted book summaries for reopen/open-existing actions');
      expect(document).toContain('pending tokens are cleared when the library session changes or closes');
      expect(document).toContain('one opened descriptor');
      expect(document).toContain('opaque session ID');
      expect(document).toContain('renderer i18n catalog');
      expect(document).not.toContain('Duplicate/conflict policy helper is implemented but not wired into the books:import-source IPC handler yet.');
      expect(document).not.toContain('Failure UI model and alert panel are implemented but not wired into a full renderer import entry yet.');
    }
  });
});
