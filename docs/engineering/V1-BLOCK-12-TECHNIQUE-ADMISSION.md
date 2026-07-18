# WriteStorm V1 Block 12 Technique Persistence Admission

Date: 2026-07-16

Status: Task 12.1 complete as an admission contract; repository/service target blocked and deferred

## Verdict

Technique persistence is **not admitted in Block 12**.

The current repository has a shared `TechniqueEntry`/`SourceSnapshot` boundary, but it has no admitted persisted `ReusableTechniqueCandidate` owner, no confirmed-candidate query, no natural adoption producer, and no transaction that can capture a `SourceSnapshot` while creating a `TechniqueEntry`. A test fixture or direct SQLite insert is not a production lifecycle.

No migration number, production table, repository, service, IPC channel, or renderer mutation is authorized by this record. Technique persistence and editable existing-entry behavior defer to Block 16. The original master Task 12.1 repository/service target is blocked/deferred and must not be represented by an in-memory or empty fake implementation.

## Closed Contract

### Identity and ownership

- `TechniqueEntry.id` is an opaque stable `TechniqueEntryId`.
- `TechniqueEntry` is owned by the active Library through `libraryId`; it is never owned by a Breakdown Book.
- Entity identity is independent from mutable title, tags, status, revision, and source availability.
- The idempotency identity for candidate adoption is intentionally unresolved until the adoption producer and candidate owner are admitted.
- Manual primary creation remains disabled and automatic fusion remains prohibited.

### Editable detail fields

A future persisted detail contract must contain:

- `id`
- `ownerKind = technique_library`
- `libraryId`
- `title`: trimmed non-blank user-facing title
- `summary`: editable deproprietized summary
- `tags`: ordered, trimmed, non-blank values with exact duplicate removal
- `applicableScope`: editable deproprietized non-blank scope text
- `limitations`: ordered, editable deproprietized non-blank values
- `status`: the existing `draft | organized | pending_merge | deprecated` vocabulary
- `revision`: positive optimistic-concurrency revision
- `sourceSnapshot`: immutable provenance
- `createdAt`
- `updatedAt`

The exact SQLite representation of tags and limitations is not frozen. Separate tables, JSON columns, or another storage shape may not be selected until query, update, indexing, and migration semantics justify that representation. SQLite remains the only fact source.

### Read and update semantics

- List order is `updatedAt DESC, id ASC`.
- List DTOs may expose identity, title, tags, applicable scope, status, revision, and update time; they do not need the complete `SourceSnapshot`.
- Detail reads expose the complete immutable `SourceSnapshot`.
- Updates require `expectedRevision`; a successful update increments revision exactly once and updates `updatedAt` in the same transaction.
- Updates may change only title, summary, tags, applicable scope, limitations, and status.
- Status updates must follow the existing TechniqueEntry state machine.
- Source IDs, SourceSnapshot content, creation time, owner, and identity are never editable.
- Hard delete is not admitted. V1 retirement uses the existing `deprecated` state.

### SourceSnapshot lifecycle

- Each `TechniqueEntry` owns exactly one `SourceSnapshot`.
- A SourceSnapshot is captured once in the same future transaction that creates its TechniqueEntry from a confirmed reusable candidate.
- A SourceSnapshot is not shared between Technique entries, replaced, updated, or deleted independently.
- It survives source Book, candidate, observation, and evidence mutation or deletion.
- Source IDs are readonly trace values. They cannot become foreign keys to unadmitted owner tables.
- TechniqueEntry or SourceSnapshot writes never update observations, candidates, EvidenceAnchors, source review state, or the source Breakdown Book.

## Unclosed Producer Contract

The only admissible V1 primary producer remains adoption of a confirmed `ReusableTechniqueCandidate`.

The following facts are missing:

1. A persisted owner and read path for reusable candidates.
2. A stable definition of candidate confirmation and adoption eligibility.
3. An application service that pins the Library session and validates the candidate.
4. A transaction that creates the SourceSnapshot and TechniqueEntry atomically.
5. A duplicate-adoption and retry identity.
6. A natural renderer entry that can reach an eligible confirmed candidate.

Until all six exist, a new Library must truthfully show an empty Technique Library and a disabled adoption action with a producer-unavailable reason. It cannot offer editable existing-entry behavior as a naturally reachable capability.

## Executable Blocked-State Evidence

`tests/unit/block12-technique-admission.test.ts` records the current blocked state as passing assertions:

1. The current strict `techniqueEntrySchema` rejects the future editable fields, revision, and timestamps because persistence is not admitted.
2. The product IPC allowlist has no candidate-adoption producer.
3. The production migration registry and admitted owner map contain no Technique table.

The established ownership and no-write-back assertions remain executable in:

- `tests/unit/shared-technique-ownership.test.ts`
- `tests/unit/shared-technique-evidence-boundary.test.ts`
- `tests/unit/shared-source-snapshot.test.ts`

## Authoritative Block 12 Technique Plan Override

### Task 12.1

Task 12.1 is complete only as this TechniqueEntry admission contract and blocked/deferred conclusion. It creates no migration, table, repository, service, IPC, or user mutation and does not claim persistence completion.

Frozen future rules are:

- Editable fields are title, summary, tags, applicable scope, limitations, and status.
- Future updates require `expectedRevision` optimistic concurrency.
- Future list order is `updatedAt DESC, id ASC`.
- Hard delete is not admitted.
- Each future Entry exclusively owns one immutable SourceSnapshot.
- Technique writes never write back to the source domain.
- Tags/limitations physical storage and migration numbering remain unfrozen.

### Task 12.2

Implement the real Technique Library navigation entry and truthful empty state. The empty state states that entries can only come from future adopted candidates. It displays no fake entry, test fixture, or direct-create primary action.

### Task 12.3

Show that editing is unavailable and explain that no TechniqueEntry persistence owner or naturally produced entry exists. Do not render a real edit form, submit callback, update IPC, or optimistic local edit.

### Task 12.4

Show the SourceSnapshot contract position and readonly/no-write-back semantics only. Do not render a fabricated SourceSnapshot instance or source identifiers.

### Task 12.5

Show the adoption affordance as natively disabled. Its visible and accessibility-linked reason is that the reusable-candidate owner, confirmed-candidate query, and atomic adoption transaction are not admitted.

### TypeLibrary

TypeLibrary reference persistence may be considered before Technique persistence only after stable keys and the complete parent/child matrix are frozen. Book binding supplies its real write path.

### PromptTemplate

PromptTemplate remains a pure domain and state-machine shell until template keys, seed/version ownership, and the relationship between lifecycle and enabled/disabled state are frozen.

### Book metadata and acceptance

- Book list DTOs may later add type/subtype display fields.
- Complete TypeLibrary and PromptTemplate snapshots belong to a separate Book metadata/detail DTO.
- Block 12 packaged acceptance must not require editing an existing TechniqueEntry.
- Task 12.15 acceptance verifies the natural Technique Library empty state, the disabled adoption reason, the SourceSnapshot readonly/no-write-back boundary, and the absence of Technique production tables. This acceptance is complete under D070.
- Task 12.15 also verifies the independent Original shelf and Settings `local_only` observability shell assigned to their own Tasks; manual export remains disabled under `manual_log_export_not_admitted`.
- Direct SQLite insertion, a fixture-only renderer route, Diagnostics, or an isolated component cannot substitute for this natural product path.
