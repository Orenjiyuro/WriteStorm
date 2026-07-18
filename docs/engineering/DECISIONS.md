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

- Renderer receives DTOs, not SQLite records.
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
- Historical migration tests must execute an explicit registry prefix ending at their owned migration; they must not run the mutable full `APP_MIGRATIONS` registry and then assert an old final version or forbid later migration ids. Current-schema and performance tests derive the final schema version from the registry's last migration rather than hard-coding registry length.
- Block 8 pure detection and fixture assets remain protected by the ADR SHA-256 manifest. Task 19 reattached its migration 002, persistence, Job, worker and IPC wiring without changing the 19 protected hashes.

Full rationale and the preservation manifest: `docs/adr/0001-pre-release-schema-reset-and-table-admission.md`.

## D014: Empty-Database Migration Replay And Schema Compatibility

Decision: The complete canonical migration registry must support **empty-database migration replay** from a genuinely empty SQLite database with zero business rows. Fresh installation and the runtime-schema validator both depend on this property. A failing replay must identify the migration id and name; successful replay must reach the registry's final version, preserve the WriteStorm application ID and schema epoch, and pass resulting-schema validation without pre-seeded business fixtures or a final-schema projection.

The **Schema Compatibility Gate** is complete for SQLite 3.53.2, the first and minimum supported runtime. It uses structured columns, foreign keys, indexes, uniqueness, exact admitted objects, and two-sided migration-owned CHECK/trigger/partial-index witnesses. This is not a claim of compatibility with older development SQLite runtimes; any future supported runtime must retain prior released fixtures and add cross-version evidence.

No handwritten DDL tokenizer/parser is approved or used. SQLite itself parses and executes the isolated semantic witnesses; regex, simple splitting, whitespace compression, and case folding remain prohibited for CHECK parsing.

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

## D021: Structure Edition Invalidation Transaction Seam

Decision: A successful structure freeze calls `StructureEditionChangePort` inside the same `LibraryUnitOfWork.write` transaction that freezes the set, increments `books.structure_edition`, and completes the structure-edition Job/checkpoint. The port is synchronous, DB-only, returns `undefined`, and may abort the entire transaction by throwing.

Rules:

- First and replacement freeze each invoke the port exactly once; draft creation/editing, unfreeze, and discard do not invoke it.
- The payload instructs affected `AnalysisModuleInstance` consumers to use `needs_rebuild`, Evidence/ReviewAsset consumers to use `stale`, and Perspective consumers to use `needs_refresh`.
- CompletionGate has no admitted runtime owner. Its payload is `invalidate_for_future_owner` with `persisted: false`; Block 8 must not claim a persisted CompletionGate transition.
- The default port is no-op. Reset migrations 001/002 do not admit speculative downstream tables, and Task 8.16 does not implement a real rerun.
- An adapter failure rolls back the frozen set, Book edition, Job, checkpoint, and adapter writes together.

## D022: Persistent Detection Run Order

Decision: Every structure detection run receives a positive `run_sequence` that is unique within its Book. The sequence is allocated from the current per-book maximum inside the same SQLite write transaction that creates the queued run.

Rules:

- Latest-run and active-run selection order by `run_sequence DESC` only.
- Recovery state, retry capability, and manual-draft authorization consume the repository selection; they must not reconstruct timestamp or UUID ordering.
- `created_at` and `updated_at` remain display/audit metadata and are not causal ordering keys.
- Migration 002 owns the positive and per-book uniqueness constraints because it remains unpublished; a released schema would require a forward migration instead.

## D023: Analysis Module Definition Admission

Decision: Task 9.2 admits migration 003 `analysis_module_definitions` and the `analysis_modules` reference table as the persisted definition source owned by the future `ModuleInstanceService`. The migration seeds exactly the seven ordinary analysis modules from its immutable migration-local `ANALYSIS_MODULE_DEFINITION_SEED_003`, and `AnalysisModuleRepository` rejects a persisted list that differs from the current shared contract in id, key, name, category, instance eligibility, or product order.

Rules:

- The seven `analysis_modules` rows are migration-owned reference seed data, not user business rows. Empty-database migration replay still requires zero user business rows and separately proves the exact seven reference rows.
- Stable key allowlisting, `id = key`, non-blank names, category, `creates_module_instance = 1`, and product order are protected by migration-owned SQLite constraints and semantic witnesses.
- `AI 约束摘要` remains the `ai_constraint_summary` secondary system page. It is not an `analysis_modules` row and does not create an ordinary instance.
- Task 9.2 does not admit `analysis_module_instances`, module body/assets, AI execution, Jobs, module IPC, or workbench UI.
- The retained real SQLite 3.53.2 schema-v2 fixture remains validated against migrations 001/002. A writable copy must upgrade through migration 003 and pass the complete runtime-schema validator without modifying the retained fixture.

## D024: Analysis Module Instance Identity and Source Edition

Decision: Task 9.3 admits migration 004 `analysis_module_instances`. A persisted identity uses `book_id + module_id + scope_kind` plus exactly one structured scope reference for `book`, `volume`, `chapter`, or `story_segment_range`; it is never an opaque polymorphic scope string. The migration creates only book-scope shells and backfills seven ordinary module instances for every already-frozen Book.

Rules:

- Foreign keys protect every reference, a mutually exclusive CHECK protects the discriminator shape, cross-table triggers require the frozen source set and referenced node/range to belong to the same Book snapshot, and one partial unique index per scope kind protects its natural identity. Reverse-protection triggers prevent later edits to a referenced source set's Book/stage/edition, node's kind/set, or story range's set from invalidating that identity; changing only `is_current` remains legal for replacement freeze.
- Before creating the table or any shells, migration 004 requires the persisted module rows to exactly match migration 003's frozen seven-row seed, including id, key, name, category, instance eligibility, and product order. Missing or altered rows abort and roll back the migration; repair followed by retry is supported.
- Instance IDs come from an injectable ID factory. Migration backfill and the future runtime creation path must use that same factory contract; a failed backfill rolls back the migration, and retry cannot duplicate a natural module/scope identity.
- `structure_edition` is the source structure snapshot on which instance content is based. A replacement freeze may later mark an instance `needs_rebuild`, but it must not update an old instance's source edition to the Book's newer edition.
- Migration 004 backfills only Books with a matching current frozen structure set. It creates no fake `volume`, `chapter`, or `story_segment_range` instances, no eighth instance for the `AI 约束摘要` secondary page, and no AI content or Job runtime.
- Task 9.3 stores identity, scope, source version, revision, and status only. It does not add `body_markdown` or other asset placeholders; body/evidence/relation/technique/AI-constraint placeholders remain Task 9.5. It also does not wire future freeze creation, services, IPC, renderer queries, cache invalidation, or the module workbench.

## D025: Authoritative Module Workspace Gate

Decision: Task 9.1 keeps module workspace admission at a pure function boundary. The caller injects Book state, frozen-structure state, and a module contract snapshot; the gate performs no SQLite, LibraryService, or global-session access. The snapshot must exactly match the ordered authoritative Block 3 module/scope/asset/dependency contract or admission returns `module_contract_unavailable`.

Rules:

- Exact matching covers module keys; definition id, key, name, category, and instance eligibility; supported scopes and story-range relation; every allowed asset kind; required gates; and dependency edges.
- Seven rows that are merely unique and internally self-consistent are not authoritative. Narrowed scopes/assets, cleared dependencies, altered display/category semantics, reordered entries, or replacement keys must be rejected.
- Comparison is structural rather than reference-based. A decoded or cloned authoritative fixture is accepted, while tests prove failures through injected altered fixtures and never mutate shared constants.

## D026: Immutable Block 9 Migration Snapshots

Decision: migrations 003 and 004 own literal migration-local compatibility snapshots. Migration 003 uses `ANALYSIS_MODULE_DEFINITION_SEED_003` plus its frozen key allowlist for DDL and seed rows. Migration 004 uses `MODULE_INSTANCE_STATUS_VOCABULARY_004` for its status CHECK and validates schema-v3 rows against migration 003's frozen seed, never against mutable current-domain values.

Rules:

- Historical migrations may use erased shared-domain types but must not import mutable shared-domain values to generate DDL, seed data, constraints, or upgrade validation.
- Admission tests prove the frozen snapshots currently equal the shared definitions and statuses. A future mismatch is a demand for a new forward migration and an explicit compatibility decision, not permission to edit 003/004.
- Adding a module or status, or changing a module name, category, or order, must leave the replayed contents of migrations 003/004 unchanged.

## D027: Runtime Book-Scope Shell Creation

Decision: Task 9.4 implements `AnalysisModuleInstanceEditionChangePort` as the AnalysisModuleInstance owner of the existing synchronous DB-only structure-edition seam. Main composition injects it into `StructureService`; shell persistence therefore occurs in the same freeze transaction as the frozen structure, Book edition, structure-edition Job, and completion checkpoint.

Rules:

- First freeze creates exactly one book-scope instance for each of the seven current authoritative module definitions. IDs use the same injectable factory contract as migration 004 backfill, and the new frozen set/edition becomes the instance's source structure snapshot.
- Reapplying the same first-freeze change is idempotent. A partial or mismatched existing set is an error rather than permission to fill gaps or silently create duplicates.
- Replacement freeze keeps stable instance IDs and their historical source structure snapshot, and marks instances `needs_rebuild`; it must not update old `structure_edition` or `source_structure_set_id` to claim regeneration that did not occur.
- Any adapter or ID-factory exception rolls back the complete freeze UoW. A retry starts from the pre-freeze state and may atomically create all seven shells.
- Task 9.4 creates only book-scope shells. It does not create fake volume/chapter/range instances, asset placeholders, AI content, IPC, renderer cache behavior, or workbench UI.

## D028: Matrix-Derived Asset Placeholders

Decision: Task 9.5 adds forward migration 005 `analysis_module_asset_placeholders`, which owns the empty persisted `body_markdown` field without rewriting migration 004. Evidence, relation, technique, and `ai_constraint` placeholders are matrix-derived display slots with `尚无资产`; they are not fabricated business rows.

Rules:

- Placeholder slot order is body, evidence, relation, technique, then `ai_constraint`. Each slot lists only asset kinds allowed by that module's authoritative asset matrix; technique may represent observation and reusable-candidate kinds when both are allowed.
- The ordinary module asset kind `ai_constraint` may produce a `尚无资产` slot. The `ai_constraint_summary` secondary system page is not an AnalysisModule, creates no eighth instance, and must be rejected by the placeholder builder.
- Migration 005 adds `body_markdown TEXT NOT NULL DEFAULT ''` with a text-storage CHECK. Existing and future instances receive the same empty body without changing identity, revision, status, or source edition.
- No speculative asset tables are admitted for evidence, relation, technique, or AI constraints. Their future persistence requires complete identity, owner, lifecycle, real write/read paths, and a new forward migration.
- Task 9.5 adds no real asset content, evidence extraction, relations, technique candidates, AI execution, service/IPC reads, renderer behavior, or workbench UI.

## D029: Frozen-Structure Module Workbench Placement

Decision: Task 9.6 owns a renderer-only `AnalysisModuleWorkbench` presentation boundary. The workbench is mounted through the real Breakdown shelf for an opened Book only when its structure workspace has a frozen set and a module-instance list has been injected; it has no standalone or side-door route.

Rules:

- The list uses the authoritative seven-module product order and each item exposes its real structured scope and instance status. The selected detail shows module key/name, scope, status, source structure edition, analysis revision, and the matrix-derived empty Markdown-body placeholder.
- Unknown module ids fail visibly as a contract mismatch instead of being presented as ordinary modules. `ai_constraint_summary` therefore cannot appear as an eighth workbench item.
- Task 9.6 does not read SQLite or global session state from renderer code and does not implement `modules:list-instances`. Task 9.8 owns the typed main/IPC adapter, query key containing Library `sessionId` plus `bookId`, freeze refresh, and cross-session cache isolation.
- Task 9.7 owns disabled AI action affordances. Task 9.6 adds no analysis, rerun, diff, body-edit, evidence, relation, technique, or AI-constraint action.

## D030: Honest Disabled AI Action Shell

Decision: Task 9.7 exposes Run analysis, Rerun module, and View rerun diff only as native disabled controls in the selected `AnalysisModuleInstance` detail. Every control has a distinct visible reason connected with `aria-describedby`; a generic banner is insufficient because the prerequisites differ.

Rules:

- Analysis is disabled because the required Codex SDK compatibility spike has not passed and no AI runtime is admitted.
- Rerun is disabled because no AI Job runtime exists. Diff is disabled because no rerun candidate exists and rerun diff is not implemented.
- Disabled actions have no callback, mutation, IPC invocation, Job creation, candidate revision, synthetic result, or fallback through `codex exec`, app-server, GUI automation, API keys, local models, or another provider.
- A future enablement must complete its owning gate and replace the corresponding disabled shell through an explicitly authorized Task; Task 9.7 itself does not weaken any AI boundary.

## D031: Session-Scoped Module Instance Read Path

Decision: Task 9.8 implements `modules:list-instances` as a read-only main-side `AnalysisModuleInstanceService` plus typed IPC adapter. The service reads the current Library unit of work, evaluates the pure module-workspace gate against the persisted Book/current frozen structure and verified seven-module definition snapshot, and returns strict `ModuleInstanceSummary` values. It never exposes SQLite rows or body storage directly to renderer.

Rules:

- The renderer query key is `['library-session', sessionId, 'module-instances', bookId]`. Omitting either `sessionId` or `bookId` is a cache-isolation defect.
- Successful freeze invalidates both `structureKeys.workspace(sessionId, bookId)` and `moduleInstanceKeys.instances(sessionId, bookId)`. Failed freeze does not claim a new instance list. Activating a different Library removes the complete previous-session query prefix.
- AppRouter treats Library `sessionId` as a renderer-state boundary: any observed session identity change clears the previously opened Book and withdraws its structure/module workbench before the user can open a Book in the next Library. A mounted A→B test must prove both the old cache removal and that B never displays A's seven instances.
- Missing Library, Book, frozen structure, authoritative module contract, or complete seven-book-scope shell set returns a stable blocker through `MODULE_ERROR`; unexpected errors remain the typed router's non-leaking `INTERNAL_ERROR`.
- `MODULE_ERROR.recoverable` is reason-specific. `no_current_library`, `book_not_found`, `structure_not_frozen`, and `structure_snapshot_mismatch` are user-repairable; `module_contract_unavailable` and `book_scope_instances_incomplete` indicate persisted-contract damage and are non-recoverable through the current UI. A renderer must not promise retry for the latter class.
- `modules:update-body` remains `NOT_IMPLEMENTED`. Task 9.8 adds no writes, volume/chapter/range shell creation, AI runtime, generated content, rerun candidate, or diff.

## D032: Module Workbench Boundary Acceptance

Decision: Task 9.9 closes Block 9 only when automated cross-layer tests and a packaged natural-entry journey jointly prove the `AnalysisModule` / `AnalysisModuleInstance` ownership boundary. The journey must start from the real Library entry, proceed through the Breakdown shelf and structure freeze, and discover the seven-instance Analysis workbench without a side URL or test-only renderer injection.

Rules:

- `analysis_modules` owns exactly the seven stable ordinary definitions and no per-Book scope, status, revision, source edition, or body state. `analysis_module_instances` owns that per-Book state and does not duplicate definition name, category, or product order.
- The ordinary module asset kind `ai_constraint` may have an empty asset placeholder, but the `ai_constraint_summary` secondary system page is neither an `AnalysisModule` row nor an eighth `AnalysisModuleInstance`.
- Packaged acceptance creates a Library, imports a Book from the Breakdown shelf, reviews and freezes the structure, then verifies seven ordered book-scope shells, their empty state, and the three honestly disabled AI actions. Reopening the Library must rediscover the persisted seven-instance workbench through the same natural route.
- This acceptance admits no real AI content, AI Job runtime, evidence extraction, volume/chapter/range instance fabrication, rerun candidate, or rerun diff. Those capabilities require later explicitly authorized Tasks.

## D033: Job Vocabulary And Capability Policy

Decision: Task 10.1 preserves the foundation-reset Job state machine and freezes a separate persisted Job-type and checkpoint-unit vocabulary. Existing persisted kinds remain `source_import`, `structure_detection`, and `structure_edition`. The first-freeze module-shell kind is `analysis_module_shell_creation`; the future AI kind is `analysis_module_instance_analysis`. `export` remains the export Job vocabulary. The future AI and export kinds are `contract_only`, non-creatable, and must not enter `JOB_PAYLOAD_SCHEMAS` before their separately authorized runtimes exist. Module-shell creation is `planned` and non-creatable until Task 10.4 atomically records the seven-instance batch.

Checkpoint units are `source_copy_and_metadata`, `structure_draft`, `structure_edition`, `analysis_module_instance_batch`, and `export_manifest_and_blocked_reason`. A checkpoint unit describes durable recovery granularity rather than Job state. Failed, cancelled, and completed Jobs keep prior checkpoints but cannot append new ones. Running, paused, and resumable are the currently admitted append states. Queued preparation checkpoints require an explicit future per-type policy; no Task 10.1 type admits one.

Cancellation has two owners. `JobService.cancel` may persist a dormant Job only when no runtime owner is attached, or may record cancellation after that owner confirms it has stopped and completed its cleanup. Runtime-owned import and structure detection cancellation must call their owner first. `jobs:cancel` may never change SQLite to `cancelled` before that confirmation. Transactional structure-edition and module-shell work is not independently cancellable.

Progress follows a frozen monotonic policy: `completedUnits` and a known `totalUnits` are nonnegative; completed work cannot exceed the known total; completed work cannot decrease; `totalUnits` may start null and become a fixed number once, but cannot return to null or change afterward. Resume remains disabled in Task 10.1. Keep draft is not applicable to import or module-shell Jobs; structure Jobs may later expose only an honestly disabled, type-specific affordance. Task 10.1 adds no service behavior, migration, IPC implementation, renderer surface, AI task, background queue, or export feature.

## D034: Existing Job Persistence Read Boundary

Decision: Task 10.2 reuses the `jobs` and `job_checkpoints` schema already admitted by migration 001. Migrations 001–005 remain unchanged, no migration 006 is created, and the schema version remains 5. The existing columns, Job foreign key, checkpoint cascade, positive sequence/version checks, per-Job sequence uniqueness, and indexes are sufficient for the Block 10 persistence read increment.

`JobRepository.list` returns every Job in the current Library when no Book filter is supplied, including records whose `book_id = null`; a Book id is only an optional narrowing filter. Product read order is deterministic `updatedAt DESC, id DESC`. `getWithCheckpoints` returns a persisted Job plus checkpoints ordered by sequence ascending, and the same detail must remain readable after a real SQLite close/reopen.

The repository validates persisted Job type vocabulary even though migration 001 intentionally stores extensible text. Unknown types fail closed with `invalid_persisted_job_type`. Malformed `payload_json` or `error_details_json` on a Job, and malformed checkpoint payload JSON, fail closed with `invalid_persisted_json`; raw malformed data is never returned to a future renderer adapter. Task 10.2 does not change JobService progress, transition, checkpoint, failure, or cancellation policy and adds no payload schema, IPC handler, renderer surface, AI runtime, queue, or export feature.

## D035: JobService Progress, Checkpoint, And Cancellation Policy

Decision: Task 10.3 extends the existing `JobService`; it does not introduce a replacement service. `createQueued`, generic transitions, and `completeWithCheckpoint` validate integer nonnegative units, monotonic `completedUnits`, completed work not exceeding a known total, and the one-way `totalUnits` rule. A total may move from null to one fixed nonnegative integer, but may not return to null or change afterward. Violations return `invalid_progress` before persistence.

Generic `appendCheckpoint` accepts running, paused, and resumable Jobs. Queued checkpoints require an explicit per-JobType preparation policy, and no current type has one. Failed, cancelled, and completed Jobs retain their existing checkpoints but reject new generic checkpoints with `invalid_checkpoint_state`. `completeWithCheckpoint` is the deliberate specialized exception: it validates the final kind, version, payload, progress, and transition, then writes completed state and its final checkpoint atomically. Blank failure codes return `invalid_failure` without changing the Job.

`JobService.cancel` receives `runtimeOwner: 'none' | 'confirmed_stopped'`. `none` is a caller assertion allowed only for a cancellable queued, paused, or resumable Job with no attached runtime owner. Running, estimating, or confirmation work requires `confirmed_stopped`. Transaction-owned structure-edition and module-shell Jobs reject cancellation. This API records cancellation state only; it does not stop a worker or clean files.

Task 10.5 owns real cancellation orchestration. It must make `SourceImportService` or `StructureService` stop the exact runtime operation and complete cleanup before calling the confirmed-stopped persistence path, and it must close legacy direct `transition(..., 'cancelled')` paths that could bypass owner confirmation. Until then Task 10.3 must not be described as implemented `jobs:cancel`, per-job source-import cancellation, or worker shutdown. No migration, IPC, renderer, AI runtime, queue, or export feature is added here.

## D036: Existing Flow Job Records And Runtime Module Shell Audit

Decision: Task 10.4 reuses the already implemented source-import, structure-detection, and structure-edition Job/checkpoint write paths. It does not introduce parallel records or replace their service ownership. The only missing existing-flow record is runtime module-shell creation. On a Book's first successful freeze, `AnalysisModuleInstanceEditionChangePort` creates exactly seven book-scope instances and one `analysis_module_shell_creation` Job with one matching final checkpoint. The Job payload identifies the frozen structure set and edition plus the exact seven-instance batch. Progress is `7/7` and the capability becomes implemented and creatable.

The instance rows, module-shell Job, final checkpoint, structure-edition Job, frozen set, and Book edition share the same freeze transaction. Failure at any point rolls back all of them. Reapplying the same first-edition change after the complete instance set exists is an idempotent read and creates no second Job. Replacement freezes only invalidate the existing instances and create no module-shell Job.

Migration 004 is historical data transformation, not a runtime operation. It must not fabricate `analysis_module_shell_creation` Jobs for its seven-shell backfill, and migrations 001–005 remain unchanged. Future AI analysis and export remain contract-only and absent from `JOB_PAYLOAD_SCHEMAS`. Task 10.4 adds no IPC, renderer surface, background queue, real AI work, export path, or worker cancellation. Per-job runtime cancellation and typed `jobs:list/get/cancel` orchestration remain Task 10.5.

## D037: Pre-10.5 Job Integrity Remediation

Decision: Job completion cannot change arbitrary ownership. A `source_import` Job must be unbound and may perform only `null -> imported Book` during its atomic completion. Every other Job must already have a non-null `bookId` equal to the completion Book. Pre-bound import completion, null-owned non-import completion, and cross-Book rebinding fail with `invalid_book_ownership` before state, progress, or checkpoint persistence changes.

Checkpoint kinds are owned per JobType. The current implemented kinds admit only their exact final checkpoint, and final checkpoints are written only by `completeWithCheckpoint`. Generic `appendCheckpoint` retains state eligibility checks but rejects final, repeated-final, cross-type, and otherwise unadmitted kinds with `invalid_checkpoint_kind`. No current type has an admitted intermediate kind. Future analysis/export policies record that any intermediate batch admission must first provide one atomic checkpoint + progress operation so `completedUnits` cannot diverge from durable work.

The capability matrix is executable admission policy. `createQueued` checks `creatable` before progress or payload validation and returns `job_not_creatable` for contract-only JobTypes even if a custom payload registry contains their schema. Payload injection is a validation seam, not an execution authorization seam.

Source import removes its hand-built completed DTO. `importBookWithSourceText` accepts only Job id, SourceText id, and timestamp, completes through `JobService`, returns the persisted JobRecord, and maps that record through the shared main-side Job-summary mapper. `SourceImportService` returns this mapped transaction result without replacing it. This remediation changes no migration, IPC, renderer, worker cancellation, AI, or export behavior; Task 10.5 still owns typed Job IPC and exact runtime-owner cancellation.

## D038: Typed Job IPC And Runtime-Owner Cancellation

Decision: Task 10.5 implements typed `jobs:list`, `jobs:get`, and `jobs:cancel` at the existing IPC boundary. `jobs:list` defaults to every Job in the current Library, including records with null `bookId`, supports an optional Book filter, and exposes the repository's `updatedAt DESC` order. `jobs:get` returns a separate persisted `JobDetail` equal to the existing summary plus Job type and validated checkpoints; it does not widen `JobSummary`. Expected application and persistence failures use the stable `JOB_ERROR` domain code, while request and response schemas remain enforced by the shared router.

Runtime cancellation is owner-first and exact by Job id. Source import registers each active operation before its first asynchronous worker boundary and exposes `cancelImport(jobId)`. An encoding-required pending record remains a source-import owner: cancellation persists the queued Job as cancelled, then clears tokens matching Job id, Library root, and session; an old retry consequently returns `pending_import_not_found`. Structure detection exposes `cancelDetectionAndWait(jobId)`. It aborts and awaits an active worker, or finds a persisted queued/running orphan by Job id and atomically changes the paired run to `failed/cancelled_by_user` and Job to `cancelled`. A structure Job is never sent to the Job-only ownerless fallback.

The cancellation application service pins the originating Library session across every read/write and owner await. Library session replacement pauses cancellation admission and waits for in-flight Job cancellation before publishing another session. A same-id Job in the replacement Library therefore cannot be observed or mutated by the original request. Active work whose owner cannot be confirmed fails closed with `runtime_owner_not_stopped`, and transaction-owned structure-edition/module-shell Jobs remain non-cancellable.

Lifecycle shutdown follows the same rule. An aborted source import removes staging or promoted artifacts and records `cancelled`, not a synthetic worker failure. Structure cancellation no longer uses a direct state transition before abort and instead persists only after the worker observes shutdown. These rules are protected by tests that observe the durable Job as non-cancelled inside the abort callback and cancelled only after the cancellation promise resolves.

Task 10.5 changes no migration or schema and adds no renderer surface, recovery UI, automatic resume, keep draft, AI analysis runtime, background queue, or export execution. Natural Library/Breakdown-shelf Job discovery begins in Task 10.6; all other product IPC placeholders remain not implemented.

## D039: Natural-Entry Job Recovery UI

Decision: Task 10.6 uses one always-visible, Library-wide `Jobs & recovery` panel on the real Breakdown shelf, placed after the Book list and before the opened-Book structure/module workspace. It is not a Diagnostics readout, side URL, modal, or Book-only list. Therefore Library-unbound failed imports remain discoverable alongside Book-owned import, detection, freeze, and module-shell Jobs. The list preserves persisted `updatedAt DESC` order and exposes state, progress, Book ownership, and update time. Selecting a row reads the distinct persisted `JobDetail` and displays JobType, failure reason, and checkpoint sequence/kind/schema/timestamp; raw checkpoint payload bodies are not rendered.

The renderer derives action affordances from the frozen Job capability and transition policies. Cancel is executable only for `runtime_owner_first` JobTypes whose current state admits cancellation, and the IPC remains responsible for exact owner-first orchestration. A restarted queued/running orphan structure detection is a supported natural Cancel path because StructureService owns the persisted run/Job pair; it is not a Job-only state change. Pending cancellation disables the button, and success invalidates both Library-wide list and selected detail. Resume is always disabled with a visible accessibility-linked reason. Keep draft is visible only for structure JobTypes whose capability is `structure_disabled`, with a type-specific disabled reason; import and module-shell Jobs omit it because it is not applicable.

List/detail queries may poll while queued, estimating, waiting, or running work can actively progress; dormant paused/resumable and terminal states do not poll. Import/structure mutations invalidate the Library-session Job key so newly created records become visible from the natural product path. Cancellation returned from source import maps to its explicit cancelled recovery copy. Task 10.6 adds no migration, schema, new Job state, background queue, automatic Resume, executable Keep draft, restart recovery, AI runtime, or export execution. Task 10.7 owns restart recovery and abandoned-runtime reopen behavior; a persisted failed/resumable fixture proves display only and does not claim a natural resumable producer.

## D040: Successful Library Activation Restart Recovery

Decision: Task 10.7 introduces a dedicated successful Library activation hook rather than attaching recovery to the generic session-change `finally` callback. Before create/open replacement, the handler records the previous session id. After the service returns, recovery is eligible only when both the returned summary and `LibraryService.getCurrent()` identify the same newly published session. Recovery is awaited before the renderer receives success. A stale, unchanged, or mismatched publication fails closed as recoverable `LIBRARY_ERROR` with `library_activation_mismatch` and never invokes recovery.

The main composition uses that hook to run `SourceImportService.recoverAbandonedImports()`. Recovery marks only queued/running `source_import` Jobs failed with `SOURCE_IMPORT_ABANDONED` and removes only their exact per-Job staging files. Existing failed/resumable Jobs and structure detection's explicit-recovery state remain preserved and discoverable through the natural Breakdown-shelf `Jobs & recovery` panel after reopen. If recovery itself fails, the handler closes the newly activated session and returns recoverable `LIBRARY_ERROR` with `restart_recovery_failed`; it never reports a half-recovered Library as open.

Persisted fixtures establish restart visibility for failed/resumable records but do not claim a natural resumable producer. Task 10.7 adds no migration, schema, background queue, automatic Resume, executable Keep draft, AI analysis runtime, or export execution. Task 10.8 owns the complete regression matrix and Block 10 status documentation.

## D041: Block 10 Regression Gate And Completion Boundary

Decision: Task 10.8 certifies the existing implementation instead of creating a second Job contract, repository, service, schema, IPC path, or recovery surface. The regression matrix must retain executable coverage for the complete state machine and capability vocabulary; progress, Book ownership, per-JobType checkpoint safety, final-checkpoint atomicity and rollback; contract, IPC, payload-schema, and persisted-JSON invalid payload rejection; and source import guards covering renderer path exclusion, main-side selection, Library-session identity, worker/staging cleanup, transaction compensation, and restart recovery.

Persisted detail validation is semantic, not merely global-schema validation. Every checkpoint kind must belong to its JobType. A completed Job has exactly one trailing final checkpoint with payload equal to the Job payload; a non-completed Job has no final checkpoint; early states cannot contain checkpoints unless their capability explicitly admits preparation. Cross-type history fails with `invalid_checkpoint_kind`; invalid final cardinality, state, order, or payload fails with `invalid_checkpoint_history`.

The regression gate also requires four race/recovery cases: cancel a restarted orphan structure detection through the natural `Jobs & recovery` panel and then detect again; cancel encoding-required import and reject the old token with `pending_import_not_found`; switch Library while cancellation awaits and prove the next Library is untouched; and insert a cross-type persisted checkpoint and prove `jobs:get` fails closed.

The completion authority is `docs/engineering/V1-BLOCK-10-STATUS.md`. A fresh `npm run check` must pass typecheck, all unit and integration tests, Windows x64 packaging, and the serialized packaged Electron suite through the unified local secondary-display gate. The natural product acceptance path remains the real Library/Breakdown shelf and its `Jobs & recovery` panel; Diagnostics, service-only tests, fixture-only URLs, or IPC calls cannot substitute for that path.

Block 10 is complete only for the persisted Job/recovery shell. A resumable fixture proves that restart preserves and displays the state, but there is no natural resumable producer. Resume and Keep draft remain disabled, future `analysis_module_instance_analysis` remains contract-only, `export` cannot create a Job, and no background queue, Codex SDK, AI content/runtime, automatic recovery execution, export execution, or migration 006 is authorized.

## D042: Export Blocked Status Contract And Owner Boundary

Decision: Block 11 defines export as a read-only readiness projection, not an Export record or execution lifecycle. The ordered targets are `markdown_package` and `machine_package`. Their runtime availability matrix is fixed: Markdown is `blocked`, machine is `unavailable`, and neither can report executable availability. Every target always includes `export_execution_not_admitted`.

Rules:

- The preview reads only admitted current facts: Book existence, current frozen structure edition, the authoritative ordered seven-module definition/instance set, module status, and whether each `body_markdown` is non-empty.
- Before structure freeze the preview is exactly expected `7`, actual `0`, non-empty `0`, and every module status count is zero. After freeze it is exactly expected `7`, actual `7`; an incomplete or altered set fails closed.
- Markdown and machine targets describe the same Book snapshot and must carry identical preview facts. Target-specific availability does not permit target-specific SQLite truth.
- Review assets, evidence anchors, technique assets, perspective views, and the completion gate are not admitted owners. Runtime emits only their stable `*_owner_unavailable` blockers and never treats missing tables as zero assets or emits future fact blockers.
- Future blocker vocabulary may exist in the shared domain, but runtime schemas reject blockers that cannot currently be produced.
- `ExportStatusDto` contains no Export id, Job id, path, timestamp, credential, token, key, secure-storage content, log body, original content body, or execution metadata.

## D043: Read-Only Export Status Path And Natural Entry

Decision: `exports:get-status` is the only implemented Export IPC channel in Block 11. The main service uses a narrow Library read port and the existing authoritative module workspace gate. Ordinary content blockers return a successful status DTO; missing Library/Book or persisted-contract damage returns the typed error boundary. No Export Job is created.

Rules:

- Renderer requests contain only `bookId`; strict request validation rejects `rootPath`, `outputPath`, `directoryPath`, `targetPath`, and every other extra field before service invocation.
- The Export runtime dependency graph cannot import filesystem or Electron APIs and cannot read environment credentials, authentication tokens, secret keys, secure storage, or full sensitive logs.
- The real Breakdown shelf shows both targets, blockers, preview summaries, excluded-content markers, and permanently disabled execution controls whenever a Book is open, including before freeze.
- `Jobs & recovery` may show an `Export readiness (not a Job)` subsection using the same status query. It remains outside the Job list/detail model, does not extend `JobSummary`, does not add a virtual row, and does not create a Job or checkpoint.
- Structure freeze/unfreeze invalidates the status query so the read projection follows the current Book facts. No renderer callback can execute export, choose a directory, submit a path, or write content.

## D044: Block 11 No-Write Gate And Completion Boundary

Decision: Block 11 completion requires combined logical and filesystem evidence rather than a database-file hash alone. `exports:get-status` is certified only when business-table snapshots and `database.totalChanges` remain unchanged, `jobs WHERE kind = 'export'` remains zero, existing `exports/` and `mirrors/` trees remain byte-identical, and all Library Markdown/JSON hashes remain unchanged.

Rules:

- The no-write gate preserves existing files; it does not require export or mirror directories to be empty.
- The packaged natural-entry smoke starts through the real Library/Breakdown shelf, imports and opens a Book, observes Markdown blocked and machine unavailable states, permanent execution blockers, disabled controls, the non-Job status summary, and zero Export Jobs.
- Diagnostics, a bypass URL, isolated component rendering, service-only tests, or direct IPC calls cannot substitute for the packaged natural user entry.
- The completion authority is `docs/engineering/V1-BLOCK-11-STATUS.md`. Final certification at commit `ddde1a1` passed 527 unit tests, 256 integration tests, Windows x64 packaging, and 13 packaged Electron E2E tests.
- Secondary-display placement is unified E2E infrastructure evidence, not a product acceptance blocker for Export readiness.
- Completion authorizes no real export package, filesystem write, directory selector, arbitrary path, migration, Export record, Export Job/checkpoint, Markdown/JSON back-write, Codex SDK, AI content, evidence extraction, future owner table, or Block 12 capability.

## D045: Technique Persistence Requires A Natural Adoption Producer

Decision: Task 12.1 is complete as a TechniqueEntry admission contract and blocked/deferred conclusion; it does not admit persistence. The original master repository/service target is deferred to Block 16 because a production TechniqueEntry may be created only by a natural adoption flow from a confirmed reusable candidate, and that producer is not admitted. Direct SQLite fixtures, test-only inserts, renderer-local state, manual primary creation, and automatic fusion are not production lifecycle owners.

Rules:

- A future TechniqueEntry is owned by the active Library, uses a stable opaque id, and has optimistic revision for title, summary, tags, applicable scope, limitations, and allowed status changes.
- Each TechniqueEntry owns exactly one immutable SourceSnapshot captured atomically with entry creation. The snapshot is never shared, replaced, updated, or independently deleted, and source trace ids do not become foreign keys to unadmitted tables.
- TechniqueEntry and SourceSnapshot writes never mutate observations, candidates, EvidenceAnchors, source review state, or the source Breakdown Book.
- Hard delete is not admitted; `deprecated` is the V1 retirement state.
- The current repository has no admitted reusable-candidate owner, confirmed-candidate read path, natural adoption producer, capture transaction, or duplicate-adoption identity. Therefore Block 12 authorizes no migration number, Technique production table, repository/service, IPC mutation, real edit form, or naturally reachable existing-entry edit.
- Technique persistence defers to Block 16. Block 12 Tasks 12.2-12.5 must show a truthful empty state, editing-unavailable reason, readonly SourceSnapshot contract position, and disabled adoption reason instead of fabricating entries or snapshots.
- Task 12.15 removes existing-entry editing from natural acceptance. It verifies the real empty state, disabled adoption, readonly/no-write-back boundary, and absence of Technique production tables.
- Storage representation for tags, limitations, and SourceSnapshot relations remains undecided until query, update, indexing, and migration semantics justify it. The design must not infer a multi-table shape from UI field names.

The detailed field matrix, RED evidence, and revised follow-up plan are recorded in `docs/engineering/V1-BLOCK-12-TECHNIQUE-ADMISSION.md`.

## D046: TypeLibrary Taxonomy, Version, And Prompt Governance Override

Decision: The approved TypeLibrary admission and continuous-plan documents override the historical master Task 12.6–12.9 assumptions while leaving the protected master plan unchanged. Block 12 does not infer seed identities from draft labels. The six proposed MainTypes are 日轻校园、异世界幻想、古代玄幻、现代幻想、都市恋爱、 and 无限流; each requires independent definition, boundary, validation-corpus, and verdict checkpoints. Individual admission does not seed automatically. An explicit `TypeLibraryVersion 1` release set selects which admitted identities may enter a later seed/schema proposal, including any intentionally reviewed subset.

Rules:

- MainType and ContentFocus are orthogonal. Import may finish without classification. A Book may persist zero or one MainType and zero to three unique ordered ContentFocus “看点标签”, including a focus-only not-ready configuration. Formal analysis blocks with `missing_main_type` when MainType is absent.
- Proposed built-in candidates are owned only by source-controlled admission records and typed fixtures. Before persistence admission there is no TypeLibrary production table and no seed operation; “empty seed” may not be represented by a zero-row production table. Future user-defined drafts are separate Library-owned objects with an independent local draft/sample/publication lifecycle.
- Optional import-time classification and post-import classification editing are both required natural paths after persistence admission. The common blocker title is “方法论尚未就绪，不能开始正式分析”, accompanied by `missing_main_type`, `type_definition_version_unavailable`, `methodology_not_ready`, `prompt_not_ready`, `schema_not_ready`, or `composition_conflict` as applicable.
- ContentFocus priority determines deterministic Overlay order but grants no override permission. Incompatible Overlays return `composition_conflict`.
- TypeDefinition, TypeDefinitionVersion, MethodologyVersion, and PromptTemplateVersion are independent. Book CAS updates pin TypeDefinitionVersions only on the current classification target; they never rewrite existing AnalysisConfigurationSnapshots or historical results. Logic upgrades create a new snapshot and impact plan, selectively rebuild actually affected modules, and require explicit confirmation for a complete rerun.
- EffectiveMethodologySnapshot and EffectivePromptSnapshot separately pin Base versions, ordered Overlay versions, schemaVersion, and compositionVersion. Taxonomy binding may exist before either snapshot is ready, but analysis cannot start.
- PromptTemplate states are not one enum. PromptTemplateRegistryEntry owns `publishedVersionId` and `activationStatus`; PromptTemplateVersion owns `sampleGateStatus = not_run | blocked | failed | passed`. Any edit creates a new draft version starting at `not_run`. Registry ownership is registry key + module key + TypeDefinition identity + `base | overlay`; each version pins exact TypeDefinitionVersion and MethodologyVersion provenance. Rollback repoints the published version and never mutates old Book snapshots.
- Task 12.7 remains an honest disabled shell. It does not create, copy, edit, archive, publish, activate, or rebase custom types in Block 12.

No TypeLibrary migration, table, seed, repository/service, IPC, renderer classification control, Prompt runtime, sample execution, or AI behavior is authorized until the candidate and persistence gates in the approved documents pass.

## D047: TypeLibrary Uses User Selection, Not Classification Admission

Decision: D046 remains authoritative for MainType/ContentFocus orthogonality, Book cardinality, current-target-only CAS, immutable analysis snapshots, version ownership, Prompt state separation, and the absence of unauthorized persistence. D047 supersedes D046 only where it required literary-taxonomy definition, boundary, example, corpus, module-impact, or admitted/rejected review. WriteStorm does not automatically classify or infer a Book type; the user alone selects it.

Rules:

- A built-in option confirmation requires only display name, one-sentence selection description, `user_only` authority with no automatic classification or source-text inference, and explicit deferral of methodology content to Block 14. Runtime validation belongs to Block 17; automatic type recognition is outside scope.
- Built-in option proposal status is `proposed | confirmed | deferred`. A confirmed option requires a stable key; an unconfirmed option has no stable key, production identity, seed membership, selector entry, or Book-binding eligibility.
- The six requested MainType display names are 日轻校园、异世界幻想、古代玄幻、现代幻想、都市恋爱、 and 无限流. Their one-sentence selection descriptions remain required input, so no stable keys or TypeDefinitionVersion 1 payloads are authorized yet.
- TypeDefinitionVersion owns the versioned display name and selection description. MethodologyVersion and PromptTemplateVersion remain separate and are not embedded in the selection definition.
- Before persistence admission there is no TypeLibrary production table and no seed operation. No migration number, physical schema, repository/service, IPC, or renderer selector may be inferred from this decision.
- Missing MainType blocks formal analysis with `missing_main_type`; focus-only metadata may persist after persistence admission. ContentFocus order controls Overlay composition order only, and incompatibility remains `composition_conflict`.
- Task 12.7 remains an honest disabled shell for future user-defined types.

## D048: MainType Copy Confirmation Precedes Stable Identity Release

Decision: Task 12.6B confirms seven built-in MainType display names and one-sentence selection descriptions supplied by the user: 日轻校园、日轻异界、现代都市、现代幻想、古代幻想、西式幻想、 and 诸天无限. This supersedes D047's six-name set. Copy confirmation and production stable identity release are separate gates.

Rules:

- `confirmationStatus = confirmed` proves only that exact user-facing copy is approved. It requires a display name and selection description but may retain `stableKey = null`.
- A stable key may be assigned only to confirmed copy and only through a separately approved TypeLibraryVersion release set. Copy confirmation alone creates no TypeDefinition identity, TypeDefinitionVersion payload, seed membership, selector eligibility, or Book binding.
- The exact seven strings are preserved in the source-controlled typed admission asset and `V1-BLOCK-12-TYPE-LIBRARY-ADMISSION.md`. They are selection guidance, not automatic classification rules, methodology, examples, boundaries, or validation corpora.
- There is still no TypeLibrary production table and no seed operation. No migration, repository/service, IPC, renderer selector, or Book mutation is admitted.
- Task 12.6C must separately confirm the built-in ContentFocus option set before release-set or persistence design proceeds.

## D049: ContentFocus Copy Confirmation Preserves Ordered User Choice

Decision: Task 12.6C confirms the first seven built-in ContentFocus display names and one-sentence selection descriptions supplied by the user: 恋爱炒股、英雄史诗、能力规则、种田运营、群像、事业、 and 冒险探索. They are user-selectable “看点标签”, not children of MainType and not automatic classifications.

Rules:

- Exact copy is preserved in the source-controlled typed admission asset and `V1-BLOCK-12-TYPE-LIBRARY-ADMISSION.md`. Copy confirmation assigns no stable key, production TypeDefinition identity, TypeDefinitionVersion payload, seed membership, selector eligibility, or methodology.
- Each Book later selects zero to three unique ContentFocus identities and explicitly orders its own binding. The admission asset's listing order is not Book priority and grants no Overlay override permission.
- These descriptions state selection intent only. Block 14 owns methodology and composition content; Block 17 owns runtime validation. No classifier, inference, examples, corpus, Prompt execution, or AI behavior is introduced.
- There is still no TypeLibrary production table and no seed operation. No migration, repository/service, IPC, renderer selector, or Book mutation is admitted.
- Task 12.6D cannot begin until stable identities, TypeDefinitionVersion 1 payloads, a TypeLibraryVersion 1 release set, and persistence ownership receive separate authorization.

## D050: Normalized TypeLibrary Persistence Ownership Selected

Decision: Option A is approved as the persistence ownership model. A future admitted TypeLibrary schema uses normalized SQLite ownership for TypeDefinition identities, immutable definition versions, immutable TypeLibrary release versions and membership, one current CAS-controlled Book binding, and its ordered ContentFocus associations. This selection rejects an authoritative TypeScript-only registry and JSON classification facts.

Rules:

- The selected logical tables are `type_definitions`, `type_definition_versions`, `type_library_versions`, `type_library_version_entries`, `book_type_bindings`, and `book_content_focus_bindings`.
- Independent Book binding avoids rebuilding the existing `books` table and preserves current Book identity and query order.
- This decision approves ownership boundaries only. K1 stable keys, exact TypeDefinitionVersion 1 identities, the fourteen-entry TypeLibraryVersion 1 release, CAS initialization/clear semantics, and archive policy remain pending.
- There is no TypeLibrary migration, migration number, production seed, repository/service, IPC, preload API, renderer selector, or Book mutation authorized by D050.
- The protected master plan remains unchanged. Implementation resumes only after the remaining persistence-admission decisions pass.

## D051: Opaque Namespaced TypeLibrary Stable-Key Mapping Approved

Decision: The K1 opaque namespaced ordinal mapping is approved for all fourteen confirmed built-in option copies. MainType keys are `builtin_main_001` through `builtin_main_007`; ContentFocus keys are `builtin_focus_001` through `builtin_focus_007`, each mapped in the user-confirmed display order recorded by the persistence-admission document.

Rules:

- Ordinals are immutable technical identity components. They are never reused and imply neither literary semantics nor per-Book ContentFocus priority.
- Built-in TypeDefinition ids will equal the approved stable keys; V1 version-id proposals append `_v1`. User-defined TypeDefinition ids remain generated and have `stableKey = null`.
- This decision freezes the mapping but does not publish identities. Under D048, typed admission fixtures retain null stable keys until the TypeLibraryVersion 1 release set is separately approved.
- The fourteen-entry release set, CAS initialization/clear semantics, archive policy, migration number, tables, seed, repository/service, IPC, preload API, renderer selectors, and Book mutation remain unauthorized.
- There is no TypeLibrary migration. D051 introduces no production persistence and does not change the protected master plan.

## D052: TypeLibraryVersion 1 Typed Release Approved

Decision: TypeLibraryVersion 1 is approved as an immutable shared-domain release containing all seven confirmed MainType V1 identities and all seven confirmed ContentFocus V1 identities under the D051 K1 mapping. `src/shared/domain/type-library-built-ins.ts` is the production typed source for these exact identities, copies, versions, kinds, and per-kind display order.

Rules:

- Built-in TypeDefinition ids equal their stable keys. Exact V1 TypeDefinitionVersion ids append `_v1`; every version owns the user-confirmed display name and selection description.
- The release has fourteen unique memberships and per-kind display order 0–6. Release order is presentation order only and never becomes a Book's ContentFocus priority.
- Test admission fixtures derive from the production typed registry; they are not a duplicate fact source.
- The typed release contains no MethodologyVersion, PromptTemplateVersion, sample status, publication runtime, automatic classifier, or AI behavior. Analysis remains blocked until later readiness owners exist.
- SQLite seed remains unauthorized. D052 creates no TypeLibrary migration, table, repository/service, IPC, preload API, renderer selector, or Book mutation.
- CAS initialization/clear semantics and archive-only retirement remain the final persistence-admission decision before migration work may be authorized.

## D053: TypeLibrary Book Binding CAS And Archive Lifecycle Approved

Decision: The TypeLibrary persistence design uses an absent Book binding row as revision 0, creates revision 1 on the first successful mutation, retains an empty binding row after selections are cleared, and uses archive-only retirement for definition facts. This closes the lifecycle-design prerequisite but does not authorize a migration or production persistence.

Rules:

- A Book with no binding row reads as unassigned with `revision = 0`; reads never insert a row.
- The first mutation requires `expectedRevision = 0` and creates revision 1. Later mutations require exact revision equality and increment exactly once.
- Clearing MainType and every ContentFocus retains the binding row and increments revision, preventing an ABA return to revision 0.
- Ordered ContentFocus replacement and parent revision update belong to one transaction. Persisted gaps or invalid references fail closed instead of being normalized silently.
- Deleting a Book may cascade its current binding and association rows because they have no independent history.
- TypeDefinition identities, TypeDefinitionVersions, TypeLibraryVersions, and release entries have no hard-delete path. Definitions retire through a one-way archive transition, and old releases remain immutable.
- Book binding CAS changes only the current classification target. It never rewrites an existing AnalysisConfigurationSnapshot or historical result.
- There is no TypeLibrary production table, no seed operation, and no TypeLibrary migration. Migration numbering and implementation require separate explicit authorization.

## D054: TypeLibrary Reference Registry Uses Migration 006

Decision: Migration 006 implements only the approved TypeLibrary reference registry: TypeDefinition identities, immutable definition versions, immutable TypeLibrary releases, immutable release membership, and the exact fourteen-entry V1 seed. Book binding persistence remains a separate checkpoint.

Rules:

- Migration 006 owns `type_definitions`, `type_definition_versions`, `type_library_versions`, and `type_library_version_entries`.
- The migration carries literal historical seed facts instead of importing the mutable shared-domain registry. Focused tests require those literals to equal the currently approved D052 release.
- The V1 seed contains 14 built-in identities, 14 immutable definition versions, one TypeLibraryVersion, and 14 immutable memberships with per-kind order 0–6.
- Foreign keys prove release entries reference the matching definition, definition version, and kind. Unique constraints protect one definition/version membership and one per-kind sort position per release.
- TypeDefinition identity fields are immutable; `archived_at` permits only one null-to-timestamp retirement transition and cannot be cleared or rewritten. Definition versions, releases, and release entries reject update and hard delete.
- Migration-owned two-sided semantic witnesses protect checks, foreign-key ownership, unique order, archive mutation, and immutable triggers. Empty-database replay and retained SQLite 3.53.2 upgrade reach schema version 6.
- Migration 006 creates neither `book_type_bindings` nor `book_content_focus_bindings`. It adds no repository/service, IPC, preload API, renderer selector, Book mutation, methodology, Prompt runtime, classifier, or AI behavior.

## D055: TypeLibrary Book Bindings Use Migration 007

Decision: Migration 007 implements the two Book-owned TypeLibrary binding tables after migration 006 reference facts. It freezes persistence invariants only and exposes no callable product mutation path.

Rules:

- `book_type_bindings` has one optional row per Book. Absence represents revision 0 and unassigned metadata; the first inserted row must have revision 1.
- Every binding update must preserve Book identity and increment revision exactly once. Repository `expectedRevision` comparison remains a later service responsibility.
- MainType identity and version are both null or both present. Present values must be a `main_type` entry in the binding's pinned TypeLibraryVersion.
- `book_content_focus_bindings` owns priority 1–3, unique definition identity, and unique definition-version identity per Book. Every row must be a `content_focus` entry in the parent binding's pinned release.
- Updating a parent release fails when an existing ContentFocus is absent from that release. The service must later replace ordered focuses and update revision atomically.
- Deleting a Book cascades its binding and ContentFocus rows without deleting reference definitions, versions, releases, or release entries.
- Migration-owned checks, foreign keys, triggers, unique constraints, and two-sided semantic witnesses protect these invariants. Retained SQLite 3.53.2 upgrade reaches schema version 7.
- Migration 007 adds no repository/service, import transaction integration, IPC, preload API, renderer selector, methodology, Prompt runtime, classifier, or AI behavior.

## D056: TypeLibrary Schema Boundary Inventory Closes Task 12.6D.1C

Decision: The migration 006–007 schema checkpoint is complete only with the durable boundary inventory in `V1-BLOCK-12-TYPE-LIBRARY-SCHEMA-INVENTORY.md`. The inventory separates database-owned facts from future repository/service transaction and error-mapping responsibilities.

Rules:

- Migration 007 rejects direct deletion of a Book binding while its Book exists, so an established revision cannot return to absent-row revision 0. Book deletion still cascades binding rows.
- TypeLibraryVersion headers declare a positive immutable `entry_count`. Release-entry inserts are accepted only until that capacity is reached; V1 is sealed at exactly 14 entries and rejects a fifteenth member.
- Every migration-owned CHECK and trigger has accept/reject semantic witnesses. Unique, foreign-key, cascade, exact seed, empty replay, runtime-schema reproduction, and retained SQLite 3.53.2 upgrade have focused integration evidence.
- Priority range and uniqueness are database-owned; contiguous priority order is aggregate-read validation owned by the future repository/service. A persisted gap returns `invalid_persisted_book_type_binding` and is never renumbered silently.
- No-row revision mapping, `expectedRevision` comparison, atomic focus replacement plus parent revision, future release publication completeness, stable domain errors, and query mapping remain repository/service responsibilities.
- Task 12.6D.1C is complete. This decision adds no repository/service, import integration, IPC, preload API, renderer control, methodology, Prompt runtime, classifier, or AI behavior.

## D057: TypeLibrary Read Repository Fails Closed

Decision: The first Task 12.6D.2 checkpoint implements main-only TypeLibrary release and Book-binding reads. It does not implement a mutation service or expose IPC.

Rules:

- Shared `TypeLibraryReleaseOptions` and `BookTypeBindingRead` schemas are strict. `BookTypeBindingRead` alone admits revision 0 as the representation of an existing Book with no binding row; persisted classification targets still require positive revisions.
- `listReleaseOptions` reads a requested or latest release, verifies complete immutable membership count against `entry_count`, then returns only active selector options with contiguous effective per-kind order. Missing or incomplete historical membership throws `type_library_version_unavailable`; a fully archived selector is a valid empty list.
- `getBookBinding` returns null for a missing Book. For an existing Book with no binding row it returns revision 0, latest release version, null MainType, empty focuses, and null timestamp without inserting data.
- Persisted parent and child rows are ordered and parsed as one strict aggregate. Priority gaps, malformed timestamps, invalid references, or other parse failures throw `invalid_persisted_book_type_binding`; nothing is renumbered or repaired silently.
- Repository reads accept an explicit `SqliteDatabase`, matching existing main-process repository patterns. They expose no filesystem paths, SQLite handles, secrets, SDK values, or renderer access.
- First-write CAS, update CAS, atomic focus replacement, mutation errors, import integration, IPC/preload, renderer controls, methodology, Prompt runtime, classifier, and AI remain unimplemented.

D053/D054/D057 remediation in Task 12.6R5:

- Migration 006 enforces a one-way archive transition: `archived_at` may move from null to one non-blank timestamp exactly once, and cannot be cleared or rewritten.
- Immutable release membership remains historical truth and still must equal the declared `entry_count`. The product rule is that current selectors exclude archived definitions and derive a dense effective per-kind order without rewriting stored release order; historical pinned Book bindings remain readable.
- An all-archived release produces a valid empty current selector rather than corrupting the immutable release header. Historical pinned Book bindings remain readable through their stored definition/version references.
- New or replacement Book bindings reject archived references as `type_definition_version_unavailable`; archive retirement therefore has both read-path and write-path effect.
- Task 12.6R5 adds no archive UI or IPC mutation, new migration number, custom-type lifecycle, snapshot rewrite, methodology, Prompt runtime, classifier, or AI behavior.

## D058: TypeLibrary Book Binding CAS Service Completes Task 12.6D.2

Decision: Main-only `TypeLibraryService` and `TypeLibraryBookBindingMutationPort` complete Task 12.6D.2. They expose no IPC, preload API, renderer selector, or automatic classification behavior.

Rules:

- An absent binding accepts only `expectedRevision = 0` and creates revision 1. Existing bindings accept only their exact revision and increment once; stale or repeated first writes return `revision_conflict`.
- MainType is nullable and ContentFocus is an ordered zero-to-three unique list. The service verifies every selected definition/version pair exists in the explicit pinned release and has the requested kind.
- ContentFocus replacement, parent revision update, and retained-empty binding persistence are one SQLite transaction. Any child failure restores the previous parent and children.
- Strict pre-mutation reads reject malformed persisted aggregates with `invalid_persisted_book_type_binding`; mutation never renumbers or repairs corruption silently.
- Stable service errors include `book_not_found`, `revision_conflict`, `type_library_version_unavailable`, `type_definition_version_unavailable`, `type_kind_mismatch`, `duplicate_content_focus`, `too_many_content_focuses`, and `invalid_persisted_book_type_binding`.
- The mutation port can participate in an existing outer import transaction, but source-import product input and natural import-time selection remain unadmitted.
- A mutation updates only the current Book classification target. It does not write AnalysisConfigurationSnapshots, historical analysis results, methodology, Prompt state, classifier output, or AI content.

## D059: TypeLibrary IPC And Preload Boundary Completes Task 12.6D.3

Decision: TypeLibrary exposes exactly three typed product channels and one narrow preload namespace. Task 12.6D.3 does not add a renderer caller, source-import product integration, or a natural user path.

Rules:

- The allowlist contains `type-library:list-options`, `type-library:get-book-binding`, and `type-library:update-book-binding`. Main composition connects only `TypeLibraryService` DTO methods.
- Shared strict schemas reject extra filesystem paths, SQLite fields, row identities, timestamps owned by main, secrets, tokens, secure-storage values, SDK/provider objects, and arbitrary extra fields before service invocation.
- Successful responses contain only release options, a nullable Book binding read DTO, or the updated classification target. No SQLite handle, filesystem path, source text, credential, or internal service object crosses the boundary.
- Known service failures map to `TYPE_LIBRARY_ERROR` with a stable `reason`; persisted corruption is non-recoverable and the other admitted user/service conflicts are recoverable. Unknown exceptions are sanitized by the typed router.
- Existing trusted-sender validation applies to all three channels. The preload namespace exposes only `listOptions`, `getBookBinding`, and `updateBookBinding`; it exposes no raw `ipcRenderer` or generic invoke escape hatch.
- Renderer discovery, optional import-time selection, later metadata editing, BookSummary display fields, readiness UI, and natural Electron acceptance remain Tasks 12.6D.4–12.6D.5.

## D060: TypeLibrary Natural Renderer Paths Complete Task 12.6D.4

Decision: The existing Breakdown shelf is the only admitted TypeLibrary renderer path. It supports optional import-time classification and later Book metadata CAS editing while formal analysis remains visibly blocked.

Rules:

- The initial `books:import-source` request may carry one strict TypeLibrary selection. Encoding retry cannot supply or replace that selection; the pending import token retains the original value.
- Book, SourceText, initial Book binding, ordered ContentFocus rows, completed Job, and final checkpoint commit in one transaction. An invalid selection rolls back every imported database fact.
- BookSummary adds only `mainTypeDisplayName` and ordered `contentFocusDisplayNames`. Exact TypeLibraryVersion, definition/version references, revision, and timestamp remain in the Book binding detail DTO.
- The natural Breakdown shelf exposes one user-only selector pattern for optional import classification and later Book metadata editing. It never inspects source text, infers a type, or silently selects a default.
- Metadata writes send the current binding revision as `expectedRevision`. Success invalidates both binding detail and the session-scoped Book list; service conflict reasons remain visible.
- Book metadata reads its selectors from the binding's pinned TypeLibraryVersion rather than the latest release. Editing cannot silently upgrade or rewrite an existing Book classification target.
- The readiness panel uses “方法论尚未就绪，不能开始正式分析”. No MainType shows `missing_main_type`; a selected MainType remains blocked by `methodology_not_ready`, `prompt_not_ready`, and `schema_not_ready`. Unavailable versions and future composition conflicts keep their frozen reason codes when applicable.
- Renderer code uses typed preload DTO methods only. It accesses no filesystem, SQLite handle, shell, secret, token, secure storage, SDK, provider, or source-text classifier.
- Task 12.6D.5 separately owns hidden-window/secondary-display Electron acceptance. This decision adds no methodology, Prompt runtime, sample preview, Codex call, provider call, or AI content generation.

D060 remediation in Task 12.6R1:

- The active Library session owns one retained user import selection in renderer state. `choose_file`, `choose_smaller_file`, and `retry_import` rebuild their request from that selection and the current TypeLibrary version; they never replace a non-empty selection with an unassigned request.
- An explicitly empty retained selection continues to mean unassigned. No default MainType or ContentFocus is introduced.
- Manual encoding retry remains pending token-owned. Its renderer request contains only `pendingImportId` and `encodingOverride`; the main-side pending token retains the original classification and renderer cannot replace it.
- Library-session replacement clears both renderer selection and main-side pending tokens. Retry retention never crosses Library ownership.
- Packaged Electron acceptance repairs an initially empty selected source file and proves the successful retried Book persists the retained MainType and ordered ContentFocus values through the natural product path.

D060 remediation in Task 12.6R3:

- `BookRepository.list` executes exactly three SQL queries regardless of Book count: the ordered Book/source list, all MainType display mappings, and all ContentFocus display mappings in Book/priority order.
- MainType and ContentFocus display rows are grouped by Book identity in main-process memory. This preserves `books.updated_at DESC, books.id ASC`, ordered ContentFocus labels, focus-only bindings, and unassigned empty displays without renderer or contract changes.
- `BookRepository.get` remains a fixed single-Book read and is not widened into the list aggregation path. No migration, index, schema, IPC, preload, or renderer change is required.
- A real migrated-SQLite integration test fixes the query-count ceiling at three and proves the count does not grow with the number of Books.

D060 remediation in Task 12.6R4:

- A `revision_conflict` invalidates and refetches only the affected Book binding. It does not invalidate the Book list because the failed mutation changed no display fact.
- The renderer tracks whether the user selection is dirty. A conflict refetch updates the latest cached binding and revision, but it never overwrites the dirty user draft or silently merges selections.
- The visible conflict panel offers exactly two recoveries: “Retry my selection” resubmits the preserved draft with the refreshed latest revision; “Load latest saved classification” explicitly replaces the draft with the refreshed binding.
- A successful mutation writes its returned binding to cache before normal invalidation, clears conflict/dirty state, and then refreshes the binding plus display-only Book list. Opening another Book or Library clears conflict ownership.
- Packaged Electron acceptance drives both recovery paths through the natural Breakdown shelf and proves retry revisions advance from 1 to 2 to 3 without renderer access to SQLite or privileged APIs.

## D061: TypeLibrary Electron Acceptance Completes Task 12.6D.5

Decision: Real packaged Electron acceptance completes the governed TypeLibrary 12.6 sequence through the existing Breakdown shelf and typed production boundaries.

Rules:

- `tests/e2e/type-library-natural-path.spec.ts` launches the packaged desktop app on the existing configured secondary-display infrastructure; no new window-position product code is added.
- Two real application sessions cover import without selection, optional import-time selection, later assignment and editing, focus-only persistence after restart, zero-to-three ordered ContentFocus labels, and visible readiness blockers.
- Every acceptance-state write travels through natural renderer controls, preload DTOs, typed IPC, main services, and SQLite transactions. The test performs no direct SQL write; its final read-only query is supporting evidence rather than a substitute for the product path.
- Unassigned import remains visibly `missing_main_type`. A selected MainType remains visibly blocked by `methodology_not_ready`, `prompt_not_ready`, and `schema_not_ready` under the common readiness title.
- The run proves display-only BookSummary labels agree with persisted ordered bindings after query invalidation and process restart.
- Packaged preload-shape acceptance includes the `typeLibrary` namespace and its exact `listOptions`, `getBookBinding`, and `updateBookBinding` methods, preventing new narrow APIs from silently invalidating the full Electron suite.
- AppRouter E2E fixtures must satisfy `WritestormApi` directly. They may not use double assertions to hide an omitted namespace; the session harness supplies typed TypeLibrary DTO stubs and proves the Technique route triggers zero TypeLibrary reads.
- The accepted path performs no automatic classification, methodology execution, Prompt execution, sample preview, Codex SDK call, provider call, or AI content generation.
- Task 12.6 is complete. Task 12.7 custom-type behavior remains a separately authorized disabled shell.

## D062: Custom Type Entry Remains An Honest Disabled Shell

Decision: Task 12.7 adds only a discoverable disabled custom-type entry to the existing natural TypeLibrary classification editor. It does not admit any custom-type domain lifecycle or privileged boundary.

Rules:

- The target user is a Breakdown-shelf user who wants to derive a future custom type from an existing built-in option. The entry appears beside the existing user-selected classification controls at import time and during later Book metadata editing.
- The native disabled button says “Copy a built-in template to customize” and references a visible reason covering the unadmitted local identity, persistence, versioning, sample-validation, and publication flows.
- The disabled shell accepts no action callback and calls neither preload nor IPC. It cannot create, copy, edit, archive, publish, activate, or rebase a custom type.
- No custom-type migration, table, seed, repository, service, contract, IPC channel, or preload method is added. Existing `origin = user_defined` schema vocabulary remains only a reserved future boundary.
- Task 12.7 success means the future affordance and exact disabled reason are discoverable through the natural classification path without pretending that any custom-type object or workflow exists.

## D063: PromptTemplate Registry Is A Metadata-Only Domain Shell

Decision: Task 12.8 completes only the strict shared-domain metadata aggregate needed to name PromptTemplate registry identity and its independent version/status axes. It does not create a production registry or user-visible template capability.

Rules:

- Registry identity is registry key + module key + TypeDefinition identity + `base | overlay`. No concrete production registry key list, module/type mapping, template seed, or template body is approved in Task 12.8.
- PromptTemplateVersion pins its registry entry, TypeDefinitionVersion, MethodologyVersion, `templateVersion`, `schemaVersion`, role, sample gate, creation time, and nullable `publishedAt`. The explicit `templateVersion` name prevents confusion with `schemaVersion`.
- Version lifecycle is derived from publication history rather than a combined status enum: `publishedAt = null` is a draft and a timestamp is an immutable historical publication fact. Historical publication requires `sampleGateStatus = passed`.
- PromptTemplateRegistryEntry separately owns the current `publishedVersionId` and `activationStatus`. The aggregate rejects dangling or draft publication pointers, cross-registry versions, role mismatches, duplicate identities, duplicate template-version numbers, and enabled entries without a current published version.
- Editing never mutates or revives an old version. It creates a new version identity, increments `templateVersion`, resets `sampleGateStatus` to `not_run`, clears `publishedAt`, and preserves provenance fields until a later authorized editor contract says otherwise.
- `rolled_back` is an operation, not a version status. Task 12.10 owns the first minimal Settings/sample-preview entry; Task 12.11 owns publish/rollback/disable transition policy; Task 12.13 owns the broader Settings/AI capability shell; Block 14 owns methodology/template content; Block 17 owns real runtime validation.
- Task 12.8 adds no migration, table, seed, repository, service, IPC channel, preload method, renderer component, sample execution, publication transition, Codex SDK call, provider call, or AI generation.

D063 remediation in Task 12.8R1:

- Publication chronology compares parsed instants rather than ISO source-string order. A non-null `publishedAt` must be the same instant as or later than `createdAt`; equal instants are allowed, including representations with different UTC offsets.
- The invariant belongs to `PromptTemplateVersion` itself, so aggregate parsing, historical rollback targets, and future persistence cannot admit impossible publication history. It does not create a clock, persistence owner, or executable publish operation.

D063 remediation in Task 12.11R2:

- Every edited draft requires a new version identity; reusing the current `PromptTemplateVersion.id` is rejected before derivation.
- The next `createdAt` must not predate the current version. Chronology compares parsed instants rather than ISO source strings; equal instants are allowed, including equivalent values with different UTC offsets.
- Successful derivation still increments `templateVersion`, resets the sample gate to `not_run`, clears `publishedAt`, and preserves the remaining provenance fields. It does not mutate the current object.
- This is a pure domain guard only. It adds no Prompt body, persistence owner, clock, editor UI, IPC/preload method, sample execution, or publication mutation.

## D064: Book Version Snapshot Is Immutable And Module-Complete

Decision: Task 12.9 freezes the strict Book version-snapshot DTO and a source-controlled synthetic fixture. It corrects the earlier global Prompt snapshot shape but does not admit a snapshot producer or persistence.

Rules:

- AnalysisConfigurationSnapshot pins Book identity, source classification revision, TypeLibraryVersion, selected TypeDefinitionVersions, EffectiveMethodologySnapshot, EffectivePromptSnapshot, and creation time. It is immutable historical configuration, not a view over current registry pointers.
- Registry identity includes module key, so EffectivePromptSnapshot must contain exactly the seven authoritative ordinary module keys in canonical order. Every module independently pins Base and ordered Overlay registry/version identities, numeric `templateVersion`, and module `schemaVersion`; the effective composition separately pins `compositionVersion`.
- BookSummary remains list-focused and carries only display names. BookMetadataDetail independently carries BookSummary, the current mutable TypeLibrary binding, and a nullable latest immutable AnalysisConfigurationSnapshot. Classification CAS may make current binding differ from the latest snapshot; this divergence is valid and must not trigger snapshot rewriting.
- An upgrade envelope preserves both previous and next snapshots and binds an impact plan to the same Book and exact snapshot identities. The next snapshot must have a distinct identity, and its creation time is ordered by parsed instant rather than ISO source-string order. Mixed UTC offsets are valid only when the next instant is strictly later; equal instants are rejected.
- Without complete-rerun confirmation, rebuild module keys must exactly equal affected module keys. Explicit confirmation permits rebuilding all seven authoritative modules. Selective rebuild never silently expands beyond actual impact.
- Template publication, rollback, activation, TypeLibrary release changes, and Book classification CAS do not mutate old snapshots or historical analysis results. A future upgrade creates a new snapshot and separately executes its admitted impact plan.
- The Task 12.9 fixture uses synthetic Prompt identities under `tests/fixtures`; it is validation data, not a production key list, module/type mapping, seed, or fact source.
- Task 12.9 adds no analysis-configuration migration, table, repository, service, IPC, preload, renderer read path, production snapshot producer, methodology, Prompt runtime, sample execution, Codex SDK call, provider call, or AI generation.

## D065: Sample Preview Is A Visible Blocked Publication Gate

Decision: Task 12.10 introduces the minimal Settings product route required to make the sample-preview gate naturally discoverable. The route exposes only a blocked shell and does not implement preview execution or broader Settings capabilities.

Rules:

- The target user is a future template editor checking whether a template can be published. The user enters application-level Settings from top-level product navigation before a Library is opened and sees Templates & schemas → Sample preview.
- The sample action is a native disabled button with an accessibility-linked visible reason. The blocker codes are exactly `codex_sdk_gate_required`, `prompt_template_instance_unavailable`, and `sample_preview_runtime_not_admitted`.
- The shell explicitly states that a template version cannot be published until `sampleGateStatus = passed`. This is a hard-gate declaration, not a publish transition or permission implementation.
- The Settings route and sample-preview shell accept no action callback and call no preload or IPC method. Entering Settings enables no Breakdown-only queries and starts no background polling.
- The early Codex feasibility gate remains unexecuted and has no Go decision. Task 12.10 does not reinterpret a missing gate as success and does not fabricate a PromptTemplate instance or sample result.
- Real sample preview remains owned by Block 17. Task 12.11 owns publish/rollback/disable transition shells, and completed Task 12.13 extends this Settings route with AI/connector/log/schema/repair/health placeholders.
- Task 12.10 adds no sample Job, sample fixture execution, Prompt body, result persistence, migration, table, repository, service, IPC, preload, SDK call, provider call, AI output, or generated content.

## D066: Prompt Publication Controls Are A Non-Executing State Machine Shell

Decision: Task 12.11 freezes pure permission and transition-preview semantics for PromptTemplate publish, rollback, and disable, then exposes their currently unavailable state through the existing Settings route. It does not admit a production template or an executable mutation path.

Rules:

- Publication operations are exactly `publish`, `rollback`, and `disable`. The current shell has no registry identity, draft, published version, rollback target, or admitted PromptTemplate persistence, so every action remains disabled.
- Publish selection and sample status are resolved from a validated `PromptTemplateRegistryAggregate`; the shell does not duplicate those facts. Publish requires a draft version with `sampleGateStatus = passed`. `not_run`, `blocked`, and `failed` all return `sample_preview_not_passed`; no missing Codex or sample runtime gate may be interpreted as a pass.
- A successful publish preview records the immutable publication fact before repointing `publishedVersionId`, then validates the complete result through `promptTemplateRegistryAggregateSchema`. It cannot record a `publishedAt` instant earlier than the draft `createdAt` instant and never leaves the current pointer targeting a draft.
- Rollback is an operation that repoints the current published version to a distinct earlier immutable version. The target must resolve inside the validated aggregate and already have a non-null historical `publishedAt`; a draft or unknown target returns `rollback_target_not_published`. The preview never creates a `rolled_back` version status.
- Disabling changes only `activationStatus` from enabled to disabled. It retains the current published pointer, rollback target, immutable version history, and every existing Book snapshot.
- The shared transition function is a deterministic compound preview over the validated aggregate plus selected version identities. Every successful result is aggregate-valid; a blocked preview returns the exact input state unchanged. It writes nothing.
- Settings displays three native disabled actions with accessibility-linked, operation-specific reasons and exact blocker codes. The component accepts no callback and calls no preload or IPC method.
- The synthetic successful previews used by unit tests are contract examples, not production template instances or seed data. Real persistence, clock/authorization ownership, pointer mutation transactions, template instances, and runtime execution remain owned by Task 17.13. Task 12.11 adds no migration, table, seed, repository, service, IPC, preload, SDK/provider call, AI output, or Book snapshot mutation.

## D067: Original Shelf Remains An Independent Placeholder

Decision: Task 12.12 adds a natural top-level Original shelf route only as an honest non-creating placeholder. It does not introduce an original-writing data model or expose Technique Library content inside the route.

Rules:

- After opening a Library, the user can discover the Original shelf from top-level product navigation without entering Diagnostics or a direct-only URL.
- The route contains no original project list or invented instance. “Create original project” is a native disabled button with the visible reason that project creation is outside the V1 admitted scope.
- The Original shelf does not render Technique Library entries, reusable candidates, SourceSnapshots, adoption controls, editing controls, or mutable Breakdown Book evidence.
- Entering the route enables no Breakdown-only query and starts no Job polling. The route receives only the current `LibrarySessionSummary` for display context and has no action callback.
- Task 12.12 adds no `OriginalBook`, original-project migration, table, repository, service, IPC channel, preload method, creation handler, filesystem access, SQLite access, shell access, SDK/provider call, AI output, or generated content.

## D068: Settings Exposes Truthful AI And Maintenance Placeholders

Decision: Task 12.13 extends the existing natural Settings route with a static unavailable-capability shell. It reports known gate state and future entry ownership without probing a runtime or pretending that an operation exists.

Rules:

- The AI status is exactly `Codex SDK gate = Required` and `Connector = Unavailable`. This is a static product truth because the feasibility gate has not passed and no connector is admitted; it is not the result of SDK or provider discovery.
- Templates, schemas, repair, and health are visible as native disabled entry placeholders with accessibility-linked, owner-specific reasons.
- D070 completes Task 12.15 with the separate `local_only` observability policy and disabled recent-error, cleanup, and manual-export shell. Task 12.13 reads, clears, exports, or writes no log.
- Existing Task 12.10–12.11 template gate shells remain visible. Production template management and schema inspection remain unadmitted. Block 18 owns real Library health and repair execution.
- The shell has no props, callbacks, query, preload call, or IPC path. Entering Settings continues to enable no Breakdown-only query or Job polling.
- Task 12.13 adds no migration, table, repository, service, IPC channel, preload method, SDK/provider dependency, connector discovery, health scan, repair action, schema inspection, credential/token access, AI output, or generated content.

## D069: Block 12 Boundaries Are Executable Gates

Decision: Task 12.14 consolidates the four Block 12 cross-domain boundaries into focused executable tests. It adds no runtime policy object or product capability because the authoritative facts already belong to the existing Technique, OriginalReferenceSnapshot, IPC-channel, renderer-process, and AnalysisConfigurationSnapshot contracts.

Rules:

- TechniqueEntry continues to read provenance only through its SourceSnapshot. The gate requires `mayMutateSourceEvidenceState = false`, `sourceEvidenceStateIsReadonly = true`, no direct EvidenceAnchor ids, and no product channel capable of writing source/evidence/observation facts from the Technique namespace.
- Original remains a placeholder. The gate requires `createsOriginalBookData = false`, `followsSourceMutations = false`, no Original creation/import/generation/write channel, and no create callback or handler in the Original route.
- The renderer import scanner parses every production `.ts` and `.tsx` file under `src/renderer`. It rejects Node built-ins, Electron, SQLite, secure-storage packages, Codex/provider packages, and relative imports into main, preload, or utility-process code.
- Product IPC vocabulary independently rejects Codex/provider, secret/credential/token/secure-storage, filesystem, and shell channels. Renderer may continue to consume narrow typed DTO APIs admitted by prior Tasks.
- Template/version gates reuse the immutable AnalysisConfigurationSnapshot policy: upgrades require a distinct snapshot and explicit impact plan; selective rebuild targets only affected modules; a full rerun requires explicit confirmation. No current product channel may bulk-upgrade Books, auto-rerun, silently rerun, or rewrite snapshots.
- Every scanner has synthetic forbidden imports and channels as positive rejection witnesses, proving the test is non-vacuous and will fail on representative boundary violations.
- Task 12.14 adds no product capability, migration, table, repository, service, IPC, preload method, renderer control, SDK/provider dependency, AI output, original project, Technique persistence, template mutation, snapshot persistence, or rerun execution.

D069/D070 remediation in Task 12.QA-R2:

- Renderer dependency extraction covers ESM imports/exports, dynamic imports, and CommonJS `require()` so a privileged package cannot evade the gate by changing module syntax.
- Technique mutation namespaces cover both `technique:*`/`techniques:*` and `technique-library:*`; `technique-library:update-source` is a mandatory rejection witness.
- Privileged and unavailable execution namespaces include AI/Codex/provider, FS/filesystem, secrets/credentials/tokens, shell, logs/logging/observability, crash reports, telemetry, and usage statistics. `logging:upload` is a mandatory rejection witness.
- Original creation aliases include original Books/projects/writing, and template snapshot gates reject bulk upgrade aliases such as `templates:bulk-upgrade` in addition to auto/silent rerun and snapshot rewrite spellings.
- Every named bypass is a positive rejection witness. The production channel registry must remain empty under these predicates; QA-R2 adds no channel or runtime capability.

## D070: Local Observability Is Local-Only And Non-Executing

Decision: Task 12.15 exposes a truthful local-observability policy and disabled maintenance entries through the natural Settings route, then certifies the complete Block 12 product boundary. It does not admit a logging execution surface.

Rules:

- Observability storage scope is `local_only`. Crash reports and usage statistics are not uploaded remotely by default. Source text snippets are never recorded or uploaded.
- An unavailable local reader is not evidence of zero errors. The recent-error summary therefore reports `Unavailable` with a null count and explicitly avoids “No recent errors.”
- Clearing local logs requires explicit user action but remains disabled under `local_log_clear_not_admitted`. Manual export requires explicit user action but remains disabled under `manual_log_export_not_admitted`.
- The renderer component accepts no callback and accesses no preload, IPC, filesystem, SQLite, shell, secret, SDK, provider, or remote service. Task 12.15 adds no log channel or privileged implementation.
- Final natural acceptance covers the Technique Library empty state, disabled `Adopt confirmed candidate` reason, `Read-only · no write-back` SourceSnapshot contract, absence of Technique production tables, independent Original shelf, and Settings local-observability shell. It does not require an existing TechniqueEntry edit path.
- The Task 12.1 repository/service target remains blocked/deferred. No Technique migration, production table, producer, adoption transaction, repository, service, IPC mutation, or edit form is implied by Block 12 completion.

## D071: Archived Type Definitions Use Book-Pinned Display Metadata

Decision: Current TypeLibrary selector options and historical Book display facts are separate DTO concerns. `type-library:list-options` remains an active-only selector source, while `type-library:get-book-binding` returns Book binding detail containing the raw binding plus ordered pinned display metadata for every selected definition version.

Rules:

- Pinned display metadata follows binding order: MainType first when present, then ContentFocus priority order. It records exact definition/version identity, kind, immutable display copy, and `current_selectable` or `archived` availability.
- Current import selectors never receive archived definitions. A Book editor may render its own archived pinned value as a native disabled option so the saved historical identity remains visible but cannot be newly selected.
- A CAS update may retain an archived reference only in the same release, role, and priority slot: the command keeps the same pinned TypeLibraryVersion and exact slot. Removing it is allowed; re-adding, moving, replacing, or carrying it into another release returns `type_definition_version_unavailable`.
- Active pinned references must still belong to the Book's complete immutable release. A missing, mismatched, or non-member display fact is `invalid_persisted_book_type_binding`; the repository never fabricates a label from a current release.
- Mutation success invalidates and reloads Book binding detail instead of writing a bare binding aggregate into the detail cache.
- This decision adds no archive mutation UI or IPC, custom-type lifecycle, release upgrade flow, automatic classification, methodology, Prompt runtime, snapshot rewrite, or AI behavior.

## D072: Product And Technical Authority Reflect The Admitted Block 12 Model

Decision: The active product design, technical design, engineering context, and Block 12 status supersede stale Block 12 assumptions in the protected master plan without editing that historical planning record.

Rules:

- The built-in release contains exactly seven MainType and seven ContentFocus options. They are orthogonal user-selected axes, not a parent/subtype taxonomy, and WriteStorm does not infer or automatically assign them.
- Prompt sample gate, immutable publication fact, current published pointer, activation state, and rollback operation remain independent axes or operations rather than one status chain.
- Technique production tables remain unadmitted. Block 12 delivers a truthful empty/read-only shell with disabled adoption; Technique persistence, producer ownership, atomic adoption, and editable entries remain blocked/deferred.
- `TECHNICAL_DESIGN.md` inventories the actually admitted schema through migration 007 and does not reserve speculative Technique tables.
- The protected master plan remains unchanged as historical planning evidence. Its older six-name taxonomy, parent/subtype wording, single Prompt state chain, and Technique repository/service target do not override D072 or the active authority documents.

## D073: Settings Is Independent Of Library Lifecycle

Decision: Settings is an application-level product route. A user can discover and open it before a Library is opened so environment gates, connector availability, template/schema placeholders, maintenance ownership, and local-observability policy are visible before Library creation.

Rules:

- Product navigation is rendered for the no-Library state. `#/settings` renders `SettingsRoute` regardless of current Library availability; all other product routes retain the existing Library requirement and no-Library fallback.
- Entering application-level Settings enables no Breakdown-only queries, Job polling, TypeLibrary reads, filesystem/SQLite access, connector probe, SDK/provider call, or mutation.
- The Settings shells remain non-executing and callback-free. This routing change adds no preload method, IPC channel, persistence, credential access, or AI capability.
- Natural packaged acceptance starts with no Library, opens Settings through the visible product navigation, verifies the existing blockers and local policy, then returns to the Breakdown shelf no-Library entry.

## D074: Renderer Readiness Delegates To The Shared Evaluator

Decision: `evaluateTypeLibraryAnalysisReadiness` is the only authority that decides whether the current Book classification is ready for formal analysis. Renderer components may prepare its typed facts and localize its result, but must not reproduce blocker conditions.

Rules:

- `TypeLibraryBindingEditor` converts ordered ContentFocus selection into priority-bearing references and calls the shared evaluator for every render.
- A selected definition version is unavailable when it is absent from current selectable options, including an archived pinned historical value. Historical display and same-slot retention remain allowed, but formal analysis stays blocked until the unavailable selection is removed or replaced.
- `BLOCK_12_ANALYSIS_READINESS_DEPENDENCIES` truthfully records that methodology, Prompt, and schema are not ready. Composition defaults to `ready` only in the sense that no conflict fact exists yet; it does not claim that effective composition is runnable.
- Future Block 14 inputs may supply actual methodology, Prompt, schema, and composition facts through `TypeLibraryAnalysisReadinessDependencies`. They must not add renderer-only blocker logic.
- The UI preserves stable blocker codes as machine-readable attributes and displays localized blocker reasons rather than raw reason-code lists.
- This remediation adds no formal-analysis action, methodology, Prompt runtime, schema runtime, composition engine, persistence, IPC, SDK/provider call, or AI behavior.

## D075: Type Selectors Separate Names From Descriptions

Decision: A native TypeLibrary option displays only the option's short display name. The selected option's one-sentence selection description appears as wrapping helper text below its own control instead of being concatenated into the native option label.

Rules:

- MainType and each ordered ContentFocus selector use the same interaction. A populated selector connects to its selection description below the control through `aria-describedby`.
- An archived selection remains visible and disabled under its historical short display name. Its helper text is prefixed with `Archived selection` so retirement remains understandable without lengthening the collapsed option label.
- Unselected controls render no fabricated description. Changing selection immediately changes the helper text from the same DTO already used to build options.
- This presentation change does not alter TypeDefinition identity, version ownership, selector ordering, CAS, archive rules, persistence, preload/IPC boundaries, or analysis readiness.

## D076: Impact Plans Are Derived From Immutable Snapshot Differences

Decision: `deriveAnalysisConfigurationImpact` using `analysis_configuration_snapshot_diff_v1` is the authority for `AnalysisConfigurationImpactPlan.derivation` and `affectedModuleKeys`. An upgrade envelope rejects caller-declared affected modules that do not exactly match the deterministic diff of its previous and next snapshots.

Rules:

- Each module impact contains canonical reason codes: `effective_methodology_changed`, `effective_prompt_composition_changed`, and/or `effective_prompt_module_changed`.
- The current EffectiveMethodologySnapshot is global rather than module-scoped, so any base, ordered Overlay, schemaVersion, or compositionVersion change conservatively affects all seven modules.
- A global EffectivePromptSnapshot compositionVersion change affects all modules. A change confined to one module's Base, ordered Overlays, template versions, identities, or schemaVersion affects that module only.
- The envelope recomputes `deriveAnalysisConfigurationImpact(previousSnapshot, nextSnapshot)` and requires both the submitted derivation and ordered affected keys to match. Fabricated, stale, reordered, duplicated, or caller-declared affected modules are rejected.
- Selective rebuild keys equal the derived affected keys. Rebuilding all seven ordinary modules requires `completeRerunConfirmed = true`, including when every module is genuinely affected.
- Block 14 may introduce module-level methodology dependency facts only through an explicitly reviewed new derivation algorithm/version. It must not weaken this boundary back to caller declarations.
- Task 12.9 remains contract-only: this adds no snapshot producer, persistence, migration, repository/service, IPC/preload path, rerun execution, SDK/provider call, or AI behavior.

## D077: Prompt Aggregate Proves Provenance Ownership And Rollback Direction

Decision: The metadata-only `PromptTemplateRegistryAggregate` carries the exact TypeDefinitionVersion and MethodologyVersion provenance facts required to validate every PromptTemplateVersion. The `rollback` operation keeps its literal meaning and may only move the current pointer to a historically published version with a smaller `templateVersion`.

Rules:

- Aggregate provenance is a strict in-memory validation boundary, not a production seed or a new persistence owner. It adds no Prompt, TypeDefinitionVersion, or MethodologyVersion table, repository, service, IPC, preload method, or renderer capability.
- Every aggregate TypeDefinitionVersion belongs to the registry entry's TypeDefinition identity. Every MethodologyVersion belongs to that same definition, resolves an aggregate TypeDefinitionVersion, and matches the registry's `base | overlay` role.
- Every PromptTemplateVersion resolves both provenance identities inside the aggregate. Its MethodologyVersion must point to the same TypeDefinitionVersion that the Prompt version pins; unresolved, cross-definition, cross-version, or cross-role provenance is rejected.
- Provenance identities are unique inside the aggregate. Successful publish, rollback, and disable previews preserve the validated provenance facts and reparse the complete aggregate.
- A rollback target must be distinct, historically published, and have a smaller `templateVersion` than the current published version. A same or newer version returns `rollback_target_not_earlier`; moving forward remains a publish operation, not rollback.
- Successful rollback clears the selected rollback target rather than converting the previously current, newer version into another rollback target. Historical versions and existing Book snapshots remain immutable.

## D078: Publish Is Monotonic Across Version And Publication History

Decision: `publish` is the forward-only counterpart to constrained rollback. Once a registry has a current published version, a publish preview may only select a passed draft with a strictly larger `templateVersion` and may not record a publication instant earlier than the current immutable publication fact.

Rules:

- Publish permission returns `draft_version_not_newer` when the selected draft's `templateVersion` is equal to or smaller than the current published version. A caller cannot use publish to move the registry pointer backward or sideways.
- The compound transition validates the new `publishedAt` against both the draft's `createdAt` and the current published version's `publishedAt` using parsed instants. The new fact may equal but never predate the current publication instant.
- A registry with no current published version remains eligible for its first publication once the existing draft and passed-sample requirements are met.
- Rollback remains the only operation that can move the pointer to a smaller historically published `templateVersion`; moving to a larger draft remains publish.
- This is a pure permission/preview guard. It adds no clock, transaction, persistence, migration, repository/service, IPC/preload method, renderer mutation, Prompt body, sample execution, SDK/provider call, or AI behavior.
