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

Runtime cancellation is owner-first and exact by Job id. Source import registers each active operation before its first asynchronous worker boundary and exposes `cancelImport(jobId)`. Structure detection exposes `cancelDetectionAndWait(jobId)`. A runtime owner must abort the matching operation, wait for its worker to settle, finish cleanup, and only then persist cancellation through `JobService.cancel` with `runtimeOwner: 'confirmed_stopped'`. `jobs:cancel` delegates to that owner and verifies the durable cancelled result; it must never pre-write `cancelled`. Dormant queued/paused/resumable Jobs may take the `runtimeOwner: 'none'` path only when no owner is attached. Active work whose owner cannot be confirmed fails closed with `runtime_owner_not_stopped`, and transaction-owned structure-edition/module-shell Jobs remain non-cancellable.

Lifecycle shutdown follows the same rule. An aborted source import removes staging or promoted artifacts and records `cancelled`, not a synthetic worker failure. Structure cancellation no longer uses a direct state transition before abort and instead persists only after the worker observes shutdown. These rules are protected by tests that observe the durable Job as non-cancelled inside the abort callback and cancelled only after the cancellation promise resolves.

Task 10.5 changes no migration or schema and adds no renderer surface, recovery UI, automatic resume, keep draft, AI analysis runtime, background queue, or export execution. Natural Library/Breakdown-shelf Job discovery begins in Task 10.6; all other product IPC placeholders remain not implemented.

## D039: Natural-Entry Job Recovery UI

Decision: Task 10.6 uses one always-visible, Library-wide `Jobs & recovery` panel on the real Breakdown shelf, placed after the Book list and before the opened-Book structure/module workspace. It is not a Diagnostics readout, side URL, modal, or Book-only list. Therefore Library-unbound failed imports remain discoverable alongside Book-owned import, detection, freeze, and module-shell Jobs. The list preserves persisted `updatedAt DESC` order and exposes state, progress, Book ownership, and update time. Selecting a row reads the distinct persisted `JobDetail` and displays JobType, failure reason, and checkpoint sequence/kind/schema/timestamp; raw checkpoint payload bodies are not rendered.

The renderer derives action affordances from the frozen Job capability and transition policies. Cancel is executable only for `runtime_owner_first` JobTypes whose current state admits cancellation, and the IPC remains responsible for exact owner-first orchestration. Pending cancellation disables the button, and success invalidates both Library-wide list and selected detail. Resume is always disabled with a visible accessibility-linked reason. Keep draft is visible only for structure JobTypes whose capability is `structure_disabled`, with a type-specific disabled reason; import and module-shell Jobs omit it because it is not applicable.

List/detail queries may poll while queued, estimating, waiting, or running work can actively progress; dormant paused/resumable and terminal states do not poll. Import/structure mutations invalidate the Library-session Job key so newly created records become visible from the natural product path. Cancellation returned from source import maps to its explicit cancelled recovery copy. Task 10.6 adds no migration, schema, new Job state, background queue, automatic Resume, executable Keep draft, restart recovery, AI runtime, or export execution. Task 10.7 owns restart recovery and abandoned-runtime reopen behavior; a persisted failed/resumable fixture proves display only and does not claim a natural resumable producer.

## D040: Successful Library Activation Restart Recovery

Decision: Task 10.7 introduces a dedicated successful Library activation hook rather than attaching recovery to the generic session-change `finally` callback. Before create/open replacement, the handler records the previous session id. After the service returns, recovery is eligible only when both the returned summary and `LibraryService.getCurrent()` identify the same newly published session. Recovery is awaited before the renderer receives success. A stale, unchanged, or mismatched publication fails closed as recoverable `LIBRARY_ERROR` with `library_activation_mismatch` and never invokes recovery.

The main composition uses that hook to run `SourceImportService.recoverAbandonedImports()`. Recovery marks only queued/running `source_import` Jobs failed with `SOURCE_IMPORT_ABANDONED` and removes only their exact per-Job staging files. Existing failed/resumable Jobs and structure detection's explicit-recovery state remain preserved and discoverable through the natural Breakdown-shelf `Jobs & recovery` panel after reopen. If recovery itself fails, the handler closes the newly activated session and returns recoverable `LIBRARY_ERROR` with `restart_recovery_failed`; it never reports a half-recovered Library as open.

Persisted fixtures establish restart visibility for failed/resumable records but do not claim a natural resumable producer. Task 10.7 adds no migration, schema, background queue, automatic Resume, executable Keep draft, AI analysis runtime, or export execution. Task 10.8 owns the complete regression matrix and Block 10 status documentation.

## D041: Block 10 Regression Gate And Completion Boundary

Decision: Task 10.8 certifies the existing implementation instead of creating a second Job contract, repository, service, schema, IPC path, or recovery surface. The regression matrix must retain executable coverage for the complete state machine and capability vocabulary; progress, Book ownership, per-JobType checkpoint safety, final-checkpoint atomicity and rollback; contract, IPC, payload-schema, and persisted-JSON invalid payload rejection; and source import guards covering renderer path exclusion, main-side selection, Library-session identity, worker/staging cleanup, transaction compensation, and restart recovery.

The completion authority is `docs/engineering/V1-BLOCK-10-STATUS.md`. A fresh `npm run check` must pass typecheck, all unit and integration tests, Windows x64 packaging, and the serialized packaged Electron suite through the unified local secondary-display gate. The natural product acceptance path remains the real Library/Breakdown shelf and its `Jobs & recovery` panel; Diagnostics, service-only tests, fixture-only URLs, or IPC calls cannot substitute for that path.

Block 10 is complete only for the persisted Job/recovery shell. A resumable fixture proves that restart preserves and displays the state, but there is no natural resumable producer. Resume and Keep draft remain disabled, future `analysis_module_instance_analysis` remains contract-only, `export` cannot create a Job, and no background queue, Codex SDK, AI content/runtime, automatic recovery execution, export execution, or migration 006 is authorized.
