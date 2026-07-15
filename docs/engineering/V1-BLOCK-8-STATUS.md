# WriteStorm V1 Block 8 Status

## Current verdict

**Block 8 is complete within the recorded Windows V1 boundary.** A later independent review found three aggregate state-machine gaps after the earlier Windows certification. Manual draft authorization, monotonic replacement lineage, and persistent monotonic detection-run ordering were repaired and focused-tested; the complete matrix was rerun successfully on 2026-07-15. This record does not authorize AI runtime, evidence extraction, module body generation, a real downstream rerun, or Block 9 implementation.

Previously closed review findings remain protected by focused and packaged evidence: stale-candidate/manual fallback, stale low-confidence read-only controls, destructive story-range skip confirmation, and both packaged source-change recovery paths are now tested.

`V1-BLOCK-8A-STATUS.md` remains the historical authority for the reset-era 8A reattachment and protected detection evidence. This file records the later 8B/8C implementation boundary without rewriting that history.

## Master Task 8.1-8.18 reconciliation

Every master Task has an implementation checkpoint and focused evidence within the platform boundaries recorded below. Together with the final certification matrix, these rows establish Block 8 completion on the recorded Windows boundary.

| Master Task | Implementation status | Evidence boundary |
| --- | --- | --- |
| 8.1 | Implemented | Detection and workspace operations require an existing Book/current source; unknown Book returns stable `book_not_found`, while known-source failures remain readable stale workspaces. |
| 8.2 | Implemented | Title-tree nodes and story segment ranges remain separate aggregate members. |
| 8.3 | Implemented | Book/volume/chapter nodes have global identity, hierarchy, UTF-16 spans, heading metadata, confidence, and lineage. |
| 8.4 | Implemented | Story ranges are independent scopes with ordered chapter coverage, geometry, evidence, tags, confidence, and global identity. |
| 8.5 | Implemented | Main reads the source and a packaged utility worker performs deterministic detection without blocking renderer IPC. |
| 8.6 | Implemented | Deterministic multilingual and Markdown heading rules produce nodes, offsets, raw headings, and confidence. |
| 8.7 | Implemented | Story-range candidate rules and atomic review geometry support legal cross-chapter corrections. |
| 8.8 | Implemented | High/medium/low/unusable semantics, stable failure, Retry/Recover, and manual-draft fallback are available. |
| 8.9 | Implemented | Candidate/draft/frozen persistence is separated; clone/unfreeze use globally new IDs and explicit lineage; historical aggregates remain resolvable. |
| 8.10 | Implemented | Pure validation and repository blockers protect hierarchy, spans, coverage, overlap, confidence, source freshness, and freeze readiness. |
| 8.11 | Implemented | Product review UI exposes candidate confidence, strict node/range correction, low-confidence acceptance, and explicit story-range skip. |
| 8.12 | Implemented | Deterministic fixtures cover ordinary, cross-chapter, multilingual, low-confidence, unusable, and exact-size inputs. |
| 8.13 | Implemented as Windows observation baseline | Packaged 50 KiB/1 MiB/5 MiB txt/md telemetry and renderer responsiveness are recorded; values are not cross-platform regression limits. |
| 8.14 | Implemented | `structure:get` returns aggregate summaries/capabilities only; strict revision-guarded commands, discard, recovery, and stable blockers own updates. |
| 8.15 | Implemented | Freeze is an aggregate transaction with positive Book edition and real Job/checkpoint; unfreeze clones from current frozen while frozen lineage remains current. |
| 8.16 | Implemented | The synchronous DB-only edition-change port emits downstream invalidation instructions and rolls the complete freeze transaction back on failure. |
| 8.17 | Implemented on packaged Windows path | Native-dialog-stub journeys cover import through candidate/draft/freeze/reopen, failure/manual fallback, revision conflict, stale state, and orphan recovery/retry. |
| 8.18 | Implemented | Chinese, Japanese, English, Markdown, full-/half-width and failure/manual-review fixtures protect deterministic multilingual behavior. |

## Final certification matrix

The latest worktree passed this final matrix on 2026-07-15:

| Gate | Command or observable evidence | Result |
| --- | --- | --- |
| Full static/unit/integration/packaged suite | `npm run check` | Passed: TypeScript; 90 unit files / 393 tests; 22 integration files / 202 tests; Windows x64 Forge package; 11/11 serial packaged Electron tests. |
| 8A preservation | Compare the 19 files against the SHA-256 manifest in ADR 0001 | Passed: 19/19 hashes match; no pure detection rewrite is hidden in 8B/8C. |
| Block 8 packaged journeys | `tests/e2e/source-import.spec.ts`, worker probe, performance recorder | Passed through the natural main-process dialog stub: candidate/draft/freeze/reopen, revision conflict, stale state, retry/manual fallback, orphan recovery, worker lifecycle, and performance observation. |
| Migration/runtime fixture | Full integration suite and SQLite 3.53.2 fixture checks | Passed: migration 002, nullable/positive Book edition, constraints, application id `1465078861`, and schema epoch 2 agree. |
| Diff hygiene | `git diff --check`, status review, targeted diff inspection | Passed; no whitespace error, accidental generated file, unrelated scope expansion, or hidden downstream runtime table was found. |
| Visual evidence | Inspect current packaged screenshots | Passed: candidate, editable draft, revision conflict, stale read-only draft, frozen after restart, manual fallback/freeze, and orphan recovery are visible. |

The matrix above is the current completion evidence after the later review remediations. macOS, makers, signing, notarization, and release readiness remain separate unverified boundaries.

## 8C Task 8.16 checkpoint

`StructureEditionChangePort` is the downstream invalidation seam. It is called only by a successful structure freeze, inside the same `LibraryUnitOfWork.write` transaction after the new positive Book structure edition, structure-edition Job, and completion checkpoint have been written.

The port contract is synchronous and DB-only:

- it returns `undefined`; async/Promise implementations fail the type gate;
- it receives the transaction's SQLite connection and performs no worker, network, filesystem, or other I/O;
- throwing rolls back the frozen set, Book structure edition, Job, checkpoint, and any adapter writes;
- the default adapter is a no-op because reset migration 001/002 admits no downstream runtime-owner tables.

The change payload carries the previous nullable edition, new positive edition, frozen set identity, and these affected-state instructions:

| Future consumer | Instruction |
| --- | --- |
| `AnalysisModuleInstance` | `needs_rebuild` |
| Evidence / `ReviewAsset` | `stale` |
| Perspective | `needs_refresh` |
| CompletionGate | `invalidate_for_future_owner`, `persisted: false` |

CompletionGate has no V1 runtime owner in the admitted schema. The payload is a future-consumer invalidation instruction only; 8C does not persist or claim a CompletionGate state transition.

Create draft, edit draft, unfreeze, and discard draft do not call the port. First freeze and replacement-edition freeze each call it exactly once. No downstream recomputation is started.

## 8C verification

Focused evidence:

```powershell
npx vitest run tests/unit/structure-edition-change-port.test.ts tests/integration/structure/structure-service.test.ts tests/unit/block8-docs.test.ts
npm run typecheck
git diff --check
```

The focused tests protect synchronous typing, the four instruction vocabularies, first/replacement freeze call counts, visibility of the new Book edition inside the transaction, non-freeze zero-call behavior, default no-op behavior, and complete rollback when the port throws.

## Explicit exclusions and remaining boundaries

- No real `AnalysisModuleInstance`, ReviewAsset/Evidence, Perspective, or CompletionGate persistence adapter exists in Block 8 because their runtime-owner tables have not been admitted after the foundation reset.
- No module body, evidence extraction, AI prompt/runtime, real analysis execution, downstream rerun, or Block 9 product surface is implemented here.
- Windows packaged Block 8 journeys are certified; macOS packaging/performance, makers, signing, notarization, and release remain unverified.
- Performance numbers remain observation-only and are not stable cross-machine or cross-platform regression thresholds.
- No current Block 8 completion blocker remains within the recorded Windows V1 boundary; timestamp/UUID latest-run ordering has been removed.
- The packaged source-change tests establish a later SourceText edition as fixture state between app launches because V1 has no existing-Book source-replace product command. Detect, replacement/manual draft creation, editing, and freeze are exercised only through the packaged UI; the fixture setup is not claimed as a user-facing source-replace workflow.
