# WriteStorm Engineering Context

日期：2026-07-11
目的：给后续实现线程提供稳定领域语言、工程边界和当前仓库事实。

## Active V1 Foundation Reset

Task 20 fresh recertification on 2026-07-14 passed `npm run check`: TypeScript passed; unit passed with 87 files / 370 tests; integration passed with 21 files / 133 tests; Windows x64 packaging passed; and all 7 packaged Electron e2e tests passed serially. The serial Playwright policy is intentional because each spec launches the packaged desktop process. This evidence recertifies the current Windows foundation and Block 8A reattachment, not Block 8B/8C, AI feasibility, macOS packaging, makers, signing, notarization, or release readiness.

Current-state contradiction scans treat this Active V1 section and the implementation-status overrides below as authoritative. Files under `docs/voided/` are explicitly voided records; `docs/superpowers/specs/` and task plans retain historical RED states and planned boundaries as implementation evidence rather than current-state claims. Those historical sources may be excluded from a current-state scan, but active `CONTEXT.md` statements may never be excluded.

Task 12R-A hardens migration safety before source-worker work: pending migrations are snapshotted from a read-only source before any writable open, retention is ordered by the parsed backup timestamp, and create/open publish a Library session only after a runtime-schema descriptor dynamically derived from the active migration registry matches the resulting database.

Task 12R-A.1 freezes the **empty-database migration replay** contract: the complete `APP_MIGRATIONS` registry must execute in order from a truly empty SQLite database with zero business rows, identify a failing migration by id and name, produce the registry's final version, preserve the WriteStorm application ID and schema epoch, and pass the current runtime-schema validator. Migrations may transform existing data, but every migration must also accept the zero-business-row case used by fresh installation. No test may pre-seed business fixtures to satisfy this contract.

The Schema Compatibility Gate establishes SQLite 3.53.2 as WriteStorm's first and minimum supported runtime baseline. Compatibility is authoritative through structured SQLite introspection (`table_xinfo`, `foreign_key_list`, `index_list`, and `index_xinfo`), exact table/view/trigger admission, and migration-owned semantic witnesses executed only against an isolated in-memory reproduction. Full `sqlite_schema.sql` text equality is not a compatibility authority. This gate does not claim compatibility with older SQLite runtimes. A future supported-runtime upgrade must retain every previously released real baseline fixture and add cross-version verification.

Every migration-owned semantic witness has a globally unique stable id, an explicit owning migration id, and an exact expected SQLite extended constraint code. Syntax errors, missing objects, setup failures, and the wrong constraint class are validation failures rather than accepted rejection evidence. SQLite 3.53.2's file-header library-version field, fixture hash, and both accepted/rejected source-library zero-write paths are part of this Gate contract.

Every migration-owned CHECK, trigger, and partial-index predicate is also registered as a stable semantic boundary with both an accepted action and an exactly classified rejected action. The migration contract freezes the boundary inventory (001: 12 CHECKs; 002: 32 CHECKs, 10 triggers, and one partial index; 003: 6 CHECKs; 004: 4 CHECKs, 5 triggers, and 4 partial indexes; 005: one CHECK), and mutation gates prove that deleting, relaxing, or tightening a constraint cannot pass merely because object names and PRAGMA structure remain unchanged.

Task 12R-B freezes Book/current-SourceText ownership at two layers. SQLite rejects a `books.current_source_text_id` whose SourceText belongs to another Book through a composite ownership foreign key, while the existing single-column foreign key retains `ON DELETE SET NULL`. `BookRepository` independently joins on both SourceText id and Book id so externally corrupted or foreign-key-disabled data cannot expose another Book's source edition.

Task 14 introduces the persisted `SourceTextService`/`SourceTextRepository` boundary. Canonical paths are `source/{sourceTextId}/{originalFileName}`, editions are derived monotonically per Book without mutating prior editions, and duplicate lookup uses canonical SHA-256 values. Source health distinguishes `stale_staging`, `orphan_source`, `missing_source`, and `hash_mismatch`; only resolved files that remain inside `source/.staging` are auto-removable. Orphan source files/directories, missing files, and hash mismatches always require manual review.

Task 12R-C hardens real Library lifecycle reentry. When `closeCurrent`, `create`, or a later session replacement occurs inside an active `LibraryUnitOfWork.write`, session identity changes immediately but the old SQLite connection remains open until the outermost transaction rolls back. The caller receives stable `LIBRARY_SESSION_CHANGED`, never a native closed-connection error; then the old connection is closed. Nested writes use per-session depth tracking so cleanup cannot run early.

The Schema Compatibility Gate is complete for the first supported SQLite baseline, 3.53.2. It does not claim compatibility with older development runtimes. Structured PRAGMA descriptors, exact object admission, two-sided migration-owned semantic boundaries, and a real 3.53.2 fixture reject column/FK/index/CHECK/trigger/partial-index mutations without a handwritten SQL parser.

Task 15 centralized the source-import application use case behind `SourceImportService`. Import Jobs can only be created through queued-only `JobService.createQueued`; `running` is entered through transition policy, while `completed` is unavailable through the generic transition API and must use `completeWithCheckpoint` so Book binding, final progress, and the final checkpoint share the enclosing `LibraryUnitOfWork` transaction. Worker staging is promoted with a no-overwrite same-filesystem link, database failures remove the promoted SourceText directory, unique-hash races re-query the winning Book/SourceText, and abandoned queued/running import Jobs are recovered with `SOURCE_IMPORT_ABANDONED` while only their exact staging files are removed. Task 16 subsequently completed the IPC adapter cutover described below.

Task 16 completes that adapter cutover. `book-import-ipc.ts` owns only native dialog selection, pre-dialog Library session capture, delegation to `BookService`/`SourceImportService`, and stable response-envelope mapping; it cannot import filesystem, crypto, SQLite, source-copy, decoding, duplicate, metadata, preflight, or import-transaction modules. Main composition creates the Book service, source worker runner, and SourceImport service once. Window close, Library replacement, and app quit pause admission, cancel active source imports, and await their idle barrier before cleanup or session replacement; a reference-counted pause gate keeps overlapping lifecycle barriers closed until the last barrier exits. Pending encoding tokens are cleared at window/session/quit boundaries. Renderer/preload contracts do not change in this Task.

The accepted reset contract is recorded in `docs/adr/0001-pre-release-schema-reset-and-table-admission.md` and the approved global design. Its premise is that no real user library requires compatibility. The unpublished Block 1-7 migration history was replaced by schema epoch 2, migration 001 `v1_runtime_baseline`, and migration 002 `structure_workspace`; old development SQLite libraries are rejected with `DEV_SCHEMA_RESET_REQUIRED` rather than migrated in place.

Production tables now require a frozen identity/owner/lifecycle, real write and read paths, a stable error model, and integration-test coverage. Speculative shell tables are not admitted. The canonical source path is `source/{sourceTextId}/{originalFileName}`. The Job/Checkpoint core is frozen early because Block 7 already persists import Jobs. After the first external alpha or release tag, published migrations are immutable and changes are forward-only with pre-migration snapshots.

Task 19 reattached Block 8A detection persistence, Job lifecycle, worker and IPC wiring to migration 002 and the current service/UoW boundaries. The ADR's 19 pure detection/fixture hashes remain unchanged. At that checkpoint, Block 8B review/freeze and Block 8C invalidation were separate unfinished work; their later implementation status is recorded in `V1-BLOCK-8-STATUS.md`. macOS packaged smoke and release makers remain blocked/not verified.

Task 9.1 establishes the module workspace prerequisite gate as a pure function over injected Book, frozen-structure, and module-contract snapshots. It never reads SQLite, LibraryService, or global session state. A module snapshot is available only when its ordered module/scope/asset/dependency contract exactly matches all five authoritative Block 3 arrays, including definition names/categories, full scope and asset matrices, and dependency edges. Merely having seven internally consistent rows is insufficient; any semantic drift returns the stable `module_contract_unavailable` blocker. Tests inject cloned, incomplete, and semantically altered fixtures without mutating shared constants.

Task 9.2 admits migration 003 `analysis_module_definitions` and the `analysis_modules` reference table. At the Task 9.2 checkpoint, schema version was 3. Migration 003 seeds exactly the seven ordinary definitions from its immutable migration-local `ANALYSIS_MODULE_DEFINITION_SEED_003` and key allowlist; `AnalysisModuleRepository` independently verifies persisted id/key/name/category/order against the current shared contract before returning definitions. `AI 约束摘要` remains a secondary system page and is not seeded. These seven migration-owned reference rows are not user business rows for empty-database replay. Task 9.2 does not admit `analysis_module_instances`, create module shells, add AI content, or wire module IPC/UI.

Task 9.3 admits migration 004 `analysis_module_instances`. At the Task 9.3 checkpoint, schema version was 4. The table freezes a structured scope discriminator with mutually exclusive references for `book`, `volume`, `chapter`, and `story_segment_range`; foreign keys, cross-table integrity triggers, and per-scope partial unique indexes protect those identities. Before any shell is created, migration 004 verifies that all seven persisted module rows exactly match migration 003's frozen seed; missing or semantically altered rows roll back the migration. Its status CHECK uses the immutable migration-local `MODULE_INSTANCE_STATUS_VOCABULARY_004`. This Task creates only the seven ordinary book-scope shells for Books already frozen at migration time. Backfill and the future runtime path share an injectable ID factory contract, so retries remain atomic and cannot duplicate a natural module/scope identity. `structure_edition` records the source structure snapshot used by the instance; advancing the Book edition must not rewrite that historical source claim. Reverse-protection triggers make the referenced source set identity, node kind/set, and story-range set immutable once an instance depends on them, while still allowing replacement freeze to retire the old set's `is_current` flag. Task 9.3 does not create volume/chapter/range instances, body or asset placeholders, runtime freeze wiring, AI content, Jobs, module IPC, or workbench UI; placeholders remain Task 9.5.

Block 9 historical migration values are literal migration-local snapshots. Admission tests currently prove `ANALYSIS_MODULE_DEFINITION_SEED_003` and `MODULE_INSTANCE_STATUS_VOCABULARY_004` equal the shared contract, but the migrations never generate history from that mutable contract. A later module, name, category, order, or status change must update the domain and add a forward migration; it must not edit 003/004 to make the admission test pass.

Task 9.4 wires `AnalysisModuleInstanceEditionChangePort` into the real `StructureService.freeze` composition. On first freeze it creates exactly seven book-scope shells in the same freeze transaction and records the new frozen set/edition as each instance's source structure snapshot. Reapplying that first-freeze change is idempotent. On replacement freeze it does not create new identities or rewrite the source structure snapshot; it marks existing instances `needs_rebuild`. Any module-contract mismatch, incomplete instance set, source mismatch, or injected ID-factory failure aborts the complete freeze transaction, including Book/structure/Job/checkpoint changes, and retry can succeed without duplicates. Task 9.4 creates no volume/chapter/range instance, body/assets, IPC, renderer query, or UI.

Task 9.5 admits forward migration 005 `analysis_module_asset_placeholders`; the current schema version is 5. It adds `body_markdown` as non-null text with empty default for both existing and future instances. The five display slots—body, evidence, relation, technique, and `ai_constraint`—are pure derivatives of the authoritative module asset matrix and carry the empty state `尚无资产`; no empty asset rows are fabricated. The ordinary module asset kind `ai_constraint` is distinct from the `ai_constraint_summary` secondary system page, which remains outside `analysis_modules`, creates no eighth instance, and cannot request placeholders. Task 9.5 deliberately admits no speculative asset tables for evidence, relation, technique, or AI constraints before those objects have complete owner/lifecycle/write/read contracts. It adds no real asset content, AI execution, service reads, IPC, renderer, or UI.

Task 9.6 adds the renderer-only `AnalysisModuleWorkbench` list/detail surface. It orders ordinary instances by the authoritative seven-module definition order and displays module name/key, structured scope, instance status, source structure edition, analysis revision, and the matrix-derived empty Markdown-body slot. The natural product mount is inside the opened Book's Breakdown shelf after a frozen structure exists; there is no module side URL. At the Task 9.6 checkpoint that mount deliberately remained dormant until an injected instance list became available; real `modules:list-instances` handling, Library-session-scoped query keys, freeze invalidation, and session-change cache isolation were assigned to Task 9.8. No AI actions, body editing, asset persistence, or generated content were added by 9.6.

Task 9.7 adds three explicit disabled affordances to the selected module detail: Run analysis, Rerun module, and View rerun diff. Each native disabled button has its own visible, accessibility-linked reason. Analysis is blocked because the Codex SDK compatibility spike has not passed; rerun is blocked because no AI Job runtime is admitted; diff is blocked because no rerun candidate or diff implementation exists. These are presentation-only facts: there are no callbacks, mutations, IPC handlers, Jobs, candidate revisions, generated content, or hidden fallback AI path.

Task 9.8 activates the real read-only `modules:list-instances` path. `AnalysisModuleInstanceService` reads only through the current `LibraryService` unit of work, applies the pure Task 9.1 prerequisite gate to the persisted Book/current frozen snapshot and verified module definitions, fails closed on incomplete seven-book-scope shells, and returns strict `ModuleInstanceSummary` DTOs without body content. A dedicated typed IPC adapter maps expected blockers to `MODULE_ERROR`; `no_current_library`, `book_not_found`, `structure_not_frozen`, and `structure_snapshot_mismatch` are recoverable, while `module_contract_unavailable` and `book_scope_instances_incomplete` are non-recoverable persisted-contract failures. `modules:update-body` remains `NOT_IMPLEMENTED`. Renderer query identity is exactly Library `sessionId` plus `bookId`. Successful freeze invalidates both the matching structure workspace and module-instance queries, while Library activation removes the previous session prefix; any observed session identity change also clears the previously opened Book and withdraws its workbench before the user opens a Book in the next Library. The workbench remains reachable only from the opened frozen Book on the Breakdown shelf.

Task 9.9 closes the Block 9 boundary with cross-layer and packaged acceptance coverage. The persisted `AnalysisModule` definition table contains only the seven stable product definitions, while per-Book scope, status, source edition, revision, and empty body storage remain on `AnalysisModuleInstance`; the `ai_constraint_summary` secondary system page is neither a definition row nor an eighth instance. The packaged natural-entry journey creates a Library, imports a Book through the Breakdown shelf, reviews and freezes its structure, and then verifies the seven-instance Analysis workbench, empty asset state, honest disabled AI actions, and the same persisted workbench after reopening the Library. Block 9 is complete for the non-AI module-instance shell only; real AI content, AI Job runtime, evidence extraction, rerun candidates, and rerun diff remain outside this block.

Task 10.1 freezes the incremental Job vocabulary without replacing the foundation-reset state machine. Existing persisted kinds remain `source_import`, `structure_detection`, and `structure_edition`. The future first-freeze audit kind is `analysis_module_shell_creation`; its checkpoint unit is `analysis_module_instance_batch`, but it remains `planned` and non-creatable until Task 10.4 owns the atomic runtime write. Future AI uses the vocabulary-only `analysis_module_instance_analysis`, and export uses `export`; both are `contract_only`, non-creatable, and absent from `JOB_PAYLOAD_SCHEMAS` until their separate gates authorize a runtime.

The Task 10.1 capability matrix separates Job type, checkpoint unit, implementation stage, runtime owner, cancellation, restart, resume, and draft applicability. IPC may never persist cancellation before an attached runtime owner confirms it has stopped. Progress is nonnegative and monotonic; `totalUnits` may move from unknown to a fixed nonnegative value once, never return to unknown or change afterward, and completed work cannot exceed a known total. Checkpoints append only while running, paused, or resumable unless a future Job type explicitly admits a queued preparation checkpoint. Failed, cancelled, and completed Jobs retain prior checkpoints but accept no new ones. Task 10.1 changes no service, SQLite schema, IPC handler, renderer, background queue, AI runtime, or export behavior.

Task 10.2 reuses the real `jobs` and `job_checkpoints` tables admitted by migration 001; no no-op migration or schema rewrite is added, and the current schema version remains 5. `JobRepository` now lists the complete Library history by default, including failed imports whose `book_id = null`, with optional Book filtering and deterministic `updatedAt DESC, id DESC` order. Persisted detail reads return the Job with checkpoints ordered by positive sequence and remain readable after closing and reopening SQLite. Unknown persisted Job types and malformed Job/checkpoint JSON fail closed through `invalid_persisted_job_type` or `invalid_persisted_json`. Task 10.2 adds no JobService transition policy, cancellation behavior, payload registration, IPC, renderer, background queue, AI runtime, or export behavior.

## 1. Current Repository State

The repository now contains the first Electron application scaffold plus the Block 1 security and e2e baseline. It is no longer docs-only.

Observed files:

- `package.json`
- `forge.config.ts`
- `src/main`
- `src/preload`
- `src/renderer`
- `src/shared`
- `tests/unit`
- `tests/e2e`
- `docs/product/write-storm-product-design.md`
- `docs/product/FLOWS.md`
- `docs/tasks/TASK-002-v1-work-breakdown-master-plan.md`
- `docs/vibecoding-workflow.md`

Block 1 scaffold/security/e2e baseline has landed and is suitable for total-thread review as an engineering baseline. It should not be described as macOS-ready, remote-CI-ready, release-ready, or as authorization to enter Block 2.

Current Block 1 evidence:

- Windows packaged smoke exists and has launched the packaged Electron app from the real window entry.
- macOS packaged smoke still requires a macOS runner.
- Remote CI is not configured.
- Packaged smoke proves package-and-launch only; it does not prove production distribution readiness.

Block 2 shared contract, product IPC, and preload product API artifacts in the working tree belong to the accepted Block 2 baseline and are not counted as Block 1成果.

Current Block 2 facts:

- Tasks 2.1-2.9 artifacts are present: shared domain IDs/unions/DTOs/errors, Zod contract registry, main typed IPC router, product `NOT_IMPLEMENTED` handlers, and typed `window.writestorm.internal/library/books/structure/modules/jobs/exports` preload API.
- Non-library product IPC calls still return stable `NOT_IMPLEMENTED` envelopes until their services are authorized. `library:create/open/get-current` are now wired through main-side providers in the Task 6.12 desktop entry skeleton.
- Task 2.10 boundary gates are part of the accepted Block 2 baseline.
- Total-thread recertification for Block 2 passed `npm run check` before Block 3 authorization.
- This list preserves the Block 2 checkpoint boundary. The current implementation has since added `BookService`, source import, persisted renderer book queries, and Block 8A detection; AI and the full product workbench remain outside the completed foundation.

Current Block 3 facts:

- Tasks 3.1-3.8 artifacts are present in shared domain contracts, unit fixtures/tests, and the renderer no-library contract readout.
- The seven ordinary analysis modules are fixed in `ANALYSIS_MODULE_DEFINITIONS`; `AI 约束摘要` is a secondary system page and does not create a normal `AnalysisModuleInstance`.
- `AnalysisModuleInstance` contract aligns with `ModuleInstanceSummary`: stable identity uses `id`, `bookId`, `moduleId`, and `scope`; `analysisRevision` is mutable version state, while the instance-level summary `status` comes from `MODULE_INSTANCE_STATUSES`.
- Reviewable assets are separated from module instance state: `ReviewAssetEnvelope` uses `ReviewAssetId`, `sourceModuleInstanceId`, source `AnalysisModuleKey` snapshot, same-scope `scopeRef`, `ReviewAssetStatus`, `EvidencePolicy`, edition/version/revision fields, and timestamps.
- `ReviewAssetStatus` is the canonical asset review state vocabulary for pending/confirmed/rejected/excluded/needs_evidence/stale; it is distinct from `ModuleInstanceStatus`.
- Review asset confirmation uses the asset's own `EvidencePolicy`: only `required_for_confirmation` requires a valid `EvidenceAnchor` before `confirmed`; `not_required` and `optional` are not blocked by the transition contract. Critical conclusions must use `required_for_confirmation`.
- Markdown body remains human-readable text only; evidence, relations, structured objects, technique observations/candidates, AI constraints and review status remain structured assets.
- The renderer no-library entry shows `Analysis module contract readout` sourced from shared domain constants, including the module list, secondary-system-page disabled placeholder, and unsupported scope reasons.
- Latest Block 3 repair verification on 2026-07-08: `npm run check` passed with `typecheck`, `29 unit files / 126 tests`, and Electron e2e `1 passed`.
- Block 3 still does not authorize SQLite, real services, import implementation, AI/Codex SDK calls, real prompts, generated module body, seven-module deep output schema, or ordinary-module treatment of thematic perspectives.

Current Block 4 facts:

- Tasks 4.1-4.8 artifacts are present in shared domain technique contracts, source snapshot contracts, original-reference placeholder contracts, unit fixtures/tests, and the renderer no-library technique-library contract readout.
- Technique assets are three separate layers: `WorkTechniqueObservation` and `ReusableTechniqueCandidate` belong to `BreakdownBook`; `TechniqueEntry` belongs to `TechniqueLibrary`.
- `TechniqueEntry` is not a mutable mirror of the source candidate and must not write back to source observations, source candidates, or source evidence state.
- `SourceSnapshot` stores stable source ids, ISO `capturedAt`, redacted `summary`, redacted `evidenceSummary`, and readonly traceability. Its runtime schema rejects non-ISO `capturedAt`, incomplete redaction envelopes, forbidden content shapes, full original excerpts, original sentences, character names, and proprietary setting fields.
- Reusable technique candidates must contain `reusablePrinciple`, `applicableScope`, `limitations`, and `ProblemSolutionPattern`; pattern fields are deproprietized text envelopes rather than bridge reenactments or source-text strings.
- Evidence chain boundary: breakdown-book observations and candidates may use `EvidenceAnchorId[]`; technique-library entries use `SourceSnapshot`, with evidence summary read from `sourceSnapshot.evidenceSummary`. `EvidenceAnchor` is not a cross-domain mutable fact source for the technique library.
- `TechniqueEntryStatus` is `draft | organized | pending_merge | deprecated`; `pending_merge` is an organization state only and does not trigger or create automatic merge output.
- Technique-library manual primary creation is disabled in V1: empty state copy is `来自已采纳候选`, direct-create primary flow is blocked, and future manual creation requires a new product decision.
- `OriginalReferenceSnapshot` is a placeholder only: future original references may target only confirmed reusable candidates or organized technique entries, store a snapshot, and must not follow source mutations, reference raw evidence, draft entries, unconfirmed AI assets, or create `OriginalBook` data.
- The renderer no-library entry now shows `Technique library contract readout` from shared domain constants, including the accepted-candidate empty-state copy, source-snapshot secondary information position, and disabled manual-primary-action state. It exposes no create/edit/adopt/merge buttons and uses no fake technique data.
- Latest Block 4 closeout verification on 2026-07-08: `npm run check` passed with `typecheck`, `29 unit files / 123 tests`, and Electron e2e `1 passed`.
- Block 4 still does not authorize complete technique library UI, automatic fusion/merge, multi-source publication gates, original citation system implementation, OriginalBook data, SQLite, migrations, real services, import implementation, AI/Codex SDK calls, real prompts, generated prose, or new IPC channels.

Current Block 5 facts:

- Tasks 5.1-5.8 artifacts are present in shared domain perspective contracts, unit fixtures/tests, the renderer no-library perspective contract readout, and the Electron empty-state e2e smoke.
- V1 built-in perspective keys are stable: `foreshadowing_suspense_payoff`, `character_relation_dynamics`, `setting_rule_payoff`, `pacing_emotion_drive`, and `technique_source_trace`.
- `PerspectiveDefinition` is a `derived_composite_view`, not an `AnalysisModule`, does not create an `AnalysisModuleInstance`, is not a fact source, and may only store a view instance.
- `PerspectiveInstance` identity is `id + perspectiveKey + bookId + scopeRef + status + sourceRevisionSnapshot`. Its `scopeRef` still means analysis target boundary, not text offsets or UI navigation position.
- Perspective dependencies reference existing source assets only: `AnalysisModuleInstance`, `RelationLink`, `EvidenceAnchor`, `WorkTechniqueObservation`, and `ReusableTechniqueCandidate`. Relation links are `reference_only`; perspectives must not generate relation facts.
- Missing dependency status is intentionally split: missing analysis module instances display `partial`; missing required source assets can display `blocked`; missing optional assets display `partial`.
- Perspective edit policy allows only user view notes/annotations. Relationship facts, evidence state, and reusable technique candidates must be edited in their source module. Perspective refresh is a future authorized flow only: `autoRefreshEnabled: false` and `refreshOnOpen: false`.
- Perspective statuses are `current | partial | stale | blocked | needs_refresh`. Structure changes mark affected perspectives as `needs_refresh` without auto recompute or open-time overwrite; broken evidence anchors display source errors.
- Perspective export participation is derived-reading-view only. `partial` and `stale` exports must carry status markers, and exports must not present perspective output as a fact source.
- Future original context may reference only confirmed source assets. It must not cite a perspective view or perspective-derived fact as an original-context source.
- The `technique_source_trace` perspective only traces the technique source chain. It does not create, edit, store, adopt, or mutate `TechniqueEntry`; `TechniqueEntry` remains owned by the fusion technique library.
- The renderer no-library entry now shows `Perspective contract readout` from shared domain constants, including five derived views, blocked shell wording, and dependency `partial`/`blocked` statuses. It exposes no compute/refresh/edit/adopt buttons and is not a real workbench tab.
- Block 5 still does not authorize SQLite, migrations, real services, imports, new IPC channels, AI/Codex SDK calls, prompts, automatic refresh/calculation, five-perspective deep UI, original-context implementation, or treating perspectives as an eighth analysis module.

Current Block 6 native gate facts:

- Block 6 native gate is the approved first substage of Block 6. It covers the library folder contract, manifest boundary, `better-sqlite3` dependency baseline, SQLite connection wrapper, static migration runner, Vite native externalization, and local CI integration-test gate.
- Windows native package/rebuild passed after installing Visual Studio Build Tools 2022 for the current `@electron/rebuild` 3.7.2 / `@electron/node-gyp` `10.2.0-electron.1` chain. `npm run build`, packaged native SQLite smoke, and `npm run check` passed locally on Windows.
- Task 6.9 Windows packaged smoke now loads `better-sqlite3`, opens SQLite, runs a test-only migration, closes/reopens the database, and verifies reopened schema version readback. macOS packaged SQLite smoke remains blocked-by-platform.
- `npm run make` is still release/maker strategy blocked-or-not-applicable because `makers: []` gives Forge no win32 make target. macOS packaged SQLite smoke is still blocked-by-platform until a macOS runner executes the same packaged smoke.
- `manifest.json` uses `manifestVersion` for the manifest contract. A `schemaVersionHint` field is allowed only as diagnostic/readout metadata and must not override SQLite.
- SQLite `schema_migrations` is the authoritative schema-version source for migrations.
- Migration runner rejects unknown applied migration ids and applied migration id/name mismatches before running pending migrations. Older apps must not continue on unknown future schemas.
- Migration runner rejects non-contiguous applied migration histories. Applied rows must be a contiguous prefix of the static registry, so a database with migration 2 but missing migration 1 cannot be opened or repaired by running migration 1 later.
- Task 6.4 Foundation Schema is implemented as production migration `001_foundation_schema` and brings app schema version to at least 1. It creates `library`, `books`, `source_texts`, `structure_nodes`, `story_segment_ranges`, `jobs`, and `exports` with introspected core columns and relationships.
- `books.current_source_text_id` is constrained by FK to `source_texts.id`; the current-source pointer must not reference a nonexistent source text.
- The historical Task 6.5 speculative content-model tables and unpublished migration were removed by the global reset. They are not production objects. The admitted production registry is migration 001 plus structure migration 002.
- TechniqueEntry and ReusableTechniqueCandidate remain separate domain objects and must use separate tables when their persistence is admitted. Future `technique_entries` reference `source_snapshots`, not reusable candidates or evidence anchors directly; none of those speculative tables is currently admitted.
- Perspective views belong in a future `perspective_views` table, never `analysis_module_instances`; no perspective table is currently admitted, and perspectives do not become an eighth analysis module.
- Future `relation_links` and `evidence_anchors` persistence uses independent tables after full table-admission contracts exist. They are not current shell tables; perspectives may read them later but must not generate relation facts or own evidence state.
- Task 6.10 path guard is implemented in the main/library layer. Library relative paths must stay inside the canonical library root, absolute child inputs are rejected, same-prefix sibling escapes are rejected, and existing symlink/junction segments that realpath outside the root are rejected before future LibraryService create/open/current flows use them.
- Task 6.11 LibraryService create/open/current is implemented as a main/service-layer minimum loop. It creates the library folder layout, writes non-authoritative `manifest.json`, opens `writestorm.sqlite`, runs the static migration runner, sets current context, and returns `LibrarySummary` with schema version read from SQLite.
- LibraryService reads `LibrarySummary` identity from SQLite `library`, not manifest identity fields. Manifest id/name/appVersion can be used to bootstrap create, but open must treat SQLite as authoritative.
- LibraryService create requires an absent or empty root. Create is the only flow allowed to create a new SQLite file; it refuses non-empty roots and existing database artifacts instead of adopting them, and it cleans partial create artifacts if migration or database setup fails.
- LibraryService.open refuses a manifest-only library when `writestorm.sqlite` is missing. Opening an existing library must surface a recoverable library error instead of silently recreating an empty database.
- LibraryService.open validates source/exports/logs/cache/mirrors as existing directories before opening an existing library, so damaged folder contracts fail early with a recoverable library error.
- SQLite open failures map to `LIBRARY_ERROR` with `database_open_failed` over IPC instead of generic `INTERNAL_ERROR`.
- Expected LibraryService failures are mapped to `LIBRARY_ERROR` over IPC with a stable reason, so duplicate roots, invalid manifests, missing databases, path guard rejection, and migration failure do not collapse into generic `INTERNAL_ERROR`.
- Library product IPC can now be wired with main-side root providers for `library:create`, `library:open`, and `library:get-current`; renderer requests remain empty and cannot submit arbitrary paths. Default product IPC registration without those providers still leaves non-wired product channels on stable `NOT_IMPLEMENTED`.
- Task 6.11 authorizes only the LibraryService service/IPC minimum loop. It does not authorize renderer library UI, source import, book services, AI, or full product workbench behavior.
- Task 6.12 desktop entry skeleton is implemented. The renderer exposes only Create library and Open library entry buttons, calls typed preload `library:create/open/get-current`, and switches to an empty Breakdown shelf from a returned `LibrarySummary`.
- The Task 6.12 directory-selection path stays main-side: production uses Electron directory dialogs, while packaged e2e may set `WRITESTORM_E2E_LIBRARY_DIALOG_STUB=1` plus `WRITESTORM_E2E_LIBRARY_ROOT`/`WRITESTORM_E2E_LIBRARY_NAME`. That stub is read only by the main process at launch, is not exposed through preload/renderer, and renderer still cannot submit arbitrary filesystem paths.
- Historical Task 6.12 boundary: that checkpoint did not authorize source import, book services, AI/Codex, full workbench UI, technique-library UI, perspective computation, or new non-library IPC channels. Later authorized tasks added Book/source-import services and their existing product IPC without authorizing AI or the full workbench.
- Task 6.13 SQLite/migration performance baseline is implemented. The small fixture uses 25 probe rows and the medium fixture uses 1,000 probe rows through test-only migrations, then records create/open/migration/summary-query timings against non-regression limits.
- Historical Task 6.13 boundary: its performance fixtures remain test-only and separate from production migrations. Later tasks, rather than this performance checkpoint, added BookService queries, source import, and renderer server-state behavior; AI remains unimplemented.

Historical Block 7 gate facts and current override:

- Block 7 6A deferral override: 6A has not run and has no recorded Go/No-Go.
- Block 7 may continue only as non-AI Foundation work under the total-thread override recorded in `docs/engineering/V1-BLOCK-7-STATUS.md`.
- AI/Codex/prompt/runtime remain blocked.
- At the Block 7 checkpoint, structure detection and module generation were blocked. Task 19 later completed Block 8A structure detection; module generation remains unimplemented.
- Task 7.0 through Task 7.12 are authorized only for documentation gate, import IPC contract boundary work, source import metadata schema, main-side file dialog adapter, pending import token helper, source text preflight, source text encoding helper, source text copy helper, source text metadata helper, book + source_text transaction helper, duplicate/conflict policy helper, source import failure UI, packaged Electron import smoke, and Unicode/newline corpus coverage.
- Tasks 7.0-7.12 did not themselves authorize structure detection, AI, module generation, BookService, SourceTextService, or the full workbench. Later explicit tasks implemented BookService, SourceTextService, and Block 8A detection; AI, module generation, and the full workbench remain outside the completed scope.
- `books:import-source` must keep source path selection main-side. Renderer requests must not include `sourcePath`, `filePath`, `path`, or `rootPath`.
- `books:import-source` success response is `ImportSourceResult`; `IMPORT_ERROR` failures must include a stable import `details.reason`.
- UTF-8 and UTF-8 BOM decode automatically in Task 7.5.
- GB18030 is available only through the manual retry encoding override before a later authorized task proves a deterministic confidence rule or approved dependency.
- The unpublished Task 7 source-import migration history was reset. Source-import metadata belongs to migration 001 and structure workspace belongs to migration 002; that Block 7/8 checkpoint had schema version 2. Task 9.2 adds migration 003, Task 9.3 adds migration 004, and Task 9.5 adds migration 005 and raises the current schema version to 5.
- Task 7.2 adds `source_texts.original_file_name`, `source_texts.size_bytes`, unique `idx_source_texts_content_hash`, and validation triggers that reject missing, blank, or non-positive source import metadata.
- Task 7.2 does not implement file dialog, preflight, source copy, SQLite import writes, renderer import UI, BookService, or SourceTextService.
- Task 7.3 main-side file dialog adapter is implemented.
- Task 7.3 selects `.txt` and `.md` files only through main-side dialog options.
- Task 7.3 pending import tokens are main-only, scoped to the current library session, TTL-bound, and renderer-visible tokens do not contain source paths.
- Task 7.3 does not implement preflight, encoding detection, source copy, SQLite import writes, renderer import UI, BookService, or SourceTextService.
- Task 7.4 source text preflight is implemented.
- Task 7.4 checks extension, 20 MiB size limit, readability, non-file selections, and empty files; only `.txt` and `.md` are accepted.
- Task 7.4 does not implement encoding detection, source copy, SQLite import writes, renderer import UI, BookService, or SourceTextService.
- Task 7.5 source text encoding helper is implemented.
- Task 7.5 UTF-8 and UTF-8 BOM decode automatically.
- Task 7.5 GB18030 is available only through the manual retry encoding override.
- Task 7.5 does not implement source copy, SQLite import writes, renderer import UI, BookService, or SourceTextService.
- Task 7.6 source text copy helper is implemented.
- Task 7.6 stages copied bytes in the library source directory before final rename.
- Task 7.6 writes under `source/<sourceTextId>/<originalFileName>`, refuses to overwrite an existing copied source target, and cleans the staging file when copy or rename fails.
- Task 7.6 returns copied source relative path, size, and content hash.
- Task 7.6 does not implement SQLite import writes, renderer import UI, BookService, or SourceTextService.
- Task 7.7 source text metadata helper is implemented.
- Task 7.7 maps filename, ext, size, hash, encoding, import time, relative path, and source_text_edition.
- Task 7.7 produces the shared SourceTextMetadata DTO and source_texts insert row shape.
- Task 7.7 does not implement book + source_text transaction, renderer import UI, BookService, or SourceTextService.
- Task 7.8 book + source_text transaction helper is implemented.
- Task 7.8 inserts book and source_text rows in one SQLite transaction and sets the book current source pointer to the inserted source text.
- Task 7.8 rolls back the book row when source_text insertion fails.
- Task 7.8 does not implement duplicate/conflict policy, renderer import UI, BookService, or SourceTextService.
- Task 7.9 source import duplicate/conflict policy helper is implemented and wired into `books:import-source`; the unique content-hash write fallback is mapped back to existing book/source ids.
- Task 7.9 duplicate content hash blocks import with `duplicate_source_hash` and returns existing book/source ids; SQLite also enforces a unique `source_texts.content_hash` index as the write-time fallback. It does not merge, overwrite, or create another book for the same source hash.
- Task 7.9 copied source target conflict maps to `target_conflict` with the copied source relative path and does not overwrite the target.
- Task 7.9 does not implement BookService, SourceTextService, or the full workbench UI; review remediation supplies the import orchestration and executable failure actions.
- Task 7.10 source import failure UI is implemented.
- Task 7.10 maps every stable `IMPORT_ERROR.details.reason` to a concrete repair path.
- Task 7.10 encoding_required offers explicit UTF-8 and GB18030 retry actions when a pending token is present.
- Task 7.10 does not implement full workbench UI, BookService, SourceTextService, or native dialog e2e; review remediation supplies the minimum import action wiring.
- Task 7.11 packaged Electron import smoke is implemented.
- Task 7.11 production import selection remains main-side native dialog selection.
- Task 7.11 packaged e2e uses a main-process import dialog stub and does not use Playwright web filechooser.
- Task 7.11 verifies real SQLite book/source_text rows and the copied source file after importing a fixed `.md` fixture.
- Task 7.11 does not implement Unicode corpus, structure detection, AI, module generation, BookService, SourceTextService, or full workbench UI.
- Task 7.12 Unicode/newline corpus is implemented.
- Task 7.12 covers UTF-8 BOM, GB18030 manual retry, Japanese text, English text, fullwidth digits, CRLF/LF, and an overlong line.
- Task 7.12 encoding_required returns a pending import token and supported manual encodings.
- Task 7.12 does not implement structure detection, AI, module generation, BookService, SourceTextService, or full workbench UI.
- Review remediation after Task 7.12: book, source_text, and completed import job share one SQLite transaction; books:import-source re-queries duplicate ids after a unique hash conflict; actual source reads are bounded by the 20 MiB limit from one opened descriptor; failure actions render executable buttons; books:list reads persisted book summaries for reopen/open-existing actions; pending tokens carry an opaque session ID; pending tokens are cleared when the library session changes or closes and rejected when the session ID does not match; source import and opened-book UI copy is centralized in the renderer i18n catalog.

Current Block 8A gate facts:

- `docs/engineering/V1-BLOCK-8A-STATUS.md` is the durable authority for Block 8A status, numbering reconciliation, passed gates, limitations, and reproduction commands. Readers must not depend on conversation history to interpret internal slice labels.
- The master Block 8A scope is Tasks 8.1-8.10, 8.12, 8.13, and 8.18. Internal labels are review/execution slices rather than master Task numbers: internal 8A-10 maps to master Task 8.13, while master Task 8.10 is validation.
- Block 8A local deterministic detection, candidate-side persistence, validation, fixtures, worker/Job lifecycle, and observation-only performance recorder are implemented. Task 8.9 is complete only for candidate persistence and stage-separation foundation.
- `V1-BLOCK-8-STATUS.md` is the current authority for Block 8 status. A later independent review reopened Block 8 completion; manual aggregate authorization, monotonic replacement lineage, and persistent per-book detection-run ordering were repaired and focused-tested, and the final Windows recertification passed on 2026-07-15. Task 8.16 remains a synchronous DB-only invalidation port; macOS and release boundaries remain unverified.
- 6A feasibility remains unexecuted and unrecorded. Block 8A does not record a Codex SDK feasibility decision and does not authorize AI prompt/runtime work.
- Windows packaged performance results are observation-only and do not establish stable regression thresholds. macOS packaged performance evidence has not been recorded.
- `startDetection` is the only public structure-detection execution entry. Cancellation persists `run=failed` and `Job=cancelled` before aborting the utility process.
- At the 8A checkpoint, the packaged 5 MiB renderer button was an event-loop probe rather than the later product Detect structure control. Product loading, recovery, correction, confirmation, freeze, and repeat-operation UX are recorded separately in `V1-BLOCK-8-STATUS.md`.

## 2. Product Domains

### Breakdown Shelf

V1 primary domain. Owns imported books, source text, structure, story ranges, module instances, jobs, evidence placeholders and review workflow.

### Technique Library

V1 semi-usable domain. Owns `TechniqueEntry` records created from confirmed reusable candidates through future authorized flows. It does not publish gates/prompts in V1, does not expose manual primary creation by default, and does not mutate source breakdown evidence.

### Original Shelf

V1 placeholder only. It may only reserve snapshot-based reference boundaries for future original writing; it must not create original novel projects, `OriginalBook` data, or reuse breakdown evidence/objects as mutable original-project facts.

## 3. Core Domain Objects

| Object | Meaning |
| --- | --- |
| `Library` | User-selected local folder and SQLite database |
| `BreakdownBook` | Imported source project in breakdown shelf |
| `SourceText` | Copied txt/md source file and metadata |
| `StructureNode` | Title tree node: book, volume, chapter |
| `StorySegmentRange` | Cross-chapter story scope; not a title-tree child |
| `AnalysisModule` | Stable module definition |
| `AnalysisModuleInstance` | Module + scope instance that owns body, state, evidence refs and revisions |
| `EvidenceAnchor` | Evidence state and future source reference |
| `Job` | Import, structure, export or future AI task |
| `Revision` | Body or structured-asset version record |
| `WorkTechniqueObservation` | Breakdown-book technique observation that references evidence anchors |
| `ReusableTechniqueCandidate` | Breakdown-book reusable technique candidate with deproprietized principle/scope/limits/pattern |
| `SourceSnapshot` | Readonly redacted source trace copied into a technique-library asset |
| `TechniqueEntry` | Technique-library item copied/derived from confirmed candidate |
| `OriginalReferenceSnapshot` | Placeholder snapshot contract for future original references, not OriginalBook data |
| `PerspectiveDefinition` | Stable thematic derived-view definition, not an analysis module |
| `PerspectiveInstance` | Stored derived/composite view for a book and analysis target boundary, not a fact source |

## 4. Stable Technical Language

- Main fact source: SQLite.
- Derived artifacts: JSON exports, Markdown exports, optional mirrors.
- Perspective: derived composite/reading view over confirmed source assets; never a primary fact source.
- Renderer: React UI with no privileged APIs.
- Main process: Electron privileged process, service host and IPC router.
- Preload: typed bridge only.
- Utility/worker process: large file work and future Codex execution boundary.
- Codex SDK: only V1 AI integration surface.
- Codex SDK spike: gate before real AI breakdown implementation.
- `codex exec`, app-server, GUI automation, API Key, local model and other providers: not V1 fallback paths.

## 5. Mandatory Boundaries

- Do not merge breakdown shelf, technique library and original shelf.
- Do not make `StorySegmentRange` part of the title tree.
- Do not store per-book analysis output on `AnalysisModule`; use `AnalysisModuleInstance`.
- Do not let Markdown or JSON mirrors become authoritative.
- Do not expose fs, SQLite, shell, child process or Codex SDK APIs to renderer.
- Do not implement real AI analysis before Codex SDK spike passes.
- Do not claim Web support.
- Do not merge observations, reusable candidates and technique-library entries into one object.
- Do not let `TechniqueEntry` write back to source candidates or evidence state.
- Do not store full original excerpts, original sentences, character names or proprietary setting body in `SourceSnapshot`, `ReusableTechniqueCandidate`, `ProblemSolutionPattern`, or `TechniqueEntry`.
- Do not treat `EvidenceAnchor` as a cross-domain mutable source of truth for the technique library.
- Do not expose technique-library manual primary creation, automatic merge/fusion, or OriginalBook creation before a new product decision authorizes it.
- Do not add thematic perspectives to the seven ordinary `AnalysisModule` definitions or present them as an eighth module.
- Do not let perspectives generate relation facts, edit evidence state, edit reusable technique candidates, adopt `TechniqueEntry`, or participate directly in original context.
- Do not auto-refresh or auto-calculate perspectives on open; stale and partial perspective views must remain visibly marked.

## 6. First Implementation Path

The V1 implementation path is:

1. Create Electron Forge + Vite + React + TypeScript scaffold. Completed in Block 1.
2. Add strict TypeScript and process-separated source tree. Completed in Block 1.
3. Add shared domain/contracts/errors and main typed IPC bridge. Completed in Block 2.
4. Lock analysis module boundary contracts and expose the contract readout from the desktop entry. Completed in Block 3.
5. Lock technique asset boundary contracts and expose the technique-library contract readout from the desktop entry. Completed in Block 4.
6. Lock thematic perspective boundary contracts and expose the perspective contract readout from the desktop entry. Completed in Block 5.
7. Add SQLite connection and migrations. Windows native gate passed; release maker strategy and macOS packaged SQLite smoke remain blocked/not applicable.
8. Implement library create/open and persisted Book shelf reads. Completed through LibraryService, BookService, session-scoped renderer queries, and packaged create/open/reopen coverage.
9. Record SQLite/migration performance baseline. Completed in Task 6.13 for the authorized LibraryService/migration layer.
10. Implement txt/md import and metadata. Completed through the source worker, SourceImportService, canonical SourceText storage, Job/checkpoint transaction, IPC adapter, and packaged import smoke.
11. Implement deterministic structure/story-range detection. Completed through Block 8A detection, Block 8B review/freeze, Block 8C invalidation seam, focused review remediation, and final Windows recertification recorded in `V1-BLOCK-8-STATUS.md`.
12. Implement module instance shell. Block 9 is complete through Task 9.9: definitions, instance identity/backfill and future-freeze creation, asset placeholders, frozen-Book workbench, disabled AI actions, session-scoped read IPC/cache behavior, final boundary tests, and packaged natural-entry acceptance are implemented. Real AI content and runtime remain unimplemented.
13. Implement Job lifecycle foundation. Completed for queued creation, transition policy, atomic completion with final checkpoint, recovery, and source/structure workloads; later business-specific Job kinds remain incremental work.
14. Implement export blocked state. Not started.

## 7. Validation Expectations

Every implementation task must define exact commands for:

- Type checking.
- Unit or integration tests.
- Build.
- Manual entry-path verification.

The minimum user-visible path to verify is:

1. Fresh start.
2. Create/open library.
3. Open breakdown shelf.
4. Import txt/md.
5. See source metadata.
6. Review structure and story ranges separately.
7. Freeze structure.
8. See module instance shells.
9. See job recovery state.
10. See export blocked reason.

The no-library Electron smoke must keep the contract readouts visible for analysis modules, technique library, and perspectives alongside only the library entry buttons. The perspective readout must prove five derived views, `partial`/`blocked` dependency status, and the non-module/non-fact-source boundary. The library-entry Electron smoke must prove create/open through the desktop entry reaches an empty Breakdown shelf without exposing renderer filesystem paths.

## 8. Source Documents To Read First

Implementation threads should read these in order:

1. `docs/engineering/TECHNICAL_DESIGN.md`
2. `docs/engineering/DECISIONS.md`
3. `docs/product/FLOWS.md`
4. `docs/tasks/TASK-001-breakdown-workbench-foundation.md`
5. `docs/product/write-storm-product-design.md` only when deeper product context is needed.
