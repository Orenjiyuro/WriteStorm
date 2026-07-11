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
