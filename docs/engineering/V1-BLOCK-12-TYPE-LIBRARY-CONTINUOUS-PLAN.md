# WriteStorm V1 Block 12 TypeLibrary Continuous Plan

Date: 2026-07-17

Status: Approved governed plan; executed through Tasks 12.6A–12.6D and 12.7–12.15 within the recorded Block 12 boundary

## Objective

Execute Tasks 12.6A–12.6D as a governed sequence of 20–30 minute checkpoints. WriteStorm does not automatically classify a Book; the user alone decides its type. Block 12 confirms user-facing options, preserves stable user selections, exposes exact analysis blockers, and connects selections to later versioned methodology without implementing that methodology.

Seven MainType and seven ContentFocus copies, their K1 identities, the fourteen-entry TypeLibraryVersion 1 release, and the binding CAS/archive lifecycle are approved. Migrations 006–007, their schema inventory, strict repository/service CAS, three typed IPC channels, the narrow preload namespace, optional import-time selection, later Book metadata editing, and packaged Electron natural-entry acceptance are complete. The D061 continuous sequence stops before separately authorized Task 12.7; D062 subsequently completes only its honest disabled renderer shell.

## Frozen Rules

- Selection authority is `user_only`; automatic classification and source-text inference are false.
- Import may complete without classification; analysis requires one MainType.
- MainType and ContentFocus are orthogonal.
- A Book may hold zero or one MainType and zero to three unique ordered ContentFocus “看点标签”.
- A focus-only configuration may persist but blocks with `missing_main_type`.
- ContentFocus order controls composition order only; conflicts return `composition_conflict`.
- TypeDefinitionVersion stores display name and one-sentence selection description, not methodology or classification evidence.
- EffectiveMethodologySnapshot and EffectivePromptSnapshot are separate immutable products.
- Migration 006 owns the reference registry; migration 007 owns Book binding facts. Neither exposes a product mutation path.
- Task 12.7 is complete only as a disabled shell; custom-type behavior remains unadmitted.

## Task 12.6A: Selection Governance Contract

Status: complete for shared domain contracts; no persistence or renderer path admitted.

### 12.6A.1 Minimal option confirmation RED/GREEN

File scope: `src/shared/domain/type-library.ts`, `src/shared/domain/index.ts`, and `tests/unit/type-library-governance.test.ts`.

RED rejects missing selection descriptions or stable keys on confirmed options, stable keys on unconfirmed options, automatic classification, and old classification-review fields. GREEN admits only `proposed | confirmed | deferred`, user-only selection, and Block 14 methodology ownership.

Evidence: `npx vitest run tests/unit/type-library-governance.test.ts`.

### 12.6A.2 Binding, versions, and readiness RED/GREEN

The same focused contract tests cover focus-only targets, zero-to-three ordered unique focuses, current-target-only CAS, independent snapshots, exact readiness reasons, separate Prompt axes, and edited-draft sample reset.

Evidence: focused unit test, `npm run typecheck`, and `git diff --check`.

## Task 12.6B: Seven MainType Option Copy Confirmation

Task 12.6B is complete. The user-confirmed display names are:

1. 日轻校园
2. 日轻异界
3. 现代都市
4. 现代幻想
5. 古代幻想
6. 西式幻想
7. 诸天无限

This is one 20–30 minute product-copy checkpoint, not six literary-classification reviews.

File scope after input: this governance document, a source-controlled built-in option fixture, and its focused unit test. No production SQLite file is touched.

RED rejected the missing typed asset and the old rule coupling confirmed copy to a stable key. At this copy-only checkpoint, GREEN recorded exact display names, exact descriptions, `user_only`, no automatic classification, methodology owner `block_14`, and null stable keys. It rejected any entry-condition/example/boundary/corpus/module-impact field. D052 later superseded only the null-key release state.

Verification: `npx vitest run tests/unit/type-library-governance.test.ts tests/unit/block12-type-library-plan-docs.test.ts`, `npm run typecheck`, and `git diff --check`.

Completion evidence: nine focused option/governance tests passed at the copy-only checkpoint. Seed and persistence were absent at that checkpoint; D052 and later D054–D056 separately approved and implemented the typed release and schema.

## Task 12.6C: ContentFocus Option Set

Task 12.6C is complete. The first user-confirmed options are:

1. 恋爱炒股
2. 英雄史诗
3. 能力规则
4. 种田运营
5. 群像
6. 事业
7. 冒险探索

File scope: the source-controlled typed option fixture, focused tests, and governance documents. No production selector or database object is touched.

RED failed because the typed asset and completed governance state did not exist. At this copy-only checkpoint, GREEN recorded only the exact user-confirmed display names and one-sentence descriptions, kept stable keys null, and rejected automatic-classification or methodology metadata. D052 later superseded only the null-key release state. The release listing order does not assign Book priority; future Book binding owns each Book's zero-to-three order.

Verification: focused option tests, production-path absence scan, `npm run typecheck` when typed fixtures change, and `git diff --check`.

## Task 12.6D: Book Binding And Analysis Gate

Task 12.6D proceeds only through independently authorized, reviewable checkpoints. Exact option payloads, normalized ownership, K1 identities, the V1 typed release, binding lifecycle, migrations 006–007, and the schema inventory are complete. Product repository/service work has not begun.

### 12.6D.1 Persistence admission and migration RED/GREEN

File scope: migration proposal, migration registry, schema witnesses, and focused migration tests.

Freeze TypeDefinition identity ownership, TypeDefinitionVersion lifecycle, TypeLibraryVersion release-set ownership, Book classification revision, query order, archive/reference semantics, and seed idempotency. Assign a migration number only after this review passes.

Evidence: migration RED/GREEN, semantic witnesses, integration tests, typecheck, and `git diff --check`.

Checkpoint 1 is complete. Migration 006 creates `type_definitions`, `type_definition_versions`, `type_library_versions`, and `type_library_version_entries`, then inserts the exact immutable V1 release from migration-local literals. It does not create either Book binding table.

Checkpoint 2 is complete. Migration 007 creates `book_type_bindings` and `book_content_focus_bindings`, enforces revision initialization/increment, paired MainType references, pinned-release kind checks, priority 1–3, uniqueness, and Book-owned cascade. It creates no repository/service or IPC.

Checkpoint 3 is complete. The inventory closes every CHECK/trigger witness, runtime-schema replay, retained SQLite compatibility, direct-delete ABA prevention, release-entry capacity sealing, strict priority-gap failure, and the DB-owned versus service-owned mutation matrix. No new product surface is added.

Frozen lifecycle:

- no binding row reads as revision 0;
- first mutation with `expectedRevision = 0` creates revision 1;
- clearing all selections retains the binding row and increments revision;
- Book deletion cascades its binding associations;
- definitions, definition versions, releases, and release entries have no hard-delete path; retirement is archive-only where applicable.

### 12.6D.2 Repository/service CAS RED/GREEN

File scope: TypeLibrary and Book metadata repositories/services plus focused integration tests.

Implement real write/read paths with `expectedRevision`. Focus-only and unassigned Books persist; updates affect only the current target and never rewrite historical AnalysisConfigurationSnapshots or results.

Task complete: `TypeLibraryRepository.listReleaseOptions` validates declared release count, MainType-before-ContentFocus order, contiguous per-kind sort order, strict copy fields, and exact version identity. `getBookBinding` returns null for a missing Book, maps an existing unassigned Book to revision 0 without writing, and rejects malformed aggregates with `invalid_persisted_book_type_binding`. `TypeLibraryService` and `TypeLibraryBookBindingMutationPort` implement first-write revision 1, exact `expectedRevision` CAS, atomic ordered ContentFocus replacement, retained empty bindings, stable mutation errors, and participation in an outer import transaction. No source-import product input is widened in this Task.

### 12.6D.3 IPC/preload contracts RED/GREEN

File scope: shared IPC DTOs, main handlers, preload bridge, and boundary tests.

Expose narrow list/read/update operations without filesystem paths, SQLite access, secrets, SDK access, or renderer-side persistence.

Task complete: `type-library:list-options`, `type-library:get-book-binding`, and `type-library:update-book-binding` use strict shared request/response schemas, trusted typed-router registration, stable `TYPE_LIBRARY_ERROR` envelopes, and unknown-error sanitization. Preload exposes only `typeLibrary.listOptions`, `getBookBinding`, and `updateBookBinding`; it exposes no raw IPC, filesystem, SQLite, secret, token, secure-storage, SDK, or provider object. No renderer caller or natural product path is added.

### 12.6D.4 Natural renderer paths RED/GREEN

File scope: import UI, Book metadata/detail UI, route queries, i18n, and focused renderer tests.

Deliver optional import-time selection and later editing. BookSummary receives display-only fields; exact versions and snapshots stay in metadata/detail contracts. The visible gate uses “方法论尚未就绪，不能开始正式分析” plus `missing_main_type`, `type_definition_version_unavailable`, `methodology_not_ready`, `prompt_not_ready`, `schema_not_ready`, or `composition_conflict` as applicable.

Task complete: the initial source-import request accepts an optional strict selection while encoding retry cannot replace it; the pending token preserves the initial selection. Book, SourceText, initial binding, ordered ContentFocus rows, Job completion, and checkpoint commit atomically. The existing Breakdown shelf is the only renderer path: it offers optional import selection, Book metadata CAS editing, zero-to-three ordered ContentFocus selectors, display-only classification names in BookSummary, and the exact readiness title with currently applicable blocker codes. The renderer uses preload DTO methods only and never reads SQLite, filesystem paths, secrets, SDK objects, or source text for classification. No classifier, methodology, Prompt runtime, AI preview, or AI generation is added.

### 12.6D.5 Electron acceptance

Natural-entry acceptance separately covers import without selection, optional import-time selection, later assignment/editing, focus-only restart persistence, zero-to-three ordered labels, and visible readiness blockers. Use existing hidden-window/secondary-display infrastructure. Block 12 invokes no AI.

Task 12.6D.5 is complete. `tests/e2e/type-library-natural-path.spec.ts` drives the real packaged app through the existing Breakdown shelf on the configured secondary display. Two application sessions prove unassigned import, three ordered labels, later CAS editing, focus-only persistence after restart, clearing to zero focuses, optional import-time selection, display-only BookSummary labels, and the exact readiness title/reason codes. All state writes use product UI, typed preload, IPC, service, and SQLite transactions; the final SQLite query is read-only supporting evidence and does not fabricate acceptance state. The run invokes no classifier, methodology, Prompt runtime, SDK, provider, preview, or AI generation.

Task 12.6R1 preserves the retained user selection across `choose_file`, `choose_smaller_file`, and `retry_import`, rebuilding each request with the current TypeLibrary version. Empty selection remains deliberately unassigned. Manual encoding retry remains pending token-owned and cannot carry replacement classification fields. Focused unit tests cover all failure-action kinds; packaged Electron acceptance repairs an empty selected file and proves the retried Book persists the original MainType and ordered ContentFocus selection.

Task 12.6R3 keeps Book list classification display reads at exactly three SQL queries regardless of Book count: ordered Books/source metadata, MainType displays, and priority-ordered ContentFocus displays. Main-process grouping preserves list and label order plus focus-only and unassigned semantics. The single-Book read remains fixed, and no migration, DTO, IPC, preload, renderer, classifier, methodology, Prompt, or AI behavior changes.

Task 12.6R4 makes `revision_conflict` recoverable on the natural classification path. The mutation refreshes only the affected binding; AppRouter keeps a dirty draft separate from the refreshed persisted revision. “Retry my selection” resubmits that draft with the newest revision, while “Load latest saved classification” explicitly discards the draft in favor of the refreshed binding. Successful writes seed cache before normal binding/Book-list invalidation. Packaged Electron acceptance exercises both choices and observes expected revisions 1, 2, and 3 without direct state or SQLite mutation.

## PromptTemplate Prerequisite

Task 12.8 is complete only as a metadata-only domain shell under D063. It creates no production template instance or user-visible capability.

The later `PromptTemplateRegistryEntry` and `PromptTemplateVersion` contracts keep separate concepts:

- editable draft versus immutable published TemplateVersion;
- `sampleGateStatus = not_run | blocked | failed | passed`;
- registry-owned `publishedVersionId` and `activationStatus = enabled | disabled`;
- rollback as an operation that repoints the published version.

Any edit creates a new version starting at `not_run`. Registry identity is registry key + module key + TypeDefinition identity + `base | overlay`; each version pins exact TypeDefinitionVersion and MethodologyVersion provenance. No old Book snapshot is mutated.

The implemented aggregate names the independent counter `templateVersion`, retains `schemaVersion`, derives draft versus historically published from nullable `publishedAt`, requires a passed sample gate for historical publication, and validates same-registry ownership, role consistency, unique identities/version numbers, and a resolvable current published pointer. Task 12.8R1 adds mixed-offset publication chronology at the version boundary: parsed `publishedAt` may equal but never predate parsed `createdAt`, and the publication preview inherits that invariant. Template key lists, seeds, bodies, persistence, UI, sample execution, and executable publication transitions remain outside Task 12.8.

Task 12.9 corrects the earlier global Prompt snapshot assumption. Because registry identity includes module key, EffectivePromptSnapshot contains all seven authoritative modules in canonical order; each module pins Base/Overlay registry and version identities, `templateVersion`, and `schemaVersion`, while the effective composition separately pins `compositionVersion`. BookSummary stays display-only. BookMetadataDetail carries current classification and nullable latest immutable analysis snapshot as independent values. Upgrade fixtures create a new snapshot and explicit impact plan; mixed-offset chronological ordering compares parsed instants, requires strict advancement, and rejects equal instants. They never rewrite the previous snapshot. No snapshot persistence or production Prompt mapping is admitted.

Task 12.10 adds the first minimal Settings natural entry only for the blocked sample-preview card. The disabled action exposes three exact blocker codes and states that publication requires `sampleGateStatus = passed`. There is no handler, query, preview fixture execution, Job, Prompt body, IPC/preload method, SDK/provider call, or AI output. Completed Task 12.13 extends the same Settings route with other unavailable settings surfaces without weakening this boundary.

Task 12.11R extends that natural Settings entry with a constrained, non-executing publication-controls shell over a validated PromptTemplate registry aggregate. Pure domain policy evaluates `publish`, `rollback`, and `disable`; publish records historical publication on a passed draft before repointing, rollback requires a distinct historically published target, and disable retains the current published pointer. Every successful synthetic preview reparses the complete aggregate. Because no production PromptTemplate instance or persistence is admitted, all three native controls remain disabled and expose exact blocker codes. There is no handler, IPC/preload method, migration, table, repository/service, transition write, or Book snapshot mutation; real execution remains Task 17.13.

## Validation Strategy

- Run focused tests after every checkpoint.
- Run typecheck when shared/public contracts change.
- Run migration/integration tests only after persistence admission.
- Run one full `npm run check` after all authorized checkpoints; do not repeat it without new changes.
- Run `git diff --check` and scope review at every Task boundary.
- Never modify the protected master plan.

## Current Stop Condition

Tasks 12.6A–12.6C and 12.6D.1B–12.6D.5 are complete. The D061 continuous implementation stopped before separately authorized Task 12.7; D062 completes its natural-path disabled shell, D063 completes Task 12.8's metadata-only PromptTemplate registry shell, D064 completes Task 12.9's immutable snapshot DTO fixture, D065 completes Task 12.10's visible blocked sample-preview gate, and D066 as repaired by Task 12.11R completes the aggregate-valid non-executing publication-controls shell. The natural Breakdown shelf path supports optional import-time selection and later CAS editing, while Settings exposes blocked preview and publication controls. There is no custom-type creation, PromptTemplate production record, analysis snapshot persistence, template body, executable publish/rollback/disable action, methodology, Prompt runtime, classifier, executable sample preview, SDK call, provider call, or AI behavior.
