# WriteStorm V1 Block 12 TypeLibrary Schema Boundary Inventory

Date: 2026-07-18

Status: Migrations 006–007 and D057–D061 product path certified; Tasks 12.6R1 and 12.6R5 repairs recorded

## Scope

This inventory began as the persistence-schema checkpoint and now records the completed downstream product path. SQLite is authoritative for admitted TypeLibrary and Book-binding facts. D057–D058 add repository/service CAS, D059 adds typed IPC/preload methods, D060 adds source-import and renderer paths, and D061 certifies the natural Electron path. Task 12.6R1 repairs import retries so retained user classification is never replaced by an empty request. Task 12.6R5 enforces a one-way archive: current selectors exclude archived definitions, new bindings reject them, and historical pinned Book bindings remain readable. The renderer still has no SQLite, filesystem, shell, secret, secure-storage, SDK, or provider access. No methodology, Prompt runtime, classifier, or AI behavior is introduced.

## Physical Ownership

| Table | Owner | Identity | Lifecycle |
| --- | --- | --- | --- |
| `type_definitions` | active Library TypeLibrary | opaque TypeDefinition id | identity immutable; `archived_at` retirement; no hard delete |
| `type_definition_versions` | TypeDefinition | opaque version id plus per-definition positive version | append-only rows; no update or delete |
| `type_library_versions` | active Library TypeLibrary | positive release version | immutable header with positive declared `entry_count` |
| `type_library_version_entries` | TypeLibraryVersion | release plus definition identity | insert only until declared capacity; then sealed; no update or delete |
| `book_type_bindings` | Book | Book id | absent means revision 0; first row revision 1; exact single-step updates; no direct delete while Book exists |
| `book_content_focus_bindings` | Book binding | Book id plus priority | zero to three ordered associations; service-owned atomic replacement; Book cascade only |

## Database-Owned Boundaries

Migration 006 owns:

- kind and origin vocabulary;
- built-in identity/stable-key equality and user-defined null stable keys;
- positive definition and release versions;
- non-blank display copy, descriptions, timestamps, and archive markers;
- definition/version ownership and release-entry kind/version ownership;
- unique per-release definition, version, and per-kind sort order;
- positive immutable release `entry_count` and capacity sealing;
- one-way archive-only TypeDefinition retirement and immutable definition-version/release facts;
- the exact 14-definition, 14-definition-version, one-release, 14-membership V1 seed.

Migration 007 owns:

- one optional binding row per Book and zero rows for existing/unassigned Books;
- first-write revision 1 and exact `old + 1` updates;
- rejection of direct binding deletion while the owning Book exists, preventing revision ABA;
- paired nullable MainType identity/version references;
- MainType and ContentFocus kind plus pinned-release membership;
- ContentFocus priority range 1–3 and per-Book identity/version uniqueness;
- rejection of release changes that invalidate existing ContentFocus rows;
- Book deletion cascade without reference-fact deletion.

Every admitted CHECK or trigger boundary has an accept and reject witness. Unique, foreign-key, seed, replay, and cascade behavior has focused integration evidence. `validateRuntimeSchema` replays both migrations and executes their semantic witnesses against the actual schema.

## Repository/Service-Owned Boundaries

The read repository now owns:

- map no binding row to revision 0 without inserting data;
- read ContentFocus rows by `priority ASC` and reject any gap as `invalid_persisted_book_type_binding` instead of renumbering;
- parse every persisted aggregate through strict shared-domain schemas and fail closed on malformed rows;
- validate complete historical release membership against `entry_count` before selector filtering;
- list only active release options by MainType then ContentFocus and derive dense effective order without rewriting historical facts.

The D058 mutation service owns:

- compare caller `expectedRevision` in the mutation statement and return `revision_conflict` on zero affected rows;
- replace all ContentFocus rows and increment the parent revision in one transaction;
- retain an empty parent binding row when MainType and all ContentFocus selections are cleared;
- reject unavailable, unreleased, or archived definition versions before mutation; future release publication remains deferred;
- preserve Book list order `books.updated_at DESC, books.id ASC` while returning display-only type fields;
- update only the current Book classification target and never rewrite an AnalysisConfigurationSnapshot or historical result.

## Mutation Matrix

| Mutation | Current outcome |
| --- | --- |
| Add/update/delete V1 reference identity fields | rejected by constraints/triggers |
| Append a fifteenth V1 release entry | rejected by release capacity trigger |
| Archive a TypeDefinition once | allowed; timestamp cannot be cleared or rewritten |
| Bind an archived TypeDefinition | rejected as `type_definition_version_unavailable` |
| Insert first Book binding at revision 1 | allowed |
| Insert first Book binding at another revision | rejected |
| Update binding without exact single-step revision | rejected |
| Directly delete binding while Book exists | rejected |
| Delete Book | binding and focus rows cascade |
| Persist priority 2 without priority 1 | structurally possible for transactional replacement; strict aggregate read must fail closed |
| Mutate focuses outside repository transaction | unsupported; the admitted product path writes through the service transaction |

## Query And Corruption Semantics

- Historical release membership must equal its declared `entry_count`; mismatch means the release is unavailable and must not be normalized.
- Current selectors exclude archived definitions and re-densify effective order. An all-archived release returns an empty selector while its historical membership stays readable.
- A Book binding read is one parent plus children ordered `priority ASC`.
- No parent row returns revision 0, null MainType, and an empty focus list without a write.
- A priority gap, invalid kind, mismatched version, missing release member, duplicate aggregate identity, or malformed timestamp is corruption. It must not be repaired silently.
- Book summaries expose display-only classification fields. Exact release and definition-version references belong to Book metadata/detail DTOs.

## Verification

- `npx vitest run tests/integration/db/type-library-registry-migration.test.ts tests/integration/db/type-library-book-bindings-migration.test.ts tests/integration/db/type-library-schema-boundary-inventory.test.ts`
- `npx vitest run tests/integration/type-library/type-library-repository.test.ts`
- `npx vitest run tests/integration/type-library/type-library-service.test.ts tests/integration/source-text/source-import-service.test.ts`
- `npx vitest run tests/integration/db/migration-contract.test.ts tests/integration/db/runtime-schema-validator.test.ts tests/integration/db/schema-compatibility-gate.test.ts`
- `npx playwright test tests/e2e/type-library-natural-path.spec.ts`
- `npm run typecheck`
- `git diff --check`
