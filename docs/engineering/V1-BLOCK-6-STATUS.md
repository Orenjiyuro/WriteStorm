# WriteStorm V1 Block 6 Native Gate And Library Entry Status

Date: 2026-07-09

Status: Windows native gate verified; Task 6.4/6.5 production schema migrations verified; Task 6.12 desktop entry skeleton verified; Task 6.13 SQLite/migration performance baseline verified; release maker and macOS smoke still blocked/not applicable

Scope: historical Block 6 delivery plus the Task 20 recertification override. The unpublished content-model shell migrations were removed; the current runtime baseline is schema epoch 2 with migrations 001/002. LibraryService now probes before writes, backs up pending migrations from a readonly source, validates resulting schema, and publishes session-bound services/UoW. Windows package gates apply; this is not a macOS packaged-smoke or release-maker pass.

## Authorized Scope

- In scope: Task 6.1, Task 6.2, Task 6.3, Task 6.4, Task 6.5, Task 6.6, Task 6.7, Task 6.8, Task 6.10, Task 6.11, Task 6.12, Task 6.13, plus local CI integration-test hard gate.
- Out of scope: source import, book services, AI/Codex, analysis workbench, technique-library UI, perspective computation, relation generation, evidence mutation flows, and full product workbench behavior.

## Dependency Baseline

- `better-sqlite3`: `12.11.1` production dependency for main/service SQLite access.
- Type declarations: `@types/better-sqlite3` `7.6.13`.
- Local Node observed before implementation: `v24.14.1`.
- Local npm observed before implementation: `11.12.1`.

## Manifest And SQLite Authority

- Manifest contract uses `manifestVersion`.
- `schemaVersionHint` is allowed only as non-authoritative diagnostic metadata.
- SQLite `schema_migrations` is the authoritative schema-version source.
- SQLite `library` row is the authoritative library identity source for id, name and app version after create.
- `manifest.json` must not store books, source texts, analysis module instances, technique entries, perspective views, or other business facts.

## Migration Registry

- Migration registry must be statically bundled through `src/main/db/migrations/index.ts`.
- Runtime globbing, directory scanning, and dynamic migration imports are not allowed.
- Migration registry tests must cover duplicate ids, non-positive ids, ascending order, ordered execution, and rollback on failure.
- Migration runner validates applied migration history before pending migrations run. Unknown future migrations and id/name mismatches reject open instead of allowing an older app to continue on an unknown schema.
- non-contiguous applied migration histories reject open; applied migration rows must be a contiguous prefix of the static registry.

## App Schema Evidence

- Task 6.4 Foundation Schema: implemented in production migration `src/main/db/migrations/001_foundation_schema.ts`.
- Task 6.4 creates `library`, `books`, `source_texts`, `structure_nodes`, `story_segment_ranges`, `jobs`, and `exports`.
- Historical Task 6.5 speculative content-model migration: superseded and deleted by the global reset; it is not part of the current production registry.
- Task 6.5 creates `analysis_modules`, `analysis_module_instances`, `evidence_anchors`, `relation_links`, `work_technique_observations`, `reusable_technique_candidates`, `source_snapshots`, `technique_entries`, and `perspective_views`.
- schema version 2 is now the current app schema version after running `APP_MIGRATIONS`.
- `tests/integration/db/app-schema.test.ts` introspects tables, columns, and foreign keys for Task 6.4/6.5.
- `books.current_source_text_id` FK points to `source_texts(id)` so a book cannot reference a nonexistent current source text.
- `npm run test:integration`: passed on 2026-07-09 after Task 6.4/6.5 review fixes with 4 files / 17 tests.
- `npm run check`: passed on 2026-07-09 after Task 6.4/6.5; package again reported `Preparing native dependencies: 1 / 1`.
- TechniqueEntry and ReusableTechniqueCandidate remain separate tables. `technique_entries` point to `source_snapshots` and do not FK to `reusable_technique_candidates`.
- `perspective_views` is independent from `analysis_module_instances`: it has no `module_id`, no `analysis_module_instance_id`, and no FK to `analysis_module_instances`.
- `relation_links` and `evidence_anchors` are independent shell tables; perspectives do not own or generate either table.
- These schema migrations do not implement source import, BookService queries, real analysis, technique-library UI, perspective computation, AI/Codex, or additional IPC channels.

## Native Rebuild And Packaging Evidence

- `npm run typecheck`: passed on 2026-07-09 after native-gate implementation.
- `npm run test:unit -- tests/unit/block6-native-boundary.test.ts tests/unit/scaffold-boundaries.test.ts`: passed on 2026-07-09.
- `npm run test:integration -- tests/integration/db/migration-runner.test.ts`: passed on 2026-07-09.
- `npm run build`: passed on 2026-07-09 after VS 2022 Build Tools were installed. Forge completed package creation for win32 x64 and reported `Preparing native dependencies: 1 / 1`.
- Packaged native SQLite smoke: passed on 2026-07-09. `npx playwright test tests/e2e/native-sqlite-probe.spec.ts` launched the packaged Electron app, loaded `better-sqlite3`, opened SQLite, runs a test-only migration, closes and reopens the database, verifies reopened schema version readback, and passed with `1 passed`.
- `npm run check`: passed on 2026-07-09 after Task 6.4/6.5 review fixes. The command ran `typecheck`, `test:unit`, `test:integration`, and `test:e2e`; unit passed with 46 files / 181 tests, integration passed with 4 files / 17 tests, and packaged Electron e2e passed with 3 tests.
- `npm run package`: covered through the passing `npm run build` package step.
- `npx playwright test tests/e2e/empty-state.spec.ts`: passed through `npm run check` packaged e2e after native runtime dependencies were copied and rebuilt.
- `npx playwright test tests/e2e/native-sqlite-probe.spec.ts`: passed both as a targeted smoke and through `npm run check`.
- `npm run make`: release/maker strategy blocked-or-not-applicable on 2026-07-09. The command still fails at target resolution with `Could not find any make targets configured for the "win32" platform.` Current `forge.config.ts` still has `makers: []`; this must not be reported as a passing make/release validation.
- macOS packaged SQLite smoke: blocked-by-platform on this Windows environment until a macOS runner executes the packaged smoke.

## LibraryService Evidence

- Task 6.10 path guard: implemented in `src/main/library/path-guard.ts` with tests covering traversal, absolute child input, same-prefix sibling escape, and symlink/junction escape outside the library root.
- Task 6.11 LibraryService: implemented in `src/main/library/library-service.ts`. `create`, `open`, `getCurrent`, and `closeCurrent` are service-layer APIs only; they create/open the folder layout, validate the manifest, open SQLite, run migrations, set current context, and return `LibrarySummary`.
- Opening an existing library requires `writestorm.sqlite` to already exist. `LibraryService.open` refuses manifest-only libraries and does not recreate a missing authoritative database.
- Library summaries are read from SQLite `library`, not manifest identity fields. Mutating manifest id/name/appVersion after create must not change `LibraryService.open` output.
- Full folder contract directories are checked on open: source, exports, logs, cache, and mirrors must exist and be directories.
- Creating a library requires an absent or empty root. `LibraryService.create` is the only flow allowed to create `writestorm.sqlite`; it refuses non-empty roots and existing database artifacts instead of adopting them, and it cleans partial create artifacts after setup or migration failure.
- Migration runner validates applied migration history before open completes. Unknown future migrations and id/name mismatches reject open.
- Expected LibraryService failures map to `LIBRARY_ERROR` over IPC with stable `reason` details instead of collapsing to generic `INTERNAL_ERROR`, including `database_open_failed` when SQLite cannot open `writestorm.sqlite`.
- `tests/integration/library/library-service.test.ts` covers SQLite `library` row authority over manifest identity fields, missing database on open, folder-contract directory damage, SQLite open failures, non-empty/create-over-existing guards, and partial create cleanup after migration failure.
- Task 6.11 library IPC: `registerProductIpc` can receive main-side `LibraryIpcDependencies` for `library:create`, `library:open`, and `library:get-current`. The renderer request schema remains empty, so renderer code cannot pass root paths. Non-library product channels remain stable `NOT_IMPLEMENTED`.
- Task 6.11 verification on 2026-07-09: targeted unit passed with 45 files / 177 tests; targeted integration passed with 2 files / 6 tests.
- Task 6.11 full local gate on 2026-07-09: `npm run check` passed. Typecheck passed; unit passed with 45 files / 177 tests; integration passed with 2 files / 6 tests; packaged Electron e2e passed with 2 tests, including native SQLite probe.

## Desktop Entry Evidence

- Task 6.12 desktop entry skeleton: implemented in `src/main/main.ts`, `src/main/library/library-entry.ts`, `src/renderer/App.tsx`, and `src/renderer/styles/app.css`.
- The renderer no-library entry exposes only `Create library` and `Open library` as product actions. It calls typed preload `library:create/open/get-current` and switches to an empty Breakdown shelf from the returned `LibrarySummary`.
- Directory selection remains in the main process. Production uses Electron directory dialogs; packaged e2e may set `WRITESTORM_E2E_LIBRARY_DIALOG_STUB=1`, `WRITESTORM_E2E_LIBRARY_ROOT`, and optional `WRITESTORM_E2E_LIBRARY_NAME`. The stub is not exposed through preload or renderer APIs, and renderer still cannot submit arbitrary filesystem paths.
- `tests/unit/main-library-entry.test.ts`: verifies the env-gated e2e dialog stub does not call the system dialog and that ordinary create/open falls back to system directory dialogs.
- `tests/e2e/library-entry.spec.ts`: packaged Electron smoke creates a library from the desktop entry, verifies `manifest.json`, `writestorm.sqlite`, production schema version 2, relaunches, opens the same library, and reaches the empty Breakdown shelf.
- `tests/e2e/empty-state.spec.ts`: packaged Electron smoke keeps no-library contract readouts visible, allows only the two library entry buttons, and verifies non-library product channels still return stable `NOT_IMPLEMENTED`.
- Task 6.12 full local gate on 2026-07-09: `npm run check` passed. Typecheck passed; unit passed with 46 files / 179 tests; integration passed with 2 files / 6 tests; packaged Electron e2e passed with 3 tests, including native SQLite probe and library-entry create/open smoke.

## Performance Baseline Evidence

- Task 6.13 SQLite/migration performance baseline: implemented in `src/main/library/performance-baseline.ts` and verified by `tests/integration/library/library-performance-baseline.test.ts`.
- Scope: the baseline uses test-only migrations and a `block6_performance_items` probe table. It remains separate from the production Task 6.4/6.5 schema and does not add BookService queries, source import, AI, or renderer behavior.
- Current Task 20 fixtures use 25 and 1,000 probe rows; both exercise the canonical schema version 2 registry.
- Task 20 Windows observation on 2026-07-14: small create/open/migration/query = 78.04/43.86/22.46/1.11 ms; medium = 66.21/43.61/22.07/0.78 ms. Both remained under the existing observation limits. These are local observations, not release promises.
- Task 20 full Windows recertification passed: typecheck, 86 files / 366 unit tests, 21 files / 133 integration tests, package/build, and 7/7 packaged Electron e2e tests.
- Summary query: reads only the probe row count and SQLite `schema_migrations` version. This is the authorized substitute until foundation/book summary tables are approved.
- Observed local Windows evidence on 2026-07-09: small fixture: create 25.23 ms, open 15.18 ms, migration 8.40 ms, summary query 0.71 ms. medium fixture: create 25.11 ms, open 11.59 ms, migration 8.40 ms, summary query 0.72 ms.
- Non-regression limits: small create <= 750 ms, open <= 250 ms, migration <= 500 ms, summary query <= 50 ms; medium create <= 2,000 ms, open <= 500 ms, migration <= 1,500 ms, summary query <= 100 ms.

## Review Fix Evidence

- `npm run typecheck`: passed on 2026-07-09 after Task 6.4/6.5 review fixes.
- `npm run test:unit -- tests/unit/main-library-ipc.test.ts tests/unit/block6-docs.test.ts`: passed on 2026-07-09 with 46 files / 181 tests.
- `npm run test:integration -- tests/integration/library/library-service.test.ts tests/integration/db/migration-runner.test.ts tests/integration/db/app-schema.test.ts tests/integration/library/library-performance-baseline.test.ts`: passed on 2026-07-09 with 4 files / 17 tests.
- `npm run build`: passed on 2026-07-09 after Task 6.4/6.5 review fixes. Forge package again reported `Preparing native dependencies: 1 / 1`.
- `npx playwright test tests/e2e/native-sqlite-probe.spec.ts`: passed on 2026-07-09 and covers the packaged main process loading `better-sqlite3`, running the test-only migration, and reading reopened schema version `1`.
- `npx playwright test tests/e2e/library-entry.spec.ts`: passed on 2026-07-09 and covers packaged create/open plus production schema version 2 readback from `writestorm.sqlite`.

## Current Blockers And Notes

- Historical Windows native rebuild blocker: node-gyp saw `C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools`, reported it as unsupported/unknown, and failed with `Could not find any Visual Studio installation to use`.
- Additional environment diagnosis before resolution on 2026-07-09: the local install was Visual Studio Build Tools 2026 / VS 18.4.3 at `C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools`; `VC\Tools\MSVC\14.50.35717`, `MSBuild\Current\Bin\MSBuild.exe`, and `VC\Auxiliary\Build\vcvarsall.bat` existed. `cl.exe`, `msbuild.exe`, and `vswhere.exe` were not on the default PATH, but `vswhere.exe` existed under the Visual Studio Installer directory.
- Root cause refinement: Forge 7.11.2 uses `@electron/rebuild` 3.7.2, which invokes `@electron/node-gyp` `10.2.0-electron.1`. Its Visual Studio finder maps only major 15/16/17 to VS 2017/2019/2022 and searches the 2019/2022 support set for modern Node/Electron builds, so the installed VS 18 toolchain is not accepted even when the files are present.
- `GYP_MSVS_VERSION` or a Developer Command Prompt is not a sufficient documented fix for this repo while the rebuild chain still rejects VS 18 as unsupported. The likely unlock is either installing/exposing a node-gyp-supported VS 2022 Build Tools toolchain, or making an explicit dependency-strategy decision to upgrade/override the Electron rebuild chain to a version that supports VS 18 and then revalidating package smoke.
- Total-thread decision on 2026-07-09: use scheme A. Install or expose VS 2022 Build Tools supported by the current Electron rebuild/node-gyp chain. Do not override or upgrade `@electron/rebuild` or node-gyp unless scheme A is infeasible, or unless native rebuild still fails after VS 2022 is in place.
- VS 2022 availability after scheme A on 2026-07-09: `winget install --id Microsoft.VisualStudio.2022.BuildTools --exact --silent --accept-package-agreements --accept-source-agreements --override "--wait --quiet --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"` completed successfully. `vswhere -version [17.0,18.0) -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -format json` now reports Visual Studio Build Tools 2022 version `17.14.37411.7` at `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools`.
- macOS packaged SQLite smoke is not runnable on the current Windows machine.
- `makers: []` means `npm run make` may not provide a meaningful installer/distribution artifact until the total thread chooses maker/distribution policy.
