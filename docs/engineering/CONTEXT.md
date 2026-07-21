# WriteStorm Engineering Context

日期：2026-07-11
目的：给后续实现线程提供稳定领域语言、工程边界和当前仓库事实。

## Active V1 Foundation Reset

Task 20 fresh recertification on 2026-07-14 passed `npm run check`: TypeScript passed; unit passed with 87 files / 370 tests; integration passed with 21 files / 133 tests; Windows x64 packaging passed; and all 7 packaged Electron e2e tests passed serially. The serial Playwright policy is intentional because each spec launches the packaged desktop process. This evidence recertifies the current Windows foundation and Block 8A reattachment, not Block 8B/8C, AI feasibility, macOS packaging, makers, signing, notarization, or release readiness.

Current-state contradiction scans treat this Active V1 section and the implementation-status overrides below as authoritative. Files under `docs/voided/` are explicitly voided records; `docs/superpowers/specs/` and task plans retain historical RED states and planned boundaries as implementation evidence rather than current-state claims. Those historical sources may be excluded from a current-state scan, but active `CONTEXT.md` statements may never be excluded.

`docs/engineering/V1-BLOCK-6A-CODEX-SDK-FEASIBILITY.md` is the current Codex feasibility authority. Its current status is pending Windows recertification: the historical Task 6A.8b Windows-only conditional Go expired for the changed working tree because R1–R7 changed admission, environment, protocol, unified utility-session orchestration, supervision, cleanup, error classification, assertion provenance and evidence lineage behavior. Fresh assertion leaves bind value, source, evidenceId and classification so local/static facts cannot inherit a runtime record's source. Fresh lineage binds the clean committed run HEAD, lockfile, runtime boundary, packaged artifact and static evidence inputs; only evidence/authority/consistency-test changes may follow a run. Exact sanitized `runtime_failed / unverified` Git/auth results may be retained as evidence, but they block recertification and force a non-zero probe-runner exit. The dated SDK/auth/schema/lifecycle/package results remain historical evidence but cannot verify the current implementation. Fresh R8 Windows lifecycle and packaged evidence is required before the total thread may reissue a Windows-only conditional verdict. macOS packaged runtime remains `deferred-by-user`; this is not full Go, cross-platform compatibility or release readiness. Task 13.1 remains blocked and Task 13.2 is not authorized. Historical Block 7/8 records that 6A had not run at those checkpoints also remain historical facts.

The 2026-07-20 R8a Windows development attempt from clean HEAD `74ec65f` produced two lineage-bound, sanitized `probe_infrastructure_failed` records: capability timed out at 45 seconds and outputSchema timed out at 60 seconds. Both completed graceful abort/shutdown/exit/residual cleanup, but neither produced its complete scenario set, so exact admission rejected them before evidence acceptance. They do not reissue Windows feasibility or replace the still-required fresh lifecycle and packaged evidence.

The subsequent R8a timeout remediation separates per-turn SDK deadlines from utility-session supervision: isolated-empty auth uses 15 seconds, current auth uses 90 seconds, and the outer capability/outputSchema session boundary is 110 seconds. An internal deadline requests the existing SDK AbortController and retains the conservative `runtime_failed / unverified` result when no stable structured signal exists; outer timeout remains an infrastructure failure handled by the unified termination coordinator. This runtime change invalidates reuse of the `74ec65f` attempt records and requires a fresh development probe from the next clean committed runtime HEAD.

The fresh post-remediation R8a development run from clean HEAD `e1db3d2` produced complete, lineage-verified five-scenario capability and two-scenario outputSchema records, but every SDK scenario ended `runtime_failed / unverified`. Admission therefore exited non-zero: current auth did not re-establish a real success, stable Git/login classifications remained unavailable, and real structured output was not re-established. The evidence is retained without raw errors, but the Windows verdict remains pending and blocked at the development gate; lifecycle/package probes cannot bypass it, Task 13.1 remains blocked and Task 13.2 remains unauthorized.

R8a3 adds a closed local `runtimeFailureOrigin` to distinguish only `local_turn_deadline` from an earlier `sdk_unstructured` rejection while discarding the original error and cause. Both remain `runtime_failed / unverified` and prove no auth, Git, network or provider cause. Missing/invented origins and non-null origins on success fail admission; invalid-schema runtime failure is retained with a closed blocker instead of being treated as a malformed envelope. Future lineage requires eight ordered static inputs, adding the R8a deadline and R8a3 attribution records after the original six; historical six-input records are not rewritten. This runtime/protocol/admission/lineage change makes the `e1db3d2` records historical for the prior boundary and requires another clean development run before lifecycle/package work.

The fresh R8a3 development run from clean HEAD `c7fa672` produced valid eight-input lineage evidence but was not admitted. Four capability scenarios reached their local deadlines; explicit non-Git with Git checking rejected earlier as `sdk_unstructured`. Current auth did not complete within 90 seconds. Valid-minimal outputSchema also reached 90 seconds, while invalid-schema rejected earlier but was not classified as the pinned local guard. Evidence acceptance remains separate from recertification, and lifecycle/package probes cannot bypass this development blocker.

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

Block 11 is complete at commit `ddde1a1` within the read-only Export Blocked State boundary recorded in `V1-BLOCK-11-STATUS.md`. `exports:get-status` derives the ordered `markdown_package` and `machine_package` targets from the active Library's current Book, frozen-structure state, authoritative seven-module contract, module statuses, and `body_markdown` presence. Markdown package remains `blocked`; machine package remains `unavailable`; both always include `export_execution_not_admitted`. Review, evidence, technique, perspective, and completion-gate owners remain honestly unavailable rather than being inferred from tables that are not admitted. The real Breakdown shelf and `Jobs & recovery` area expose the status, but the latter is explicitly marked not a Job and never widens `JobSummary`.

Block 11 admits no real export execution, Export record, export Job/checkpoint, migration, arbitrary path, directory selector, filesystem write, Markdown/JSON back-write, credential/token/key/secure-storage/log access, Codex SDK, AI content, evidence extraction, or future owner table. Status previews are counts and status summaries only. Before freeze the module preview is exactly expected `7`, actual `0`, non-empty `0`, with all status counts zero; after freeze it is exactly expected `7`, actual `7`. Both targets must carry the same Book/SQLite preview facts. The final certification passed 527 unit tests, 256 integration tests, Windows x64 packaging, and 13 packaged Electron E2E tests. Secondary-display placement remains test infrastructure evidence and is not a product acceptance blocker.

Task 12.1 is complete only as the Technique persistence admission contract and blocked/deferred conclusion. A future editable TechniqueEntry requires stable Library ownership, `expectedRevision` optimistic concurrency, `updatedAt DESC, id ASC` list order, no hard delete, one immutable exclusively owned SourceSnapshot captured in the same candidate-adoption transaction, and a natural confirmed-candidate producer. The current repository has no admitted reusable-candidate owner, adoption transaction, idempotency identity, or natural producer, so Block 12 authorizes no migration number, Technique table, repository, service, IPC mutation, edit form, or editable existing-entry acceptance. Technique persistence defers to Block 16. Tasks 12.2-12.5 expose a truthful empty state, unavailable editing, readonly SourceSnapshot contract position, and disabled adoption reason without fake instances; Task 12.15 verifies that natural path and the absence of Technique production tables. The durable decision and plan override are in `V1-BLOCK-12-TECHNIQUE-ADMISSION.md`.

The approved Block 12 TypeLibrary governance override is recorded in `V1-BLOCK-12-TYPE-LIBRARY-ADMISSION.md`, `V1-BLOCK-12-TYPE-LIBRARY-CONTINUOUS-PLAN.md`, `V1-BLOCK-12-STATUS.md`, and Decisions D046–D070. It overrides the historical master Task 12.6–12.9 assumptions without modifying the protected master plan. D047 corrects D046's over-broad literary-taxonomy review: type selection is `user_only`; WriteStorm never automatically classifies a Book or infers type from source text. D048–D049 separate user-facing MainType and ContentFocus copy confirmation from production stable identity release. A built-in option requires only display name, one-sentence selection description, no automatic classification, and methodology ownership deferred to Block 14. Runtime validation belongs to Block 17; automatic recognition is outside scope.

D072 establishes the active product/technical authority override without modifying the protected master plan: the built-in release contains seven MainType and seven ContentFocus options on orthogonal, user-only selection axes; Prompt sample, publication, activation, and rollback remain independent axes or operations; and Technique production tables remain unadmitted. The protected master plan's older six-name taxonomy, parent/subtype wording, single Prompt status chain, and Technique persistence assumptions are historical planning evidence rather than current implementation authority.

Import may complete without classification; formal analysis requires MainType plus ready definition, methodology, Prompt, schema, and composition snapshots. MainType and ContentFocus are orthogonal; the user-facing “看点标签” binds zero to three unique ordered ContentFocus definitions, including a persisted focus-only not-ready configuration. Task 12.6B confirms seven MainType copies: 日轻校园、日轻异界、现代都市、现代幻想、古代幻想、西式幻想、 and 诸天无限. Task 12.6C confirms seven ContentFocus copies: 恋爱炒股、英雄史诗、能力规则、种田运营、群像、事业、 and 冒险探索. D051–D052 approve their K1 stable identities and fourteen-entry shared typed release. D053 approves binding lifecycle. D054–D058 complete schema and repository/service CAS; D059 adds strict IPC/preload DTO methods. D060 adds optional import-time selection, later Book metadata CAS editing, display-only BookSummary labels, and visible analysis blockers on the natural Breakdown shelf. D061 completes Task 12.6D.5 with real packaged Electron evidence across restart. D062 completes Task 12.7 as an honest disabled custom-type shell on the same natural classification path; it adds no custom-type identity, persistence, version, sample, publication, IPC, or preload capability.

Task 12.6R1 closes the import-retry classification gap. The renderer retains the user-controlled import selection for the active Library session and rebuilds `choose_file`, `choose_smaller_file`, and `retry_import` requests with that selection plus the current TypeLibrary version. An intentionally unassigned selection remains unassigned. Manual encoding retry stays pending token-owned and cannot carry or replace classification fields; Library-session replacement still clears renderer selection and main-side pending tokens.

Task 12.6R3 removes the Book list classification N+1. `BookRepository.list` now uses exactly three SQL queries independent of Book count, then groups MainType and priority-ordered ContentFocus display names by Book identity. Existing Book ordering, focus-only bindings, unassigned displays, DTOs, and the fixed single-Book read remain unchanged; no migration or renderer capability is added.

Task 12.6R4 closes the renderer CAS recovery gap. A `revision_conflict` refreshes only the affected binding while a dirty user draft remains intact. The natural editor exposes “Retry my selection” using the refreshed revision and “Load latest saved classification” to explicitly replace the draft. Successful writes seed the binding cache before invalidation; packaged Electron evidence covers both recovery paths and revision progression without automatic merge or privileged renderer access.

Task 12.6R5 closes the TypeDefinition retirement lifecycle. Migration 006 enforces a one-way archive transition from null to one immutable timestamp. The product rule is that current selectors exclude archived definitions and re-densify display order, including a valid empty selector when every option is archived. D071 separates those current selector options from Book binding detail: the detail carries ordered pinned display metadata, marks archived references, and lets the editor show them as disabled historical values. A CAS update may retain an archived reference only in the same release, role, and priority slot; removed or replacement archived references are rejected. Immutable release membership/count validation remains complete.

D067 completes Task 12.12 as an independent Original shelf placeholder on the natural top-level product navigation. The route displays no original project instances and keeps “Create original project” natively disabled with a visible reason. It renders no Technique Library entries, candidates, SourceSnapshots, adoption controls, or editing controls; entering it keeps every Breakdown-only query disabled. No `OriginalBook`, original-project table, repository, service, IPC, preload method, creation handler, or privileged renderer capability is admitted.

D068 completes Task 12.13 by extending the natural Settings route with truthful non-executing AI and maintenance capability shells. It displays `Codex SDK gate = Required`, `Connector = Unavailable`, and keeps templates, schemas, repair, and health entries natively disabled with owner-specific reasons. It performs no probe or action. D070 separately owns the Task 12.15 local observability policy; Block 18 owns real health and repair. No SDK, provider, connector discovery, privileged renderer access, or new IPC is admitted.

D073 makes application-level Settings independent of Library lifecycle. Product navigation remains discoverable before a Library is opened, and `#/settings` renders the existing AI, connector, template, schema, repair, health, and local-observability shells without a current Library. Breakdown, Technique, and Original product work still require a Library and fall back to the no-Library entry state. Entering Settings enables no Breakdown-only queries, polling, privileged bridge call, probe, or mutation.

D074 makes `evaluateTypeLibraryAnalysisReadiness` the single readiness authority for both shared domain behavior and the TypeLibrary renderer. The editor derives unavailable selected versions from active selector membership plus pinned historical metadata, passes the explicit Block 12 dependency shell, and renders stable blocker codes with localized blocker reasons. Block 12 keeps methodology, Prompt, and schema unready and does not invent a composition conflict; Block 14 may inject real dependency and composition facts through the same typed input without adding a second UI rule set.

D075 keeps every native TypeLibrary option label to its short display name and renders the current selection description below the control as separate wrapping helper text. An archived selection uses the same historical display name, remains disabled, and prefixes its helper text with an archived status. Each populated selector references its helper through `aria-describedby`; no selection description is embedded in collapsed native select text.

D076 replaces caller-declared affected modules with `deriveAnalysisConfigurationImpact` and the versioned `analysis_configuration_snapshot_diff_v1` algorithm. The impact plan carries canonical per-module reason codes and the upgrade envelope independently recomputes both derivation and affected keys from the previous and next immutable snapshots. A global effective-methodology or Prompt-composition change affects all seven modules; a Prompt module snapshot change affects only that module. Fabricated or stale derivation is rejected, and rebuilding all seven modules requires explicit confirmation. Block 14 may add finer methodology dependency facts only through a new reviewed derivation version, never by restoring caller-declared affected modules.

D069 completes Task 12.14 as four executable non-capability gates. TechniqueEntry provenance remains readonly with no source/evidence/observation mutation channel; Original remains non-creating with no product channel or route callback; every production renderer import is recursively checked against Node, Electron, SQLite, main/preload, secret-storage, and Codex/provider boundaries; template changes remain unable to rewrite snapshots or trigger a silent rerun without a new snapshot, explicit impact plan, and explicit full-rerun confirmation. Synthetic forbidden imports and channels prove the scanners fail on representative violations rather than passing vacuously.

Task 12.QA-R2 remediates D069/D070 scanner vocabulary gaps. Static renderer dependency extraction now covers ESM imports/exports, dynamic imports, and CommonJS `require()`. Positive witnesses reject `technique-library:update-source`, AI/FS/logging/telemetry namespaces including `logging:upload`, Original creation aliases, and template bulk-upgrade aliases including `templates:bulk-upgrade`. These are test-only non-capability gates and add no runtime channel.

D070 completes Task 12.15 with a natural Settings `Local observability` shell and final Block 12 acceptance. The policy is `local_only`: crash reports and usage statistics are not remotely uploaded by default, and source text snippets are never recorded or uploaded. The recent-error summary remains honestly unavailable rather than claiming zero errors. Clear and manual export controls are disabled with `local_log_clear_not_admitted` and `manual_log_export_not_admitted`; there is no log read, clear, export, IPC, preload, filesystem, or remote-upload implementation. Packaged acceptance also verifies the Technique empty state, disabled adoption, readonly SourceSnapshot boundary, absence of Technique production tables, and independent Original shelf.

Book classification CAS pins TypeDefinitionVersions only on the current Book classification target and never rewrites existing AnalysisConfigurationSnapshots or historical results. Logic upgrades create a new snapshot and impact plan; selective module rebuild is allowed only for actually affected modules, while complete rerun requires explicit confirmation. EffectiveMethodologySnapshot and EffectivePromptSnapshot independently pin Base, ordered Overlays, schemaVersion, and compositionVersion. The common analysis gate title is “方法论尚未就绪，不能开始正式分析” with specific reason codes. PromptTemplateRegistryEntry owns publishedVersionId and activationStatus; PromptTemplateVersion owns sampleGateStatus, and any edit creates a new draft version starting at not_run.

D063 completes Task 12.8 as a metadata-only PromptTemplate registry domain shell. The aggregate separates registry identity, `templateVersion`, `schemaVersion`, sample gate, historical publication fact, current published pointer, and activation. `publishedAt = null` means draft; a timestamp means historically published and requires `sampleGateStatus = passed`. Under Task 12.8R1, `publishedAt` must not predate `createdAt`; mixed UTC offsets are compared as parsed instants, and equal instants are allowed. D077 requires each Prompt version to resolve exact TypeDefinitionVersion and MethodologyVersion provenance inside the aggregate and rejects cross-definition, cross-version, or cross-role ownership. These provenance facts are validation inputs, not production seed or persistence. Edits create a new draft with a new identity, incremented `templateVersion`, `sampleGateStatus = not_run`, and no inherited publication fact. There is no PromptTemplate key list, seed, body, migration, table, repository/service, IPC/preload, renderer entry, sample execution, publication transition, rollback execution, or AI runtime in Task 12.8.

Task 12.11R2 closes the edited-draft lifecycle gap. `createEditedPromptTemplateDraft` requires a new version identity and the next `createdAt` must not predate the current version when parsed as a real instant; equal instants are allowed, including equivalent mixed-offset representations. The helper still creates only an in-memory metadata draft and admits no Prompt persistence or executable editor.

D064 completes Task 12.9 as a contract and test-fixture boundary. An immutable AnalysisConfigurationSnapshot pins TypeLibraryVersion, classification revision, exact TypeDefinitionVersions, methodology provenance, and one ordered Base/Overlay PromptTemplate version set for each of the seven authoritative analysis module keys. Prompt `schemaVersion` belongs to each module snapshot; `compositionVersion` belongs to the effective Prompt composition. Full snapshots remain outside BookSummary and appear only in the independent BookMetadataDetail DTO beside the current mutable classification binding. Upgrades create a distinct snapshot plus impact plan. Mixed UTC offsets are compared as instants, and the next snapshot must be strictly later. Without explicit complete-rerun confirmation, rebuild keys must exactly equal affected keys. There is no analysis-configuration persistence, producer, IPC, preload, renderer path, silent registry-pointer adoption, or old-snapshot rewrite in Task 12.9.

D065 completes Task 12.10 as a natural-path blocked shell. Users can enter application-level Settings from top-level product navigation before a Library is opened and see the Templates & schemas sample-preview card. The native action is disabled with `codex_sdk_gate_required`, `prompt_template_instance_unavailable`, and `sample_preview_runtime_not_admitted`; the page explicitly states that publication requires a passed sample preview. The Settings route has no action callback or privileged bridge. Task 12.10 runs no sample fixture, Prompt body, Job, SDK, provider, or AI runtime; Block 17 remains the real preview owner, while completed Task 12.13 extends this same Settings route without weakening the gate.

D066 completes Task 12.11R as a non-executing publication state-machine shell over the authoritative PromptTemplate registry aggregate. The shell does not duplicate publication, sample, or activation facts. A publish preview first records `publishedAt` on a passed draft and then repoints the registry. D078 makes publish forward-only: after the first publication, the selected draft requires a strictly larger `templateVersion`, and its new publication fact may equal but never predate the current publication instant. Under D077, rollback accepts only a distinct historically published target with a smaller `templateVersion`, and a successful rollback clears its selection rather than offering the newer previous pointer as another rollback; disable changes activation only and retains the current published pointer. Every successful preview preserves provenance and reparses the complete aggregate, while the real Settings state has no PromptTemplate instance or admitted persistence and keeps all three native actions disabled. There is no handler, IPC, preload method, migration, or Book snapshot mutation; real transitions remain owned by Block 17.13.

Task 12.6A implements that governance boundary as shared strict schemas and pure policies in `src/shared/domain/type-library.ts`. It covers minimal built-in option confirmation, user-only selection, independent definition/methodology/Prompt versions, focus-only zero-to-three ordered classification targets, immutable effective snapshots, current-target-only CAS policy, exact readiness blockers, and sample reset for edited Prompt drafts. Tasks 12.6B–12.6C first preserved the fourteen user-confirmed strings in copy-only typed assets with null stable keys; D052 later published the separately approved identities and release in the shared production typed registry. Their RED/GREEN evidence protects exact copy, kind, user-only ownership, no classifier fields, and no embedded methodology. D053 closes the binding lifecycle design. D054–D056 complete Task 12.6D.1C; D057–D058 complete Task 12.6D.2; D059 completes Task 12.6D.3; D060 completes Task 12.6D.4; D061 completes Task 12.6D.5. That continuous 12.6 sequence stopped before Task 12.7; D062 separately completes only its disabled renderer shell.

Option A is approved as the persistence ownership model by Decision D050: normalized SQLite identities, immutable versions/releases, an independent CAS-controlled Book binding, and ordered binding-owned ContentFocus associations. The K1 mapping is approved by D051 as `builtin_main_001`–`007` and `builtin_focus_001`–`007`. D052 approves the fourteen-entry TypeLibraryVersion 1 shared typed release in `src/shared/domain/type-library-built-ins.ts`; test admission fixtures derive from it. D053 closes CAS initialization/clear and archive policy. D054–D056 implement and certify migrations 006–007. D057 adds strict reads; D058 adds CAS mutation; D059 adds three typed channels, stable error envelopes, sender validation, and a narrow preload namespace. D060 integrates those boundaries into the existing source-import transaction and natural Breakdown shelf without adding automatic classification or AI.

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

Task 10.3 incrementally hardens the existing `JobService`. Create, transition, and atomic completion enforce integer nonnegative progress, monotonic completed units, completed-not-above-total, and the one-way `totalUnits` policy; violations return `invalid_progress`. Generic checkpoints append only in running, paused, or resumable states, while queued types currently admit no preparation checkpoint and failed/cancelled/completed return `invalid_checkpoint_state`; the specialized `completeWithCheckpoint` remains the only atomic final-checkpoint path. Failure codes must be non-blank or return `invalid_failure`, and persisted detail reads validate both the Job and every checkpoint payload.

`JobService.cancel` requires `runtimeOwner: 'none' | 'confirmed_stopped'`. Dormant queued/paused/resumable work may use `none` only when the caller knows no owner is attached; active states require confirmed owner shutdown, and transaction-owned structure-edition/module-shell types are not cancellable. Task 10.3 does not implement actual import/detection worker cancellation or `jobs:cancel` IPC. Existing runtime-owner lifecycle wiring remains outside this increment; Task 10.5 must make owners stop and clean up before calling the confirmed-stopped persistence path and close any legacy direct-transition bypass. Task 10.3 changes no migration, renderer, AI runtime, queue, or export behavior.

Task 10.4 preserves the existing production Job write paths for source import, structure detection, and structure-edition freeze rather than duplicating them. The runtime `AnalysisModuleInstanceEditionChangePort` now records one completed `analysis_module_shell_creation` Job and matching final checkpoint for the exact seven-instance batch it creates on a Book's first freeze. The instances, module-shell Job, checkpoint, frozen structure, Book edition, and structure-edition Job remain in the same freeze transaction; any insert or checkpoint failure rolls the complete change back. Idempotent first-freeze reapplication and replacement freeze do not create another module-shell Job.

Migration 004 remains immutable historical backfill. It must not fabricate `analysis_module_shell_creation` Jobs for shells created while upgrading an already-frozen Book, because no runtime Job occurred. The module-shell payload schemas are admitted only for this implemented runtime flow; future `analysis_module_instance_analysis` and `export` payloads remain absent and contract-only. Task 10.4 adds no migration, IPC, renderer, queue, AI analysis, worker cancellation, or export behavior. Exact runtime cancellation orchestration remains Task 10.5.

The pre-Task 10.5 integrity remediation makes four previously descriptive boundaries executable. Completion preserves Book ownership: only `source_import` may bind `null -> imported Book`; every other Job must already own and retain the exact completed Book, with violations returning `invalid_book_ownership`. Per-JobType checkpoint policy owns each final kind. Generic append rejects cross-type and all final checkpoints with `invalid_checkpoint_kind`; final checkpoints remain exclusive to `completeWithCheckpoint`. No current runtime kind admits an intermediate checkpoint. A future batch intermediate kind requires a single atomic checkpoint + progress write API before admission.

`createQueued` now rejects every capability whose `creatable` flag is false with `job_not_creatable`, even when a caller injects a matching payload schema. Source import no longer prebuilds a completed `JobSummary`: the import transaction accepts Job identity and timestamp, returns the persisted JobRecord produced by `completeWithCheckpoint`, and the shared main-side mapper builds the response DTO from that record. SQLite remains the fact source. These changes add no migration, IPC, renderer, runtime cancellation, AI, or export path; typed Job IPC and owner-first cancellation remain Task 10.5.

Task 10.5 replaces the Job not-implemented boundary with typed `jobs:list`, `jobs:get`, and `jobs:cancel` handlers. Library-wide list is the default, includes failed imports whose `bookId` is null, accepts an optional Book filter, and preserves repository `updatedAt DESC` ordering. `jobs:get` returns a distinct persisted `JobDetail` containing the summary, Job type, and validated checkpoints instead of expanding `JobSummary`. Expected Job failures cross IPC as the stable `JOB_ERROR` domain code; unrelated product channels remain not implemented.

Cancellation is owner-first. Active source imports are indexed by Job id and stopped through `cancelImport(jobId)`; an encoding-required import remains owned through its main-only pending token, so cancellation records the queued Job as cancelled and clears every matching token before returning success. Active structure detections are stopped through `cancelDetectionAndWait(jobId)`; persisted queued/running orphan structure detection is also resolved by Job id, atomically changing the run to `failed/cancelled_by_user` and the Job to `cancelled`. Structure Jobs never use the Job-only ownerless fallback.

`jobs:cancel` pins the originating Library session across the initial read, runtime-owner await, final read, and fallback write. Library replacement pauses new Job cancellation admission and waits for every in-flight Job cancellation before publishing the next session. Therefore a matching job id in the next Library cannot be read or mutated by the previous cancellation. Source-import lifecycle shutdown records cancellation rather than misclassifying the abort as worker failure.

Task 10.5 changes no migration or database schema and adds no renderer, recovery panel, automatic resume, keep-draft action, AI runtime, queue, or export execution. The natural Library/Breakdown-shelf discovery and recovery UI remain Task 10.6.

Task 10.6 mounts one always-visible, Library-wide `Jobs & recovery` panel on the real Breakdown shelf between the Book list and opened-Book workspace. It reads all Jobs for the current Library session, including failed imports with no Book, preserves `updatedAt DESC` list order, selects persisted `JobDetail`, and shows status badges, progress, failure reason, and ordered durable checkpoint metadata without rendering checkpoint payload bodies. Queued/estimating/waiting/running list and detail data poll while work may actively progress; dormant and terminal states do not poll, and import/structure mutations invalidate the same session-scoped Job cache.

Cancellation remains the Task 10.5 owner-first IPC operation. The renderer enables Cancel only when the selected persisted JobType has runtime-owner-first cancellation and its state admits a cancelled transition, disables it while the request is pending, and refreshes list and detail after success. Resume remains visibly disabled with an implementation reason. Keep draft is shown only for structure JobTypes and remains disabled with a structure-specific reason; it is absent for import and module-shell Jobs where it is not applicable. A cancelled source import maps to the existing explicit cancelled-import repair presentation instead of a generic failure.

Task 10.6 creates no alternate Diagnostics route, migration, schema, Job state, checkpoint, runtime queue, automatic resume, executable Keep draft, restart recovery, AI analysis, or export behavior. Task 10.7 owns abandoned-runtime restart recovery and its reopen semantics; persisted failed/resumable fixtures used to exercise this UI are test establishment, not evidence that users can naturally create resumable Jobs.

Task 10.7 runs restart recovery only after a successful Library activation is proven: the returned summary and `LibraryService.getCurrent()` must publish the same new session id, distinct from the session observed before replacement. The main process then awaits recovery before returning create/open success. The generic session-change `finally` hook remains lifecycle cleanup only and cannot trigger recovery for a cancelled, failed, or unchanged activation. Identity mismatch returns recoverable `LIBRARY_ERROR` with `library_activation_mismatch`; a recovery failure closes the newly activated session and returns `restart_recovery_failed` instead of exposing a half-recovered Library.

Recovery converts only abandoned queued/running `source_import` Jobs to failed with `SOURCE_IMPORT_ABANDONED`, removes only each exact `source/.staging/{jobId}.tmp`, and preserves existing failed/resumable records for discovery through the natural Breakdown-shelf `Jobs & recovery` panel. Structure detection keeps its explicit-recovery policy. Persisted fixtures establish resumable display after reopen; they do not claim users can naturally produce resumable work. Task 10.7 adds no migration, schema, background queue, automatic Resume, executable Keep draft, AI runtime, or export execution. Task 10.8 owns the final regression gate and Block 10 status record.

Task 10.8 completes the Block 10 regression gate without adding another Job implementation layer. The existing shared-domain, repository, JobService, application-service, typed IPC, renderer, restart-recovery, source-import, structure-freeze, and packaged natural-entry tests remain the executable authorities for the state machine, checkpoint safety, invalid payload rejection, and import guards. `docs/engineering/V1-BLOCK-10-STATUS.md` records the 10.1–10.8 reconciliation, the focused matrix, the fresh `npm run check` certification, and the honest boundary that a resumable fixture proves reopen discovery while there is still no natural resumable producer.

The post-certification review closes four Task 10.8 blind spots. Persisted Job detail now validates checkpoint ownership against the JobType and rejects cross-type, premature, missing, duplicate, non-trailing, or payload-mismatched final history with `invalid_checkpoint_kind` or `invalid_checkpoint_history`. The natural packaged recovery journey cancels a restarted orphan structure detection from `Jobs & recovery`, verifies the paired run/Job transition, and proves the structure workspace can detect again. Encoding-required cancellation invalidates the old retry token, whose next use returns `pending_import_not_found`; the Library-session race and cancellation barrier are covered independently.

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
- The Historical Block 4 Diagnostics route still shows `Technique library contract readout` from shared domain constants, including the accepted-candidate empty-state copy, source-snapshot secondary information position, and disabled manual-primary-action state. That engineering readout exposes no create/edit/adopt/merge buttons and uses no fake technique data. The current Block 12 product Technique Library route is a separate natural user surface: it exposes one native disabled `Adopt confirmed candidate` affordance with an accessibility-linked producer-unavailable reason, but no handler, candidate instance, edit form, merge action, persistence, service, or IPC mutation.
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

- Historical wording at that checkpoint: `Block 7 6A deferral override: 6A has not run and has no recorded Go/No-Go.` The later Task 6A.8b authority does not rewrite that historical fact.
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
- At the Block 8A checkpoint, 6A feasibility remained unexecuted and unrecorded. The Block 8A sentence `6A feasibility remains unexecuted and unrecorded` is a historical checkpoint fact, not the current authority. Block 8A does not record a Codex SDK feasibility decision and does not authorize AI prompt/runtime work.
- Windows packaged performance results are observation-only and do not establish stable regression thresholds. macOS packaged performance evidence has not been recorded.
- `startDetection` is the only public structure-detection execution entry. Cancellation persists `run=failed` and `Job=cancelled` before aborting the utility process.
- At the 8A checkpoint, the packaged 5 MiB renderer button was an event-loop probe rather than the later product Detect structure control. Product loading, recovery, correction, confirmation, freeze, and repeat-operation UX are recorded separately in `V1-BLOCK-8-STATUS.md`.

## 2. Product Domains

### Breakdown Shelf

V1 primary domain. Owns imported books, source text, structure, story ranges, module instances, jobs, evidence placeholders and review workflow.

### Technique Library

Block 12 truthful empty/read-only shell. Future authorized flows may let this domain own `TechniqueEntry` records created from confirmed reusable candidates, but candidate ownership, atomic adoption, persistence, and editing remain unadmitted. It does not publish gates/prompts in V1, does not expose manual primary creation, and does not mutate source breakdown evidence.

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
- V1 admitted provider: Codex SDK only.
- Long-term AI boundary: AiExecutionPort -> independent ProviderAdapter implementations.
- Provider selection is explicit; a provider failure never silently falls back to another provider, and every adapter requires its own admission gate.
- Task 6A remains a Codex-specific feasibility probe and does not implement the future provider-neutral production port or registry.
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
14. Implement export blocked state. Completed through Block 11 Tasks 11.1–11.8: strict blocked-status contracts, authoritative SQLite fact calculation, unavailable future owners, sensitive-content exclusion, read-only `exports:get-status`, natural Breakdown-shelf and non-Job status entry, no-write/path/back-write gates, and packaged blocked smoke. See `V1-BLOCK-11-STATUS.md`.
15. Implement Technique/TypeLibrary/template/settings shells. Completed through Tasks 12.1–12.15 and remediations 12.QA-R2, 12.11R2, and 12.6R5 within the recorded boundary. Technique persistence remains blocked/deferred; current TypeLibrary selectors exclude archived definitions while historical pinned Book bindings remain readable. See `V1-BLOCK-12-STATUS.md`.

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
