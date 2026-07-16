# WriteStorm V1 Block 11 Export Blocked State Status

Date: 2026-07-16

## Current verdict

**Block 11 is complete within the recorded read-only Windows V1 boundary.** Tasks 11.1–11.8 define a truthful blocked-status contract, derive admitted export facts from the active Library's SQLite state, expose only typed `exports:get-status`, mount the result through the real Breakdown shelf and a clearly non-Job status subsection, and certify that status reads cannot create export work or rewrite Library content.

The implementation and final certification are recorded at `main` / `origin/main` commit `ddde1a1` (`feat: add export blocked state`).

This verdict does not authorize real export execution, a package writer, an Export record, Export Job/checkpoint creation, directory selection, arbitrary paths, migrations, Markdown/JSON back-write, Codex SDK use, AI content, evidence extraction, future owner tables, or any Block 12 capability.

## Master Task 11.1–11.8 reconciliation

| Master Task | Completion status | Evidence boundary |
| --- | --- | --- |
| 11.1 | Complete | Freezes ordered target kinds, target and owner availability separation, blocker vocabulary, excluded-content kinds, runtime-emittable policy, and strict `ExportStatusDto` without record/Job lifecycle fields. |
| 11.2 | Complete | Calculates only admitted facts from the current Book, frozen structure, authoritative seven-module gate, module statuses, and `body_markdown` presence. |
| 11.3 | Complete | Keeps future content-model blocker vocabulary distinct from runtime output; unadmitted review/evidence/technique/perspective/completion owners emit only `*_owner_unavailable`. |
| 11.4 | Complete | Publishes a static exclusion policy for credentials, authentication tokens, secret keys, secure storage, and full sensitive logs without reading those sources. |
| 11.5 | Complete | Implements only typed read-only `exports:get-status`; ordinary blockers return success DTOs and expected Library/persistence failures use `EXPORT_ERROR`. |
| 11.6 | Complete | The real opened-Book Breakdown shelf always displays both targets, blockers, preview counts, excluded content, and permanently disabled execution controls, including before structure freeze. |
| 11.7 | Complete | `Jobs & recovery` displays `Export readiness (not a Job)` separately from the unchanged `JobSummary[]`; no virtual export Job or checkpoint is introduced. |
| 11.8 | Complete | Certifies no-write status, no arbitrary path, no Markdown/JSON back-write, zero export Jobs, successful Windows packaging, and the packaged blocked-state natural-entry smoke. |

## Frozen status contract

- Target order is `markdown_package`, then `machine_package`.
- Markdown target availability is always `blocked`.
- Machine target availability is always `unavailable`.
- Both targets always include `export_execution_not_admitted`; Block 11 runtime cannot report an executable export state.
- Both targets describe the same Book snapshot and therefore must carry identical preview facts.
- Before freeze, module preview is exactly expected `7`, actual `0`, non-empty body `0`, with every module status count zero.
- After freeze, module preview is exactly expected `7`, actual `7`; incomplete or semantically altered module definitions/instances fail closed.
- Blockers are derived from preview facts through the shared derivation and must use stable contract order.
- The owner list separates participation from target availability. Book, structure, and analysis modules are admitted read participants; review, evidence, technique, perspective, and completion-gate owners remain unavailable.
- Future fact blockers such as unreviewed assets, insufficient evidence, unadopted technique candidates, partial/stale perspectives, or an unsatisfied completion gate are vocabulary-only and cannot be emitted from the current runtime.

## SQLite and owner truth boundary

The Export service reuses the same authoritative module workspace gate as the module-instance service. Seven rows that merely exist are insufficient: persisted definitions, order, scope/asset/dependency contract, frozen structure snapshot, and the complete seven book-scope instances must match the admitted contract.

The current admitted reads are limited to:

- Current Library session and unit of work.
- Requested Book existence and current structure edition.
- Current frozen structure identity and edition.
- Ordered authoritative analysis-module definitions.
- Seven book-scope module instance statuses.
- Whether each persisted `body_markdown` value is non-empty.

No ReviewAsset, EvidenceAnchor, TechniqueEntry/candidate, PerspectiveView, or CompletionGate persistence owner is admitted. Missing future tables are never interpreted as empty business data.

## Sensitive-content exclusion and path boundary

The stable exclusion markers are:

- `credentials`
- `authentication_tokens`
- `secret_keys`
- `secure_storage`
- `full_sensitive_logs`

They are markers only. The Export production dependency graph does not import filesystem or Electron APIs, does not read environment credentials, and does not load secure storage or log bodies.

`exports:get-status` accepts only `bookId`. Strict typed request validation rejects extra fields including `rootPath`, `outputPath`, `directoryPath`, and `targetPath` before the service is called. There is no directory selector, output destination, arbitrary path, file writer, mirror writer, or package builder.

## Typed IPC and error boundary

- `exports:get-status` is the only implemented Export channel.
- Content readiness blockers are successful DTO data, not IPC failures.
- `no_current_library` and `book_not_found` use recoverable `EXPORT_ERROR`.
- Frozen-structure mismatch, authoritative module-contract damage, and incomplete book-scope instances use non-recoverable `EXPORT_ERROR`.
- Unexpected errors remain the typed router's non-leaking `INTERNAL_ERROR`.
- The DTO has no `exportId`, `latestJobId`, `updatedAt`, output path, or execution metadata.

## Natural product entry

The accepted user path is:

1. Launch the packaged desktop application.
2. Create/open a Library from the normal product entry.
3. Import a source through the Breakdown shelf.
4. Open the resulting Book.
5. Observe the Export readiness panel before freeze.
6. Observe Markdown package as blocked and machine package as unavailable.
7. Inspect `structure_not_frozen`, `export_execution_not_admitted`, unavailable-owner blockers, preview counts, and excluded-content markers.
8. Confirm both `Export unavailable` controls are disabled and have no execution callback.
9. Observe `Export readiness (not a Job)` inside `Jobs & recovery`.
10. Confirm the Job list contains no virtual Export row and SQLite contains zero `kind = 'export'` Jobs.

After structure freeze/unfreeze, the renderer invalidates the same session-and-Book-scoped status query so the panel follows current SQLite facts. It still never becomes executable.

## Task 11.8 no-write certification

The no-write gate uses combined evidence:

- All business-table logical snapshots are equal before and after status calculation.
- SQLite `total_changes()` does not increase.
- `SELECT COUNT(*) FROM jobs WHERE kind = 'export'` remains zero.
- Existing `exports/` directory entries and file hashes remain unchanged.
- Existing `mirrors/` directory entries and file hashes remain unchanged.
- Every Library `.md` and `.json` file hash remains unchanged.

The test deliberately seeds existing export and mirror files. Passing requires preserving them exactly, not assuming the directories are empty.

## Final certification matrix

The fresh Windows certification on 2026-07-16 is:

| Gate | Command or evidence | Result |
| --- | --- | --- |
| Full static/unit/integration/packaged suite | `npm run check` | Passed: TypeScript; 111 unit files / 527 tests; 29 integration files / 256 tests; Windows x64 Forge package; 13/13 packaged Electron E2E tests. |
| Contract truth gate | `tests/unit/shared-export-contract.test.ts` | Passed: target/owner availability separation, authoritative seven-module preview matrix, shared target preview, stable blocker derivation, unavailable owners, and strict sensitive/path exclusion. |
| SQLite no-write gate | `tests/integration/exports/export-status-service.test.ts` | Passed: authoritative module gate, business-table snapshots, `total_changes()`, zero export Jobs, directory-tree hashes, and Markdown/JSON hashes. |
| Typed IPC and security gate | `tests/unit/main-export-ipc.test.ts`, `tests/unit/export-security-boundary.test.ts` | Passed: only `exports:get-status`, extra path rejection, narrow read dependencies, and no sensitive-source access. |
| Natural packaged blocked smoke | `tests/e2e/source-import.spec.ts` | Passed through real Library creation/import/opened Book: target states, blockers, disabled controls, non-Job status summary, and zero export Jobs. |
| Full packaged suite | Playwright through `npm run check` | Passed 13/13. Secondary-display placement is test infrastructure evidence and not a product acceptance blocker. |
| Diff hygiene | `git diff --check` and scoped status review | Passed with no migration, dependency, protected master-plan, generated artifact, or unrelated product feature change. |

## Explicit exclusions and remaining boundaries

- No real Markdown or machine export package exists.
- No file or directory is created, selected, overwritten, mirrored, or deleted by Export status.
- No Markdown or JSON content is written back to SQLite or the Library filesystem.
- No Export record, Export id, Export Job, checkpoint, scheduler, queue, or resume path exists.
- The existing Job type `export` remains contract-only and non-creatable.
- No migration 006 or rewrite of migrations 001–005 is introduced; schema version remains 5.
- No credential, authentication token, secret key, secure-storage value, or full sensitive log enters preview.
- No Codex SDK, AI analysis, generated content, evidence extraction, review workflow, technique adoption, perspective calculation, or completion-gate implementation is admitted.
- No future owner table is inferred or fabricated.
- Block 12 and later capabilities require separate authorization and their own owner/lifecycle decisions.
- Windows x64 packaging is certified. macOS packaging, makers, signing, notarization, and release readiness remain separately unverified.
