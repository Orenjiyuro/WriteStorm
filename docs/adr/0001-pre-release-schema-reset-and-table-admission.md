# ADR 0001: Pre-release schema reset and production table admission

Date: 2026-07-11
Status: Accepted for the V1 foundation reset

## Context

WriteStorm has no real user library that requires compatibility or migration. The migrations created during Blocks 1-7 describe development task history and include speculative shell tables whose owner modules do not yet have complete read/write paths. Block 7 already persists import Jobs, while the current uncommitted Block 8 work contains reusable pure detection, validation, fixtures, and worker-protocol assets alongside persistence and IPC wiring that depends on the old foundation.

## Decision

- Perform a **pre-release schema reset** and set `schemaEpoch = 2`. Existing development SQLite libraries are incompatible and must return `DEV_SCHEMA_RESET_REQUIRED`; they are not migrated in place.
- Apply the **production table admission** rule. A table enters the production schema only when its domain identity, owner, and lifecycle are frozen; real write and read paths exist; a stable error model exists; and integration tests protect its invariants. Shared contracts or renderer readouts alone do not qualify.
- Begin the new baseline at `001_v1_runtime_baseline`. It admits only `library`, `books`, `source_texts`, `jobs`, and `job_checkpoints` in addition to `schema_migrations`. Speculative shell tables are not created.
- Keep the canonical immutable source path at `source/{sourceTextId}/{originalFileName}`.
- Freeze the minimum complete Job and JobCheckpoint core now because Block 7 already has a real import Job write path. Job transitions belong to JobService, not IPC adapters or repositories.
- Before the first external alpha or release tag, unpublished migration sources may be reset as a unit. After that publication boundary, **published migrations are immutable** and schema evolution is forward-only with a pre-migration snapshot.
- Pause Block 8 migration, persistence, Job wiring, and IPC wiring until Task 19 reconnects them through the new foundation. Preserve the pure detection, confidence, validation, fixture, performance-fixture, and detection worker-protocol assets listed below.

## Consequences

- Old development libraries require explicit deletion and recreation; no real user data is discarded by this decision.
- Migration history represents released compatibility, not task completion history.
- Production schema growth requires an owning runtime module and verifiable behavior.
- The Block 8 pure logic remains reusable, but Block 8 is not complete and its persistence path must not bypass LibraryUnitOfWork, JobService, or SourceTextService.
- macOS packaged smoke and release-maker gates remain blocked/not verified until executed in their required environments.

## Block 8 preservation manifest

The following SHA-256 values were recorded in the isolated Task 1 worktree before foundation implementation. Task 19 must compare these byte hashes before and after persistence reattachment, or explain every intentional change with a behavioral test and review note.

| Preserved file | SHA-256 |
| --- | --- |
| `src/main/structure/detection/heading-patterns.ts` | `59f409933e35d8c99d8043a0ff3b54e85feb54d8388302521c3bafecefea1e16` |
| `src/main/structure/detection/line-scanner.ts` | `bf56f9047f5542c0c71887fdbd59a1d573db1adbf28fac888bb2aec496b6e131` |
| `src/main/structure/detection/markdown-syntax-index.ts` | `d72c35bb0bd526fe7b4703b7535150af95555b35fb885533e494167b9b1ed173` |
| `src/main/structure/detection/separator-index.ts` | `c0a451f70944a658145556a915380c9b40e63ca2adc7317408b1ec490543717a` |
| `src/main/structure/detection/story-boundary-signal-index.ts` | `e073d6e7d3ebd2ac4d09e7b5698f2572161d753370a6ab6c860b1e4a9c1759f7` |
| `src/main/structure/detection/story-range-detector.ts` | `ceb38fd070cd1658c6563033b5302bc5b1f46f450d037a11a5de439535188322` |
| `src/main/structure/detection/structure-candidate-id-factory.ts` | `2c82a6cc4e6d8a9bf1bd7e13b0e102487ae4c0a7e36d903cd78f994e4f0eb795` |
| `src/main/structure/detection/structure-confidence.ts` | `8fd0f5661bed6bc15b12e5a07ebcfbe893d6f50df528efa7ce35157602355308` |
| `src/main/structure/detection/structure-detector.ts` | `a9116973acd5262edd798cbcad222dfa1ab356206ce134ea7581502c9509c7eb` |
| `src/main/structure/detection/structure-heading-classifier.ts` | `95e5f06b9530fa864b2045815b9d2ecf7dba9f625892b9c5c55e7da9ec6868e4` |
| `src/main/structure/detection/structure-heading-number-parser.ts` | `fe322f551673579afdf6bb3907282237ae506b648191f287ab93d5f4de0df1bd` |
| `src/main/structure/detection/structure-heading-scanner.ts` | `2534326b8d23e3edf5dab67d15a825c896732029e41bf8dcbf94641ce41c773b` |
| `src/main/structure/detection/structure-tree-builder.ts` | `9a5930ee2938d64d352ad404bbe0ee30ad16782f7e84656585e6605b6f2311b6` |
| `src/main/structure/performance/structure-performance-fixtures.ts` | `8be82cdbe91f3535d5f523b8da60ea700cef2b6abc2797d4f404c0d78358b157` |
| `src/main/structure/validation/structure-validator.ts` | `2e73971cf2da153707fc2d74d42637f933d09a4ee8e3262ef72dffb9f2efaa04` |
| `src/main/structure/worker/structure-worker-detection.ts` | `c70c6184bb204b482cdcd286d13f278b37ae907e97f35b1df68a7d7016c92941` |
| `src/main/structure/worker/structure-worker-protocol.ts` | `3080df3b5aab96ef5be8e199862916fa9d428079e2ea7d5c10b57e387f40cca8` |
| `tests/fixtures/structure/line-scanner-fixtures.ts` | `40bb473adf4784a738ed1f07e33bd4afbf15d1d213798662bcee83701c8ff6f1` |
| `tests/fixtures/structure/structure-detection-fixtures.ts` | `7f15cf27183053f656ed99d2d9bc47c1e7332811945df6495a384af132cec147` |
