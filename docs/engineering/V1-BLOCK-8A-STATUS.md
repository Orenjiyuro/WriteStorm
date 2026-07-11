# WriteStorm V1 Block 8A Status

## Status scope

This file is the authoritative implementation record for Block 8A Detection engine. It does not approve or report completion of Block 8B Review and freeze or Block 8C Invalidation hook.

The master-plan boundary remains:

- **8A Detection engine:** Tasks 8.1-8.10, 8.12, 8.13, and 8.18; local candidate generation, validation, fixtures, and performance evidence.
- **8B Review and freeze:** Tasks 8.11, 8.14, 8.15, and 8.17; draft editing, get/update workflows, freeze/unfreeze, product controls, and the real user journey.
- **8C Invalidation hook:** Task 8.16; downstream stale/needs_rebuild interfaces without a real downstream rerun.

6A/Codex SDK feasibility remains unexecuted and unrecorded. Block 8A uses local deterministic parsing only. Nothing in this status is a Codex SDK Go decision or authorization for AI prompts/runtime, evidence extraction, module bodies, or downstream reruns.

## Numbering reconciliation

8A-0 through 8A-10 are execution-slice labels, not master Task numbers. The internal labels were introduced for review checkpoints and are many-to-many with the master plan.

| Internal execution slice | Delivered capability | Master-plan mapping |
| --- | --- | --- |
| 8A-0 | Forge third Vite entry, packaged `utilityProcess.fork`, typed echo, timeout/crash/quit cleanup | Task 8.5 packaging gate |
| 8A-1 through 8A-4 | Structure contracts, UTF-16 offsets and heading spans, identity/stage model, schema migration, base fixtures | Tasks 8.1-8.4, Task 8.9 foundation, Task 8.12 foundation |
| 8A-5 through 8A-6 | Deterministic multilingual heading and story-range detection, confidence/failure states | Tasks 8.6-8.8 and 8.18 |
| 8A-R1 through 8A-R6 | Review corrections: global identities, honest low-confidence status, Japanese/Setext/fence coverage, separator indexing, story-boundary signals, schema symmetry and detector decomposition | Corrections within Tasks 8.6-8.8 and 8.18 |
| 8A-7 | Pure aggregate validator for hierarchy, offsets, hash, overlap and covered chapters | Task 8.10 |
| 8A-8 | Typed real detection worker command and runner lifecycle: round trip, timeout, crash, cancel | Task 8.5 |
| 8A-9 | DetectionRun/Job and candidate repositories, async StructureService, real `structure:detect` IPC, main/library/quit lifecycle | Tasks 8.1, 8.5 and candidate side of 8.9 |
| 8A-10 | Worker telemetry, deterministic 50 KiB/1 MiB/5 MiB txt/md recorder, packaged renderer heartbeat/click smoke | Task 8.13 |

Master Task 8.10 means Validation. Internal `8A-10` means the performance-recorder execution slice. These labels must not be substituted for each other.

## Master Task status

| Master Task | 8A status | Evidence boundary |
| --- | --- | --- |
| 8.1 | Complete for detection | Detection requires a current imported source and rejects missing, unreadable, escaped-path, changed-hash, or stale snapshots. |
| 8.2 | Complete | StructureNode title tree and StorySegmentRange ranges remain separate aggregates. |
| 8.3 | Complete | Candidate nodes cover book/volume/chapter with global IDs, offsets, heading spans, lineage, and confidence. |
| 8.4 | Complete | Story ranges are independent, non-overlapping ranges and are not title-tree children. |
| 8.5 | Complete for 8A | Renderer sends only a book ID; main reads the source; a packaged utility worker performs detection; Job lifecycle is visible and cancellable. |
| 8.6 | Complete for deterministic V1 rules | Chinese/Japanese/English numbered and Markdown headings produce nodes, offsets, raw heading text, and confidence. |
| 8.7 | Complete for deterministic candidate signals | Separator, blank-line, subheading, length-window, transition and chapter-window evidence can influence candidate boundaries; insufficient evidence returns `no_reliable_story_ranges`. |
| 8.8 | Complete | Low confidence requires review, unusable results do not enter ordinary candidate success, and no reliable chapter produces a stable failure. |
| 8.9 | Candidate side only | Task 8.9 candidate persistence and stage-separation foundation is complete; draft/frozen repository and service transactions remain 8B work. |
| 8.10 | Complete | Pure validation covers hierarchy, offsets, heading slices, source hash/staleness, range overlap, covered chapters, and confidence constraints. |
| 8.12 | Complete | Fixture package covers ordinary, cross-chapter, multilingual, low-confidence and unusable cases. |
| 8.13 | Complete as an observation baseline | Six exact-size packaged fixtures record time/memory and prove the 5 MiB renderer event loop remains responsive. Absolute values are not stable limits yet. |
| 8.18 | Complete for the approved matrix | Chinese chapter/volume, Japanese 話/章, English Chapter/Part, Markdown ATX/Setext, strict fences, and full-/half-width numbering are covered. |

Task 8.9 must not be reported as a complete candidate/draft/frozen user lifecycle. Tests can seed draft/frozen rows to prove schema separation, but no real draft/frozen repository/service transaction is implemented in 8A.

## Hard gates passed

- The Forge package contains a resolvable structure worker bundle and packaged Electron completes typed round trip, timeout, crash, cancellation, and quit cleanup.
- Offsets use decoded UTF-16 code units, end-exclusive ranges, preserved CRLF/LF, and BOM removal after decode.
- Node and story-range persistent IDs are globally unique. Candidate cloning/future draft lineage does not reuse historical IDs.
- Frozen story ranges will reject containment and partial overlap; adjacency and gaps are allowed.
- Unresolved low-confidence items cannot masquerade as ready/frozen output; unusable items cannot enter ordinary candidate success.
- DetectionRun references a real visible Job. Detection failure preserves the successful source import.
- `structure:detect` retains its locked channel identity and returns a queued Job/run immediately; background completion is observed through persisted state.
- `startDetection` is the only public detection execution entrypoint. It registers active work before execution, so duplicate detection, cancelAll, library-session barriers, and app-quit barriers share one lifecycle.
- Cancellation order is `markCancelled -> persist run=failed and Job=cancelled -> AbortController.abort`. The shared policy constant and executable service test assert this order.
- Packaged 5 MiB txt/md runs keep renderer animation frames alive and acknowledge a button event while detection is pending.

## Renderer smoke scope

The performance button is an event-loop probe, not a product Detect structure button. It proves the 8A technical non-blocking gate: the packaged renderer can animate and dispatch a button event while the real preload `structure:detect` request and background Job execute.

It does not prove discoverability, product loading/Job presentation, retry UX, or repeat-operation behavior of a real Generate structure candidate control. Those controls and the import -> candidate -> correct/confirm -> freeze journey belong to 8B; Task 8.17 remains 8B work.

## Persistence boundary

- SQLite is the transactional source of truth for DetectionRun, Job, and current candidate records.
- Candidate replacement does not overwrite current draft or frozen records.
- Schema can represent candidate/draft/frozen and enforce one current set per book/stage.
- Only candidate repository/service transactions are implemented in 8A.
- Draft creation, draft revision commands, frozen edition transactions, unfreeze cloning, and ScopeRef use of frozen IDs remain 8B.

## Known limitations

- Structure detection reasons are exhaustively mapped through the shared recovery-disposition taxonomy. The current `STRUCTURE_ERROR` wire envelope is retained only for compatibility; the foundation reset owns any future error-code split.
- Story-range output is a deterministic heuristic suggestion and may return `needs_manual_review` or `no_reliable_story_ranges`; no narrative-arc AI inference exists.
- Structure detection has no product review UI in 8A.
- Performance numbers currently represent one packaged Windows x64 observation. The 10-second and 512-MiB lines are observation-only advisories, not regression failure thresholds.
- Worker performance telemetry is internal protocol v2 data; it is not product IPC and is not persisted as structure truth.
- macOS packaged performance evidence has not been recorded in this workspace.
- No 8C downstream invalidation implementation or real rerun exists.

## Reproduction

Focused correctness and type verification:

```powershell
npx vitest run tests/unit/shared-structure-contracts.test.ts tests/integration/structure/structure-service.test.ts tests/unit/structure-validator.test.ts tests/unit/structure-worker-runner.test.ts tests/unit/structure-performance-recorder.test.ts tests/unit/structure-performance-fixtures.test.ts tests/unit/block8a-docs.test.ts
npm run typecheck
```

Packaging and worker lifecycle:

```powershell
npm run build
npx playwright test tests/e2e/structure-worker-probe.spec.ts
```

Packaged performance and renderer event-loop evidence:

```powershell
npx playwright test tests/e2e/structure-performance-recorder.spec.ts
```

Run the performance recorder last or copy its artifact first: a later separate Playwright invocation clears the default `test-results` directory. The machine-readable observation is written to `test-results/structure-performance/baseline.json`; durable interpretation is recorded in `docs/engineering/V1-BLOCK-8-PERFORMANCE-BASELINE.md`.

Do not use `npm run check` merely to repeat already equivalent evidence. Run it only when a final integration gate needs new full-suite information.
