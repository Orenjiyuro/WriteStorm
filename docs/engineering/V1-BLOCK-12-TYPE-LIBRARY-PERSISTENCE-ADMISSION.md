# WriteStorm V1 Block 12 TypeLibrary Persistence Admission Record

Date: 2026-07-18

Status: Task 12.6 complete through D061; Tasks 12.6R1 and 12.6R5 remediations complete

## Current Verdict

Tasks 12.6A–12.6C confirm domain boundaries and fourteen user-facing option copies. Option A approval: approved. V1 release approval: approved. CAS/archive approval: approved. D054–D058 complete schema and repository/service CAS; D059 completes strict IPC/preload DTO exposure; D060 completes source-import integration and natural renderer selectors; D061 completes packaged Electron acceptance. Source-import product integration, renderer selectors, and natural Electron entry are complete. Task 12.6R1 proves ordinary import repair retries retain the user-selected classification. Task 12.6R5 enforces a one-way archive: current selectors exclude archived definitions while historical pinned Book bindings remain readable. D071 closes historical visibility through Book binding detail with ordered pinned display metadata; archived references are disabled in the Book editor, may be retained only in their original release/slot, and cannot be newly selected or restored after removal.

K1 mapping approval: approved. The production shared registry owns the approved stable keys and V1 copies; test admission fixtures derive from that registry instead of duplicating copy. Migration 006 independently freezes the same V1 facts as migration-local historical literals and inserts 14 definitions, 14 definition versions, one release, and 14 release entries. Migration 007 implements D053's no-row revision 0 representation, first-write revision 1, retained empty binding rows, exact revision increment, pinned release/kind validation, and Book-owned cascade.

At proposal start the migration registry ended at 005 and `books` had no classification revision or type columns. The accepted design avoided rebuilding `books`; the current Block 12 registry includes migrations 006–007 and stores classification in independent normalized tables.

Migration 006 is assigned to the approved reference registry and migration 007 to Book binding facts. The shared typed release remains the current application contract; migration-local literals preserve the historical SQLite seed and are protected against drift by focused tests. No later migration number is pre-assigned.

## Completed Product Path

The admitted implementation supports these real paths:

1. Import without classification creates a Book and no type binding.
2. Optional import-time selection is captured in the same final import transaction as Book creation.
3. Later Book metadata editing reads the current binding and writes with `expectedRevision` CAS.
4. A Book may save zero or one MainType and zero to three unique ordered ContentFocus selections.
5. A focus-only or fully empty edited binding remains persisted but blocks formal analysis with `missing_main_type`.
6. Book lists expose display-only type fields; metadata/detail reads expose exact version references.
7. Existing Books and historical analysis snapshots never receive silent defaults, release upgrades, or reinterpretation.

## Persistence Options

### Option A: Normalized SQLite Registry And Book Binding

Use six focused tables:

- `type_definitions`: immutable identity, kind, origin, built-in stable key, and archive marker;
- `type_definition_versions`: immutable display-name and selection-description versions;
- `type_library_versions`: immutable release headers;
- `type_library_version_entries`: exact definition-version membership and display order for each release;
- `book_type_bindings`: one mutable current classification target per Book with CAS revision;
- `book_content_focus_bindings`: binding-owned zero-to-three ordered ContentFocus references.

Advantages:

- SQLite remains the transactional fact source.
- Foreign keys and semantic witnesses protect release membership and Book ownership.
- Old Books retain exact definition versions while later releases add or rename options.
- Future user-defined identities can use the same definition/version model without being implemented in Block 12.
- Independent binding tables avoid rebuilding the current `books` table.

Costs:

- Six tables and cross-table kind/release checks require careful migration witnesses.
- Contiguous ContentFocus priority is service-owned because row-by-row SQLite constraints cannot safely validate the final replacement set without staging complexity.

### Option B: Source Registry Plus SQLite Book Binding

Keep built-in definitions and versions only in TypeScript, then persist stable keys and version numbers in two Book binding tables.

Advantages:

- Fewer SQLite tables and simpler initial seed mechanics.
- Built-in copy remains easy to inspect in source control.

Costs:

- Book facts depend on mutable application code outside the Library database.
- Every historical release must remain bundled forever or old Books become unreadable.
- Future local custom types require a second ownership model and create code/SQLite dual truth.
- Cross-release foreign keys and database-only repair become impossible.

### Option C: JSON Classification Snapshot

Store MainType, ordered ContentFocus values, release number, and revision in a JSON payload attached to each Book or a one-row Book metadata table.

Advantages:

- Minimal table count and simple object-shaped reads.

Costs:

- Violates the rule that JSON is not the authoritative fact model.
- Cannot enforce definition identity, version membership, kind, uniqueness, or references with ordinary foreign keys.
- Querying Book lists and future custom-type archives becomes fragile.
- Adding columns directly to `books` still requires a risky table rebuild for strong foreign keys.

## Recommendation: Option A

Option A is the only proposal that closes identity, owner, lifecycle, real write/read paths, old-Book version preservation, and future custom-type compatibility without rebuilding `books` or making TypeScript/JSON the fact source.

The six-table shape is not inferred from UI field names. Each table has an independent identity or lifecycle that cannot be safely collapsed:

| Table | Identity | Owner | Lifecycle |
| --- | --- | --- | --- |
| `type_definitions` | TypeDefinition id | active Library; built-in rows introduced by app migration | identity immutable; archive only |
| `type_definition_versions` | TypeDefinitionVersion id and per-definition version | owning TypeDefinition | append-only and immutable |
| `type_library_versions` | positive release version | active Library TypeLibrary | append-only publication snapshot |
| `type_library_version_entries` | release + definition-version membership | owning TypeLibraryVersion | immutable with release |
| `book_type_bindings` | Book id | owning Book | current mutable target with CAS |
| `book_content_focus_bindings` | Book + priority | owning Book binding | atomically replaceable association set |

Definition, version, and release rows have no hard delete. A TypeDefinition retires through a one-way archive from null to one immutable timestamp. Current selectors exclude archived definitions. Book binding detail separately resolves every pinned definition version to immutable display metadata and marks archived values for disabled historical rendering. A CAS update may retain an archived reference only in the same release, role, and priority slot; it cannot add or restore one. Hard delete is not admitted for definitions, definition versions, TypeLibrary versions, or release entries. Deleting a Book may cascade its current binding and child ContentFocus associations because those associations have no independent history.

## Stable Identity Schemes

### Scheme K1: Opaque Namespaced Ordinals

Recommended key scheme: opaque namespaced ordinals.

Proposed MainType keys:

| Stable-key proposal | Display name |
| --- | --- |
| `builtin_main_001` | 日轻校园 |
| `builtin_main_002` | 日轻异界 |
| `builtin_main_003` | 现代都市 |
| `builtin_main_004` | 现代幻想 |
| `builtin_main_005` | 古代幻想 |
| `builtin_main_006` | 西式幻想 |
| `builtin_main_007` | 诸天无限 |

Proposed ContentFocus keys:

| Stable-key proposal | Display name |
| --- | --- |
| `builtin_focus_001` | 恋爱炒股 |
| `builtin_focus_002` | 英雄史诗 |
| `builtin_focus_003` | 能力规则 |
| `builtin_focus_004` | 种田运营 |
| `builtin_focus_005` | 群像 |
| `builtin_focus_006` | 事业 |
| `builtin_focus_007` | 冒险探索 |

Advantages: copy-independent, locale-independent, deterministic seed identity, and no semantic key rename when product wording changes. Ordinals are never reused and do not imply user priority.

Proposed built-in TypeDefinition ids equal their stable keys. Proposed V1 version ids append `_v1`, for example `builtin_main_001_v1`. Future user-defined TypeDefinition ids use opaque generated ids and have `stableKey = null`.

### Scheme K2: Semantic English Keys

Examples include `light_novel_campus` and `romance_choice`. They improve diagnostics but embed translation and interpretation choices that may become inaccurate when display copy evolves.

### Scheme K3: UUID-Only Identity

Use generated opaque ids for built-ins and omit meaningful stable keys. This avoids naming disputes but weakens migration readability, deterministic seed review, and external diagnostics.

K1 and the exact fourteen mappings are approved. D051 freezes the mapping while keeping typed admission fixture keys null until the V1 release set is approved, so key approval cannot be mistaken for publication.

## Approved TypeLibraryVersion 1 Typed Release

TypeLibraryVersion 1 contains all seven MainType V1 entries and all seven ContentFocus V1 entries. D052 approves the exact shared typed release. The release is an immutable membership snapshot, not a claim that MethodologyVersion or PromptTemplateVersion is ready. D052 itself did not authorize persistence; the later D054 migration admission separately authorized the exact SQLite seed.

Release display order follows the user-confirmed lists. The release entry order is presentation order only. Each Book independently chooses and orders zero to three ContentFocus identities.

The latest published release is the default selector source only for a Book with no binding row. A Book with an existing binding continues to read its pinned TypeLibraryVersion. Moving it to a later release requires an explicit upgrade action, a new classification revision, a new AnalysisConfigurationSnapshot when analysis is requested, and an impact plan. No max-version lookup may silently rewrite an existing Book.

## Book Binding CAS Lifecycle

- Initial imported Book: no binding row means `expectedRevision = 0` and unassigned metadata.
- First successful mutation: `expectedRevision = 0`; first successful mutation creates revision 1.
- Later mutation: update succeeds only when the stored revision equals `expectedRevision`, then increments exactly once.
- Clearing MainType and every ContentFocus: clearing all selections retains the binding row and increments revision, preventing an ABA return to revision 0.
- Deleting the Book: cascades binding and association rows.
- Reading malformed persisted ordering, kind, release membership, or references: fail closed with `invalid_persisted_book_type_binding`.

The service replaces the ordered ContentFocus set in the same transaction as the binding revision update. Database constraints enforce priority range 1–3 and uniqueness; strict domain parsing enforces contiguous priorities. A read gap is corruption, not a list to normalize silently.

Every mutation updates only the Book's current classification target. It never rewrites an existing AnalysisConfigurationSnapshot or historical result. Logic upgrades remain explicit and create a new snapshot plus impact plan.

## Constraint And Query Semantics

Migrations 006–007 provide two-sided semantic witnesses for:

- allowed kind and origin values;
- built-in stable-key presence and user-defined stable-key absence;
- positive unique per-definition version numbers;
- immutable release membership;
- positive TypeLibrary versions and Book revisions;
- release membership of selected MainType and ContentFocus versions;
- MainType/ContentFocus kind correctness;
- ContentFocus priority range and per-Book uniqueness;
- Book ownership and delete cascade;
- rejection of hard deletes on definition/version/release facts.

Reference queries:

- release options: verify complete historical membership, exclude archived definitions from current selectors, then derive dense kind-filtered order;
- Book binding detail: resolve exact ordered pinned display metadata independently of selector availability and fail closed on missing ownership or release membership;
- Book binding: one parent row plus ContentFocus children ordered `priority ASC`;
- Book list display: left joins, preserving existing `books.updated_at DESC, books.id ASC` order;
- no binding row: return revision 0, null MainType, and an empty ContentFocus list without inserting data.

Stable service errors must include `book_not_found`, `revision_conflict`, `type_library_version_unavailable`, `type_definition_version_unavailable`, `type_kind_mismatch`, `duplicate_content_focus`, `too_many_content_focuses`, and `invalid_persisted_book_type_binding`.

## Deferred Custom-Type Boundary

The schema may reserve `origin = user_defined` and `archived_at`, but Block 12 does not implement create, copy-from-template, edit, publish, archive, rebase, or delete flows. The Task 12.7 entry remains disabled. Future custom-type publication must create immutable definition/methodology/Prompt versions and a new release; it cannot mutate built-in identities or old Book snapshots.

## Implementation Checkpoints And Historical Boundaries

### 12.6D.1B Stable Identity And Release Contract

Historical checkpoint status: complete for shared typed identity and release contracts; no SQLite object was admitted at this checkpoint.

File scope: production typed built-in registry, shared TypeDefinition/TypeLibraryVersion schemas, exact seed fixtures, and focused unit tests.

RED: reject missing/duplicate keys, key/display drift, wrong kind, non-null methodology, incomplete 14-entry release, and mutation of historical copies.

GREEN: assign only approved keys and V1 version ids; create no SQLite object.

Verification: `npx vitest run` focused stable-identity tests, `npm run typecheck`, and `git diff --check`.

### 12.6D.1C Migration And Semantic Witnesses

Split into three 20–30 minute checkpoints:

1. Registry/version/release tables and exact seed RED/GREEN. **Complete in migration 006.**
2. Book binding/ContentFocus tables, foreign keys, triggers, and CAS schema RED/GREEN. **Complete in migration 007.**
3. Semantic-boundary inventory, runtime-schema validation, empty replay, and mutation tests. **Complete; see `V1-BLOCK-12-TYPE-LIBRARY-SCHEMA-INVENTORY.md`.**

File scope: one newly authorized forward migration and boundary file, migration registry, focused DB tests, app-schema expectations, and schema compatibility fixtures. The migration number is assigned only at authorization.

### 12.6D.2 Repository And Service CAS

Split into list/read mapping, first-write/revision CAS, atomic focus replacement, corruption mapping, and import-transaction port checkpoints. Each checkpoint has focused integration tests and leaves IPC absent until GREEN.

Historical checkpoint status: complete. `src/main/type-library/type-library-repository.ts` owns strict reads and atomic persistence; `src/main/type-library/type-library-service.ts` owns first-write and update CAS, stable errors, ordered focus replacement, and a reusable outer-transaction port. At this checkpoint, source-import product integration remained deferred until D060.

### 12.6D.3 IPC And Preload Boundary

Add narrow option-list, Book-metadata read, and CAS update contracts. RED rejects paths, SQLite fields, secrets, tokens, SDK values, and extra request fields. Renderer receives DTOs only.

Historical checkpoint status: complete. The central allowlist/registry owns three TypeLibrary channels; main composition maps only `TypeLibraryService` DTO methods; typed-router validation rejects extra path, SQLite, credential, SDK, timestamp, and persistence fields before service invocation. Preload exposes one narrow `typeLibrary` namespace and no raw IPC escape hatch. Renderer use was still deferred to Task 12.6D.4 at this checkpoint.

### 12.6D.4 Natural Renderer Paths

Add optional import-time selection and later Book metadata editing. The BookSummary list receives display-only fields; full versions stay in detail DTOs. Visible readiness uses the common title and exact blocker codes. Block 12 runs no AI.

Status: complete under D060. The existing Breakdown shelf owns optional import-time selection and later CAS editing. Task 12.6R1 repairs ordinary failure retries without changing the encoding pending-token boundary.

### 12.6D.5 Electron Acceptance

Use the real Library/Breakdown entry with existing hidden-window or secondary-display infrastructure. Cover unassigned import, optional import selection, later edits, focus-only persistence, restart persistence, ordered zero-to-three labels, revision conflict, and visible analysis blockers.

Status: complete under D061, with Task 12.6R1 adding natural-path retry-retention evidence.

## Approval Questions

Persistence design decisions are closed as follows:

1. Option A's six-table ownership model: **approved**.
2. K1 and the exact fourteen stable-key mappings: **approved**.
3. TypeLibraryVersion 1 containing all fourteen confirmed V1 copies: **approved**.
4. No-row revision 0, retained empty binding rows after first mutation, and archive-only definition retirement: **approved**.

Migrations 006–007 remain limited to admitted persistence facts. D057–D059 separately authorize repository/service and IPC/preload code; D060–D061 authorize and certify renderer controls, source-import product integration, and the natural Electron path. Task 12.6 product persistence is complete within this exact boundary. Methodology, Prompt execution, automatic classification, custom-type creation, and AI behavior remain outside it.
