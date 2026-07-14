# WriteStorm Engineering Decisions

日期：2026-07-05  
状态：活跃决策记录

## D001: Target Platforms

Decision: WriteStorm targets Windows 11 and macOS desktop apps only.

Implications:

- No Web runtime or hosted Web app.
- UI can use web technologies only inside Electron.
- Platform-specific file dialogs, packaging and path behavior must be tested on both Windows 11 and macOS.

## D002: Desktop Stack

Decision: Use Electron Forge + Vite + React + TypeScript.

Reason:

- User selected Electron + React/TypeScript after comparing cross-desktop options.
- Electron supports Windows/macOS desktop packaging and lets the team use mature React editor/workbench patterns.
- Electron risks are handled through process isolation, typed IPC, no renderer Node access and explicit tests.

Rejected:

- WinUI 3/.NET: Windows-only.
- Avalonia/.NET: viable but not selected.
- Tauri/Rust/TypeScript: viable but not selected.
- Qt/C++/QML: viable but not selected.

## D003: Primary Store

Decision: SQLite is the only transactional main fact source.

Reason:

- WriteStorm needs stable local transactions, indexes, migrations, recovery and health checks.
- JSON/Markdown are still important, but only as export, mirror or human-readable artifacts.

Implications:

- Do not dual-write JSON as an authoritative source.
- Markdown body edits are controlled service writes into SQLite.
- Export and mirror files are rebuildable from SQLite plus source files.

## D004: Library Folder

Decision: A library is a user-selected local folder containing `manifest.json`, `writestorm.sqlite`, copied source files, exports, logs, cache and derived mirrors.

Implications:

- Imported source copies are owned by the library.
- Credentials never enter the library folder.
- `cache/` and `mirrors/` can be rebuilt.
- Migration packages include SQLite plus source files and derived export artifacts when requested.
- `manifest.json` identifies the library folder and uses `manifestVersion` for the manifest contract.
- If the manifest stores a database version field, it must be named `schemaVersionHint`; it is diagnostic only and must not override SQLite.
- SQLite `schema_migrations` is the authoritative schema-version source.
- SQLite `library` row is the authoritative library identity source for id, name and app version; manifest identity fields are bootstrap/diagnostic metadata only after the database exists.

## D005: Renderer Privilege Boundary

Decision: Renderer is unprivileged and talks to main through typed IPC only.

Rules:

- `nodeIntegration` off.
- `contextIsolation` on.
- Preload exposes only a typed `window.writestorm` API.
- Renderer cannot directly access fs, SQLite, shell, child processes or Codex SDK.

## D006: Service Boundary

Decision: Domain services live in main or utility/worker processes.

Services:

- `LibraryService`
- `BookService`
- `SourceTextService`
- `StructureService`
- `ModuleInstanceService`
- `JobService`
- `ExportService`
- `CodexService`
- `TypedIpcBridge`

Implications:

- Renderer receives DTOs, not raw database rows.
- Main validates paths and owns transactions.
- Heavy work moves to utility/worker process.

## D007: Codex SDK Is V1 AI Surface

Decision: V1 AI integration supports Codex SDK only.

Rules:

- Codex SDK spike must pass before real AI breakdown implementation starts.
- If SDK fails required checks, V1 AI is blocked.
- Do not fall back to `codex exec`, app-server, GUI automation, API Key, local model or another provider without a new product decision.

Required spike checks:

- Electron main/utility compatibility.
- Structured output.
- Cancellation or timeout.
- Error mapping.
- Logging.
- Auth/session behavior.
- Packaged Windows 11/macOS runtime.

## D008: First Implementation Increment

Decision: First implementation increment is breakdown workbench foundation, not AI.

Includes:

- Library create/open.
- Breakdown shelf.
- txt/md import.
- Source metadata.
- Structure review shell.
- Story segment range shell.
- Module instance shell.
- Job state shell.
- Export blocked state.

Excludes:

- Real Codex SDK integration.
- Real AI analysis output.
- Prompt template editor.
- Original novel project.
- Full technique-library fusion.

## D009: External File Changes

Decision: First increment does not add automatic file watching.

Reason:

- Source copies are treated as library-owned and immutable for the first slice.
- SQLite is the main fact source.
- External mutations are handled later by explicit health-check and repair flows.

Implications:

- No silent import from changed mirror files.
- Repair flow can detect hash mismatch, broken source copy and stale mirrors.

## D010: Package Manager

Decision: Use npm for initial scaffold and scripts.

Reason:

- Electron Forge documentation uses npm-compatible flows.
- It reduces package-manager choices for the first implementation thread.

Implications:

- Initial scripts must include `npm run typecheck`, `npm run test:unit`, `npm run test:e2e` and `npm run build`.

## D011: Validation And Test Stack

Decision: Use Zod for runtime validation, TanStack Query for renderer service-state caching, Vitest for unit/integration tests, React Testing Library for renderer component tests, and Playwright for Electron entry-path tests.

Reason:

- IPC needs runtime validation in addition to TypeScript.
- Renderer data should be cached as service data, not treated as local truth.
- First implementation must verify both domain behavior and real desktop entry paths.

Implications:

- Initial scripts must include `npm run typecheck`, `npm run test:unit`, `npm run test:e2e` and `npm run build`.

## D012: Library Entry Path Boundary

Decision: Library create/open paths are selected in the Electron main process, not supplied by renderer requests.

Rules:

- `library:create`, `library:open`, and `library:get-current` keep empty renderer request contracts.
- Production create/open uses main-side Electron directory dialogs and then calls `LibraryService`.
- Packaged e2e may use `WRITESTORM_E2E_LIBRARY_DIALOG_STUB=1` with `WRITESTORM_E2E_LIBRARY_ROOT` and optional `WRITESTORM_E2E_LIBRARY_NAME` to bypass native dialogs.
- The e2e dialog stub is read only by the main process at app launch; it is not exposed through preload or renderer APIs.

Implications:

- Renderer code cannot pass arbitrary filesystem paths to library IPC.
- Dialog-stub behavior is acceptable only for Electron packaged smoke tests.
- Source import, book services, and full Breakdown shelf behavior still require separate authorization.

## D013: Pre-release Schema Reset And Production Table Admission

Decision: Reset the unpublished Block 1-7 development migration history to schema epoch 2 and a single `001_v1_runtime_baseline`. There is no real user library requiring migration compatibility. Existing development SQLite libraries are rejected with `DEV_SCHEMA_RESET_REQUIRED` and recreated explicitly.

Rules:

- A production table is admitted only after its identity, owner, and lifecycle are frozen; real write and read paths exist; stable domain errors exist; and integration tests protect its invariants.
- Shared contracts and renderer readouts do not justify speculative shell tables.
- The baseline admits only Library, Book, SourceText, Job, and JobCheckpoint runtime tables.
- The canonical source path is `source/{sourceTextId}/{originalFileName}`.
- Job and JobCheckpoint are frozen now because Block 7 already persists real import Jobs; JobService owns transitions.
- Before the first external alpha or release tag, unpublished migrations may be reset. After that boundary, published migrations are immutable, evolution is forward-only, and pending migrations require a recoverable snapshot.
- Block 8 pure detection and fixture assets remain protected by the ADR SHA-256 manifest. Its migration, persistence, Job wiring, and IPC wiring stay paused until Task 19.

Full rationale and the preservation manifest: `docs/adr/0001-pre-release-schema-reset-and-table-admission.md`.

## D014: Empty-Database Migration Replay And Deferred Schema Compatibility

Decision: The complete canonical migration registry must support **empty-database migration replay** from a genuinely empty SQLite database with zero business rows. Fresh installation and the runtime-schema validator both depend on this property. A failing replay must identify the migration id and name; successful replay must reach the registry's final version, preserve the WriteStorm application ID and schema epoch, and pass resulting-schema validation without pre-seeded business fixtures or a final-schema projection.

The production validator in Task 12R-A is authoritative only for the same SQLite runtime and canonical registry. **Cross-SQLite compatibility is not yet verified** and must not be claimed.

The deferred **Schema Compatibility Gate** runs after Task 19 finalizes the V1 migration registry and before Task 20 full recertification. It must replace complete `sqlite_schema.sql` text equality as the final cross-version authority and cover structured columns, foreign keys, indexes, uniqueness, admitted tables/views/triggers, and semantically extracted CHECK constraints using real current-version and minimum-supported-version SQLite fixtures. Equivalent DDL formatting must be accepted and real semantic mutations rejected.

No handwritten DDL tokenizer/parser is approved. Before this gate is implemented, the project must investigate a mature SQLite-dialect parser, separately request any dependency installation, or approve a design based on SQLite's own parsing capability or another controlled canonicalization. Regex, simple splitting, whitespace compression, and case folding are prohibited for CHECK parsing.

## D015: Book Current-Source Ownership

Decision: A Book may point only to a SourceText owned by that same Book. The runtime baseline enforces `(books.current_source_text_id, books.id) -> source_texts(id, book_id)` and retains the single-column `current_source_text_id -> source_texts.id ON DELETE SET NULL` relationship for pointer cleanup. `BookRepository` also requires both ids in its join as a defensive read boundary for externally corrupted databases or connections that disabled foreign keys.

Implications:

- Cross-Book current-source pointers are rejected at write time.
- Deleting the current SourceText clears the Book pointer without changing Book identity.
- A corrupted cross-Book pointer maps to no current SourceText or edition instead of leaking another Book's source metadata.

## D016: SourceText Ownership And Health

Decision: `SourceTextService` owns SourceText metadata validation, canonical relative paths, per-Book edition calculation, duplicate-hash lookup, persisted mapping, and source health. Repository SQL is not exposed to IPC or renderer code. Canonical copied-source paths are `source/{sourceTextId}/{originalFileName}` and previous SourceText editions are immutable.

Health policy:

- `stale_staging` is the only automatically removable issue and cleanup must remain inside the resolved `source/.staging` directory.
- `orphan_source`, `missing_source`, and `hash_mismatch` require manual review.
- Symlinks are not followed as trusted source files.
- Task 14 does not promote staging files or own the Book/Job completion transaction; those remain Task 15 responsibilities.

## D017: Library Lifecycle Reentry During Unit Of Work

Decision: Library session identity changes take effect immediately, but an SQLite connection participating in an active `LibraryUnitOfWork.write` is closed only after its outermost transaction exits. Active-write depth is tracked per internal session and lifecycle cleanup is deferred for that session.

Implications:

- Closing or replacing the current Library from inside a write causes `LIBRARY_SESSION_CHANGED` and transaction rollback.
- Callback code that continues to use its captured old session before returning does not receive a native closed-connection error.
- A newly created/reopened session may remain published while the old transaction rolls back.
- The old connection is closed after rollback; deferred cleanup never keeps it as a public session.

## D018: Source Import And Job Completion Ownership

Decision: `SourceImportService` owns the txt/md import application sequence from a session-bound selection through worker staging, duplicate policy, no-overwrite promotion, one final `LibraryUnitOfWork`, filesystem compensation, and abandoned-import recovery. `JobService` exposes queued-only creation; generic transitions cannot enter `completed`, and completion must atomically bind the Book and append the final checkpoint.

Implications:

- A worker encoding rejection preserves only its stable error code and a session-bound pending token; worker messages are not exposed.
- A Library replacement after staging cannot write through the old session. Its exact staging file is removed, and the durable queued Job is handled when that Library next runs abandoned-import recovery.
- SQLite remains the unique-hash authority. A race after the precheck removes the promoted file, re-queries the winning Book and SourceText, and returns `duplicate_source_hash`.
- Recovery removes only `source/.staging/{jobId}.tmp` for source-import Jobs it transitions from queued/running to failed. Other staging and non-staging files remain subject to the existing health policy.
- Task 16 must make the IPC adapter delegate to this service; this decision does not move Task 16 into Task 15.

## D019: IPC Adapters And Main Composition

Decision: Product IPC adapters perform contract-facing selection and envelope mapping only. The Book import adapter captures the current Library session before opening the native dialog and passes that identity with the opaque selected path to the singleton `SourceImportService`; all source validation, worker, filesystem, duplicate, Job, and transaction behavior remains below the adapter.

Implications:

- `book-import-ipc.ts` cannot import privileged filesystem/crypto/SQLite modules or source-import business helpers.
- Pending encoding retries skip the native dialog and delegate the session-bound token directly.
- Main constructs the Book service, source worker runner, and SourceImport service once rather than per IPC call.
- Window close, Library replacement, and app quit pause new import admission, cancel active work, and await an idle barrier before cleanup or connection changes. Pause admission is reference-counted so overlapping lifecycle barriers cannot resume imports early; pending tokens are then cleared.
- Task 16 does not change renderer/preload contracts and does not reconnect Block 8 persistence or IPC.

## D020: SQLite Schema Semantic Compatibility Baseline

Decision: SQLite 3.53.2 is the first and minimum supported WriteStorm SQLite runtime. Schema compatibility at that baseline is established from SQLite's structured introspection plus migration-owned semantic witnesses, never by formatting-sensitive equality of complete `sqlite_schema.sql` text and never by a handwritten SQL parser. Witnesses may write only to an isolated temporary or in-memory database reconstructed from the source schema; the source library remains byte-for-byte unchanged with no sidecars. Partial indexes require an explicit semantic witness and expression indexes are not admitted by the V1 registry.

Implications:

- The project does not claim compatibility with libraries produced by older development SQLite runtimes.
- A future supported-runtime upgrade retains the real fixture for every previously released baseline and adds cross-version verification before compatibility is claimed.
- CHECK behavior is owned by the migration that introduces it, rather than inferred by a regex, split-based tokenizer, or duplicated final-schema SQL projection.
- Semantic witnesses require globally unique ids, exact migration ownership, and exact SQLite extended constraint classifications; an arbitrary SQL error never proves a constraint witness.
- Every CHECK, trigger, and partial-index predicate owned by a migration must declare a stable two-sided semantic boundary: one legal action that must succeed and one illegal action that must fail with its exact SQLite extended constraint code. Constraint deletion, relaxation, and tightening are mandatory mutation cases.
