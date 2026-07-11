# WriteStorm Engineering Context

日期：2026-07-11
目的：给后续实现线程提供稳定领域语言、工程边界和当前仓库事实。

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
- SQLite native gate, real `LibraryService`, and the minimal desktop create/open library entry skeleton have started in Block 6. `BookService`, source import implementation, AI, and full product UI have not started.

Current Block 3 facts:

- Tasks 3.1-3.8 artifacts are present in shared domain contracts, unit fixtures/tests, and the renderer no-library contract readout.
- The seven ordinary analysis modules are fixed in `ANALYSIS_MODULE_DEFINITIONS`; `AI 约束摘要` is a secondary system page and does not create a normal `AnalysisModuleInstance`.
- `AnalysisModuleInstance` contract aligns with `ModuleInstanceSummary`: instance identity uses `moduleId`, `scope`, `analysisRevision`, and an instance-level summary `status` from `MODULE_INSTANCE_STATUSES`.
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
- `books.source_text_id` is constrained by FK to `source_texts.id`; the current-source pointer must not reference a nonexistent source text.
- Task 6.5 Content Model Schema shell is implemented as production migration `002_content_model_shell` and brings app schema version to 2. It creates `analysis_modules`, `analysis_module_instances`, `evidence_anchors`, `relation_links`, `work_technique_observations`, `reusable_technique_candidates`, `source_snapshots`, `technique_entries`, and `perspective_views`.
- TechniqueEntry and ReusableTechniqueCandidate remain separate tables. `technique_entries` reference `source_snapshots`, not reusable candidates or evidence anchors directly.
- Perspective views are stored in `perspective_views`, not `analysis_module_instances`; `perspective_views` does not FK to `analysis_module_instances` and does not make perspectives the eighth analysis module.
- `relation_links` and `evidence_anchors` are independent shell tables. Perspective views may read them later but must not generate relation facts or own evidence state.
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
- Task 6.12 still does not authorize source import, book services, AI/Codex, full workbench UI, technique-library UI, perspective computation, or new non-library IPC channels.
- Task 6.13 SQLite/migration performance baseline is implemented. The small fixture uses 25 probe rows and the medium fixture uses 1,000 probe rows through test-only migrations, then records create/open/migration/summary-query timings against non-regression limits.
- Task 6.13 stays inside the authorized SQLite/LibraryService boundary. Its performance fixtures remain test-only and separate from the production Task 6.4/6.5 schema; it does not add BookService queries, source import, AI, or renderer behavior.

Current Block 7 gate facts:

- Block 7 6A deferral override: 6A has not run and has no recorded Go/No-Go.
- Block 7 may continue only as non-AI Foundation work under the total-thread override recorded in `docs/engineering/V1-BLOCK-7-STATUS.md`.
- AI/Codex/prompt/runtime remain blocked.
- structure detection and module generation remain blocked.
- Task 7.0 through Task 7.12 are authorized only for documentation gate, import IPC contract boundary work, source import metadata schema, main-side file dialog adapter, pending import token helper, source text preflight, source text encoding helper, source text copy helper, source text metadata helper, book + source_text transaction helper, duplicate/conflict policy helper, source import failure UI, packaged Electron import smoke, and Unicode/newline corpus coverage.
- structure detection, AI, module generation, BookService implementation, SourceTextService implementation, and full workbench UI are not authorized by Task 7.0 through Task 7.12.
- `books:import-source` must keep source path selection main-side. Renderer requests must not include `sourcePath`, `filePath`, `path`, or `rootPath`.
- `books:import-source` success response is `ImportSourceResult`; `IMPORT_ERROR` failures must include a stable import `details.reason`.
- UTF-8 and UTF-8 BOM decode automatically in Task 7.5.
- GB18030 is available only through the manual retry encoding override before a later authorized task proves a deterministic confidence rule or approved dependency.
- Task 7.2 source import metadata schema is implemented and brings the static app schema registry to schema version 3.
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
- 8B and 8C remain unimplemented. Draft/frozen repository and service transactions, structure review/freeze product UI, the Task 8.17 real journey, and downstream invalidation hooks are not Block 8A deliverables.
- 6A feasibility remains unexecuted and unrecorded. Block 8A does not record a Codex SDK feasibility decision and does not authorize AI prompt/runtime work.
- Windows packaged performance results are observation-only and do not establish stable regression thresholds. macOS packaged performance evidence has not been recorded.
- `startDetection` is the only public structure-detection execution entry. Cancellation persists `run=failed` and `Job=cancelled` before aborting the utility process.
- The packaged 5 MiB renderer button is an event-loop probe, not a product Detect structure button. Product loading, Job presentation, correction, confirmation, freeze, and repeat-operation UX remain 8B work.

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
8. Implement library create/open. Minimal LibraryService + desktop entry skeleton completed in Tasks 6.11-6.12; book shelf content remains empty.
9. Record SQLite/migration performance baseline. Completed in Task 6.13 for the authorized LibraryService/migration layer.
10. Implement txt/md import and metadata. Completed in Block 7 for the authorized import path.
11. Implement local structure/story-range candidate detection. Block 8A completed; review/freeze user lifecycle remains Block 8B.
12. Implement module instance shell. Not started.
13. Implement job state shell. Structure detection now uses real persisted Job lifecycle; general Job UI and later job types remain unfinished.
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
