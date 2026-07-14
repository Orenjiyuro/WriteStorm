# WriteStorm V1 Block 7 Import Gate Status

Date: 2026-07-09

Status: Historical Task 7.0-7.12 import checkpoint retained below; current override includes completed Book/SourceText services and Task 19 Block 8A structure detection. AI and module generation remain unimplemented.

## Block 7 6A deferral override

6A has not run and has no recorded Go/No-Go. The total thread authorizes Block 7 to proceed only as non-AI Foundation work because Block 6A.8 and the cross-block No-Go strategy allow non-AI Foundation blocks to continue even when AI feasibility is not yet Go.

Block 7 continued only as non-AI Foundation work. AI/Codex/prompt/runtime remain blocked. At this historical checkpoint, structure detection and module generation were blocked; Task 19 later completed Block 8A detection, while module generation remains unimplemented.

## Historical Authorized Scope

- Authorized scope: Task 7.0 through Task 7.12 only.
- In scope: record the 6A deferral override in engineering docs; define the import IPC request/response boundary; prove renderer cannot pass arbitrary source paths.
- In scope: production migration 003 adds source import metadata columns and a unique hash index.
- In scope: main-side `.txt`/`.md` file dialog adapter and main-only pending import token store.
- In scope: source text preflight for extension, readability, non-file selections, empty files, and 20 MiB size limit.
- In scope: source text encoding helper for UTF-8/UTF-8 BOM automatic decoding and GB18030 manual retry override.
- In scope: source text copy helper that stages copied bytes inside the library source directory before final rename.
- In scope: source text metadata helper that maps import artifacts into shared DTO and `source_texts` insert row shape.
- In scope: book + source_text transaction helper that inserts both rows and current source pointer in one SQLite transaction.
- In scope: duplicate hash detection and copied source target conflict mapping.
- In scope: source import failure view model and alert panel that provide concrete repair paths.
- In scope: packaged Electron import smoke through the desktop entry and main-process import dialog stub.
- In scope: Unicode/newline corpus coverage and GB18030 manual retry through a main-only pending import token.
- Historical Task 7 out of scope: structure detection, AI, and module generation.
- Historical Task 7 out of scope: dependency installation, AI/Codex SDK, prompt runtime, BookService, SourceTextService, and additional packaged import e2e beyond the Task 7.11 smoke. Later explicitly authorized tasks implemented BookService, SourceTextService, and Block 8A detection.

## Task 7.2 Source Import Metadata Schema

Historical note: Task 7 originally used unpublished migration `003_source_import_metadata`. The global reset deleted that migration; its admitted source-import columns and constraints now belong to migration 001, and the current registry reaches version 2 after migration 002.

Task 20 fresh packaged evidence revalidated the native dialog-stub import path as part of 7/7 Windows Electron e2e tests. Current source import delegates to SourceImportService, persists queued/running/completed Job policy and final checkpoint transactionally, and keeps source paths out of renderer requests. This does not authorize AI or claim macOS packaging.

The migration adds `source_texts.original_file_name`, `source_texts.size_bytes`, unique `idx_source_texts_content_hash`, and insert/update validation triggers that reject missing, blank, or non-positive source import metadata.

This does not implement file dialog, preflight, source copy, SQLite import writes, renderer import UI, BookService, or SourceTextService.

## Task 7.3 Main-side File Dialog Adapter

Task 7.3 main-side file dialog adapter is implemented.

The adapter selects `.txt` and `.md` files only through main-side dialog options. Production callers must provide a main-process `showOpenDialog` implementation; e2e may use `WRITESTORM_E2E_IMPORT_DIALOG_STUB=1` with `WRITESTORM_E2E_IMPORT_SOURCE_PATH`.

The pending import store keeps source paths in main memory only. pending import tokens are main-only, scoped to the current library session, TTL-bound, and renderer-visible tokens do not contain source paths.

This does not implement preflight, encoding detection, source copy, SQLite import writes, renderer import UI, BookService, or SourceTextService.

## Task 7.4 Source Text Preflight

Task 7.4 source text preflight is implemented.

Preflight checks extension, 20 MiB size limit, readability, non-file selections, and empty files. only `.txt` and `.md` are accepted.

This does not implement encoding detection, source copy, SQLite import writes, renderer import UI, BookService, or SourceTextService.

## Task 7.5 Source Text Encoding

Task 7.5 source text encoding helper is implemented.

UTF-8 and UTF-8 BOM decode automatically. GB18030 is available only through the manual retry encoding override; there is no automatic GB18030 detection.

Encoding failure returns an actionable `encoding_required` state with supported manual encodings. Pending-token persistence and retry wiring are completed in Task 7.12 and the post-7.12 review remediation.

This does not implement source copy, SQLite import writes, renderer import UI, BookService, or SourceTextService.

## Task 7.6 Source Copy

Task 7.6 source text copy helper is implemented.

The helper stages copied bytes in the library source directory before final rename, writes under `source/<sourceTextId>/<originalFileName>`, refuses to overwrite an existing copied source target, and cleans the staging file when copy or rename fails.

It returns copied source relative path, size, and content hash for later metadata writes.

This does not implement SQLite import writes, renderer import UI, BookService, or SourceTextService.

## Task 7.7 Source Text Metadata

Task 7.7 source text metadata helper is implemented.

The helper maps filename, ext, size, hash, encoding, import time, relative path, and source_text_edition from import artifacts.

It produces the shared SourceTextMetadata DTO and source_texts insert row shape for later persistence.

This does not implement book + source_text transaction, renderer import UI, BookService, or SourceTextService.

## Task 7.8 Import Transaction

Task 7.8 book + source_text transaction helper is implemented.

The helper inserts book and source_text rows in one SQLite transaction, then sets the book current source pointer to the inserted source text.

If source_text insertion fails, the transaction rolls back the book row when source_text insertion fails, leaving no half book in SQLite.

This does not implement duplicate/conflict policy, renderer import UI, BookService, or SourceTextService.

## Task 7.9 Duplicate And Conflict Policy

Task 7.9 source import duplicate/conflict policy helper is implemented.

duplicate content hash blocks import by returning `duplicate_source_hash` with the existing book id and existing source text id. It does not merge, overwrite, or create another book for the same source hash.

Copied source target conflicts are mapped to `target_conflict` with the library source relative path. The helper does not overwrite an existing copied source target.

This does not implement failure UI, renderer import UI, BookService, SourceTextService, or the full `books:import-source` orchestration.

## Task 7.10 Failure UI

Task 7.10 source import failure UI is implemented.

The renderer failure view model maps every stable `IMPORT_ERROR.details.reason` to a concrete repair path and action label. encoding_required offers explicit UTF-8 and GB18030 retry actions when a pending token is present. Duplicate hash failures point to the existing book/source ids, and target conflicts show the copied source relative path.

The alert panel renders the title, original failure message, repair path, and action labels for later wiring into the import entry flow.

This does not implement full renderer import UI, BookService, SourceTextService, native dialog e2e, or the full `books:import-source` orchestration.

## Task 7.11 Electron Import Smoke

Task 7.11 packaged Electron import smoke is implemented.

production import selection remains main-side native dialog selection. packaged e2e uses a main-process import dialog stub controlled by `WRITESTORM_E2E_IMPORT_DIALOG_STUB` and `WRITESTORM_E2E_IMPORT_SOURCE_PATH`; the renderer still cannot submit source paths and the e2e does not use Playwright web filechooser.

The smoke path creates a library through the desktop entry, imports a fixed `.md` fixture through `books:import-source`, shows the imported book/source metadata in the Breakdown shelf, and verifies the real SQLite rows plus copied source file in the packaged app output path.

This does not implement Unicode corpus, structure detection, AI, module generation, BookService, SourceTextService, or full workbench UI.

## Task 7.12 Unicode And Newline Corpus

Task 7.12 Unicode/newline corpus is implemented.

Task 7.12 covers UTF-8 BOM, GB18030 manual retry, Japanese text, English text, fullwidth digits, CRLF/LF, and an overlong line. The copied source bytes are asserted against the original fixture bytes.

 encoding_required returns a pending import token and supported manual encodings. The token is held by the main process, scoped to the current library root and an opaque session ID, and retry uses the token's source path and original title instead of letting the renderer send a path or rename the pending import.

This does not implement structure detection, AI, module generation, BookService, SourceTextService, or full workbench UI.

## Contract Boundary Decisions

- Initial import request shape is `{ title? }`.
- Manual encoding retry request shape is `{ pendingImportId, encodingOverride }`.
- Retry requests cannot include `title`; the eventual main-side token owns the original title so renderer cannot rename a pending import during retry.
- Renderer requests must not include `sourcePath`, `filePath`, `path`, or `rootPath`.
- UTF-8 and UTF-8 BOM decode automatically in Task 7.5.
- GB18030 is available only through `encodingOverride: 'gb18030'` and must not be silently auto-detected unless a future authorized task adds a deterministic confidence rule or an approved dependency.
- Task 7.6 source copy is filesystem-only. It does not claim true cross-filesystem/database atomicity; later SQLite import tasks still need DB failure cleanup and orphan handling.
- Task 7.8 covers SQLite transaction atomicity for book and source_text only. It still does not claim true filesystem/database atomicity for the copied source file.
- Task 7.9 duplicate hash policy blocks import and returns existing book/source ids; the database also enforces a unique `source_texts.content_hash` index as the write-time fallback. target path conflict returns the copied source relative path. Review remediation wires the policy into the full IPC import orchestration and maps a concurrent unique hash conflict back to the existing ids. It does not implement BookService, SourceTextService, or the full workbench UI; review remediation supplies the import orchestration and executable failure actions.
- Task 7.10 provides renderer-side repair copy and action models for import failures. Review remediation wires the actions to executable buttons and main/preload calls. It does not implement full workbench UI, BookService, SourceTextService, or native dialog e2e; review remediation supplies the minimum import action wiring.
- Task 7.11 wires the minimum import button and `books:import-source` path needed for packaged smoke, plus a minimum `books:list` reopen/open-existing path. It still does not implement structure detection, AI, module generation, BookService, SourceTextService, or full workbench UI.
- Task 7.12 wires `encoding_required` pending-token retry into `books:import-source` for manual GB18030 imports and adds Unicode/newline corpus coverage. It still does not implement structure detection, AI, module generation, BookService, SourceTextService, or full workbench UI.

## Current Blockers And Notes

- PendingImportStore is implemented as a main-only in-memory helper and is wired into `books:import-source` for manual encoding retry. It resolves tokens by current library root, opaque session ID, and expiry, keeps source paths out of renderer-visible data, and clears the token after a successful retry or library session change.
- Review remediation after Task 7.12: book, source_text, and completed import job share one SQLite transaction; a failed database write removes the copied source file before returning an error.
- Review remediation after Task 7.12: books:import-source re-queries duplicate ids after a unique hash conflict, actual source reads are bounded by the 20 MiB limit from one opened descriptor, and the copied bytes are the same descriptor-read bytes used for decode/hash.
- Review remediation after Task 7.12: failure actions render executable buttons; retry encoding calls the token-only retry contract, and open-existing actions use books:list reads persisted book summaries for reopen/open-existing actions.
- Review remediation after Task 7.12: pending tokens carry an opaque session ID, are rejected after a library session change, and pending tokens are cleared when the library session changes or closes. Tokens remain main-only and TTL-bound.
- Review remediation after Task 7.12: source import failure and opened-book UI copy is centralized in the renderer i18n catalog, with a static test preventing new hardcoded action/status labels.
- Native file-dialog e2e import smoke is implemented with a main-process env-gated stub. Later tests must continue to avoid Playwright web file chooser.
