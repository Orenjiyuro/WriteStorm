# WriteStorm V1 Block 10 Job State And Recovery Status

Date: 2026-07-16

## Current verdict

**Block 10 is complete within the recorded Windows V1 boundary.** Tasks 10.1–10.8 reuse and incrementally harden the foundation-reset Job/Checkpoint core, record the existing import/detection/freeze/module-shell flows, provide typed owner-first cancellation, expose the natural `Jobs & recovery` product entry, and recover abandoned source imports only after a successful Library activation.

This verdict does not authorize a real background queue, Codex SDK, AI analysis, generated AI content, automatic Resume, executable Keep draft, export execution, or Block 11 implementation. A persisted resumable fixture proves restart discovery and display only; there is no natural resumable producer.

## Master Task 10.1–10.8 reconciliation

| Master Task | Completion status | Evidence boundary |
| --- | --- | --- |
| 10.1 | Complete | Preserves the foundation-reset state machine, freezes persisted JobType/checkpoint-unit vocabulary and capability policy, and keeps future AI/export contract-only. |
| 10.2 | Complete | Reuses migration 001 `jobs`/`job_checkpoints`; Library-wide newest-first reads, optional Book filter, durable detail reads, and fail-closed persisted type/JSON mapping are covered without migration 006. |
| 10.3 | Complete | Existing `JobService` owns queued creation, legal transitions, fail/cancel policy, monotonic progress, checkpoint safety, and atomic final completion. |
| 10.4 | Complete | Existing import, structure detection, and structure edition records remain authoritative; first runtime freeze atomically records one seven-instance module-shell batch Job/checkpoint, while migration 004 fabricates none. |
| 10.5 | Complete | Typed `jobs:list/get/cancel` returns Library-wide summary/detail data and performs exact runtime-owner-first cancellation before persisting `cancelled`. |
| 10.6 | Complete | The real Breakdown shelf exposes Library-wide status badges, progress, failure reason, checkpoints, Cancel, disabled Resume, and type-appropriate disabled/absent Keep draft. |
| 10.7 | Complete | Successful Library activation awaits abandoned-import recovery before returning success; failed/resumable states remain discoverable after reopen. |
| 10.8 | Complete | The state machine, checkpoint safety, invalid payload, import guards, natural recovery entry, packaging, and restart smoke are certified through the focused matrix and fresh `npm run check`. |

## Frozen domain and persistence boundary

- Persisted states are `queued`, `estimating`, `waiting_confirmation`, `running`, `paused`, `failed`, `resumable`, `cancelled`, and `completed`.
- Existing persisted Job kinds remain `source_import`, `structure_detection`, and `structure_edition`; runtime first-freeze audit uses `analysis_module_shell_creation`.
- `analysis_module_instance_analysis` and `export` are vocabulary-only, `contract_only`, non-creatable, and absent from `JOB_PAYLOAD_SCHEMAS`.
- Checkpoint units describe durable recovery granularity and do not replace Job state.
- Progress is integer, nonnegative, monotonic, bounded by a known total, and a discovered total cannot return to null or change.
- Migration 001 remains the owner of `jobs` and `job_checkpoints`; migrations 001–005 are unchanged, schema version remains 5, and no migration 006 exists.
- Repository list defaults to every Library Job, including failed imports with `book_id = null`, ordered by `updatedAt DESC, id DESC`; Book filtering is optional.
- Unknown persisted Job types and malformed Job/checkpoint JSON fail closed rather than reaching renderer DTOs.

## State machine and checkpoint safety gate

The executable state machine gate is distributed across:

- `tests/unit/shared-job-contract.test.ts`: exact state/type/capability/checkpoint vocabulary and representative legal/illegal transitions.
- `tests/integration/jobs/job-service.test.ts`: queued-only creation, completed-only specialized transition, progress policy, failure validation, owner-confirmed cancellation, Book ownership, and terminal-state protection.
- `tests/integration/jobs/job-application-service.test.ts`: runtime owner stops the exact import/detection operation before durable cancellation; ownerless active work fails closed.

Checkpoint safety requires all of the following:

- No current JobType admits a queued preparation checkpoint.
- Failed, cancelled, and completed Jobs retain prior checkpoints but reject new ones.
- Generic append rejects final checkpoints, repeated final checkpoints, cross-type checkpoints, and every currently unadmitted intermediate kind.
- A final checkpoint belongs to the persisted JobType and is written only by `completeWithCheckpoint`.
- Job state, Book binding, progress, and the final checkpoint commit atomically; checkpoint persistence failure rolls all completion changes back.
- Only `source_import` may bind `null -> importedBookId`; every other completion must retain the exact existing Book.
- The first-freeze module-shell Job/checkpoint, seven instances, structure freeze, Book edition, and structure-edition Job share one transaction.

## Invalid payload gate

Invalid payload protection is layered rather than delegated to one boundary:

- Shared Zod contracts reject unknown fields, invalid state/progress values, invalid Job requests, and renderer-supplied filesystem paths.
- The typed IPC router returns stable `INVALID_REQUEST` before invoking Job/import handlers.
- `JobService` rejects unregistered versions, malformed payloads, payload/checkpoint mismatch, and contract-only Job creation.
- `JobRepository` rejects unknown persisted types and malformed persisted JSON.
- `jobs:get` returns the distinct validated `JobDetail`; it does not widen the import result's `JobSummary`.
- Expected Job failures map to stable `JOB_ERROR` envelopes; unrelated product IPC remains at its own boundary.

## Import guards

Block 10 preserves the previously accepted source import guards while adding Job/recovery behavior:

- Renderer requests cannot contain `sourcePath`, `filePath`, `path`, or `rootPath`; initial selection remains main-side.
- Manual encoding retry uses a main-only, Library-session-scoped pending token and cannot rename the import or submit a path.
- The import adapter captures the current session before opening the dialog and rejects a stale dialog/window/session before service execution.
- Source import records queued/running/completed through the existing `JobService`; the completed response DTO is mapped from the persisted JobRecord rather than synthesized separately.
- Worker reads remain bounded, staging uses an exact per-Job file, cancellation removes incomplete staging, promotion refuses overwrite, and database failure compensates the promoted source.
- Duplicate hash races re-query the winning Book/SourceText and never publish a duplicate Book.
- Library replacement pauses admission, stops active imports, awaits cleanup, clears pending tokens, and only then publishes the replacement session.
- Restart recovery changes only abandoned queued/running `source_import` Jobs to `failed` with `SOURCE_IMPORT_ABANDONED` and removes only `source/.staging/{jobId}.tmp`; unrelated staging and existing failed/resumable Jobs remain intact.

## Typed IPC, recovery UI, and natural entry

`jobs:list` defaults to all Jobs in the active Library, `jobs:get` returns persisted checkpoint detail, and `jobs:cancel` delegates to `SourceImportService.cancelImport(jobId)` or `StructureService.cancelDetectionAndWait(jobId)` before cancellation is recorded.

The user-visible acceptance path is:

1. Launch the packaged desktop application.
2. Create/open a Library from the normal entry.
3. Import a source from the Breakdown shelf.
4. Observe the completed import Job and checkpoint in `Jobs & recovery`.
5. Create/review/freeze structure and observe detection, structure-edition, and seven-instance module-shell Jobs.
6. Reopen the Library with persisted failed/resumable records and an abandoned running import.
7. Observe the abandoned import as `SOURCE_IMPORT_ABANDONED`, the previous failed/resumable entries still discoverable, checkpoint/failure detail, and executable owner-first Cancel.
8. Confirm the exact abandoned staging file is gone while the frozen structure and module workbench remain available.

This is a real Library/Breakdown-shelf path. Diagnostics, a bypass URL, service-only tests, IPC-only tests, or isolated component rendering do not count as the natural product acceptance.

Resume remains visibly disabled. Keep draft is disabled with a structure-specific reason only for structure JobTypes and is absent when not applicable. The resumable fixture establishes persisted state for discovery; it is not evidence of a natural resumable producer.

## Restart recovery semantics

- Recovery runs through a dedicated successful Library activation hook, not the generic session-change `finally` callback.
- The previous session id, returned summary session id, and `LibraryService.getCurrent()` are compared before recovery.
- A mismatch returns recoverable `LIBRARY_ERROR` with `library_activation_mismatch` and does not run recovery.
- Recovery is awaited before create/open success reaches renderer.
- Recovery failure closes the new session and returns `restart_recovery_failed`; a half-recovered Library is never reported as open.
- Structure detection keeps its explicit recovery path and is not automatically resumed.

## Task 10.8 focused regression matrix

The focused regression command is:

```powershell
npx vitest run tests/unit/shared-job-contract.test.ts tests/unit/main-job-ipc.test.ts tests/unit/renderer-job-recovery.test.tsx tests/unit/main-library-restart-recovery.test.ts tests/unit/block10-docs.test.ts tests/integration/jobs/job-repository.test.ts tests/integration/jobs/job-service.test.ts tests/integration/jobs/job-application-service.test.ts tests/integration/source-text/source-import-service.test.ts
```

The matrix covers state machine vocabulary/transitions, checkpoint safety and atomicity, invalid payload rejection across contract/IPC/service/persistence, owner-first cancellation, import guards, restart activation semantics, persisted failed/resumable preservation, and the documented completion boundary.

## Final certification matrix

The fresh Windows certification on 2026-07-16 is:

| Gate | Command or observable evidence | Result |
| --- | --- | --- |
| Full static/unit/integration/packaged suite | `npm run check` | Passed: TypeScript; 106 unit files / 491 tests; 28 integration files / 246 tests; Windows x64 Forge package; 13/13 serialized packaged Electron tests. |
| Natural recovery entry | `tests/e2e/source-import.spec.ts` | Passed through create/import/freeze/reopen: completed existing-flow Jobs, failure/checkpoint detail, abandoned-import failure, persisted failed/resumable discovery, owner-first Cancel, and exact staging cleanup. |
| Secondary-display hard gate | `tests/e2e/secondary-display.spec.ts` plus Playwright default policy | Passed: local packaged windows were placed on the non-primary display before showing; CI and normal product launch remain unaffected. |
| State and checkpoint focused gate | Shared Job contract plus Job repository/service/application integration tests | Passed: legal transitions, progress, Book ownership, per-type checkpoint ownership, terminal append rejection, completion atomicity, and owner-first cancellation. |
| Invalid payload and import guards | Typed IPC, shared contract, source import service/worker/transaction tests | Passed: handlers are not called for invalid requests, renderer paths remain excluded, persisted corruption fails closed, and import cleanup/compensation/session guards remain intact. |
| Diff hygiene | `git diff --check` and scoped status review | Passed with no migration, dependency, generated artifact, unrelated product feature, or whitespace error. |

## Explicit exclusions and remaining boundaries

- No real background Job queue or scheduler exists.
- No Codex SDK, AI analysis Job, module body generation, evidence extraction, rerun candidate, or AI content exists.
- `analysis_module_instance_analysis` remains future contract vocabulary and cannot be created.
- `export` remains contract-only and cannot create or execute a Job; Block 11 owns export blocked state.
- Resume is not executable and there is no automatic resume.
- Keep draft is not executable; import/module-shell Jobs do not have a draft.
- There is no natural resumable producer; the resumable fixture proves only persistence, restart visibility, and UI behavior.
- No migration 006 or rewrite of migrations 001–005 was introduced.
- Windows x64 packaged behavior is certified here. macOS packaging, makers, signing, notarization, and release readiness remain separate unverified boundaries.
