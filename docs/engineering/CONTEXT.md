# WriteStorm Engineering Context

日期：2026-07-08  
目的：给后续实现线程提供稳定领域语言、工程边界和当前仓库事实。

## 1. Current Repository State

The repository now contains the first Electron application scaffold plus the Block 1 security and e2e baseline. It is no longer docs-only.

Observed files:

- `package.json`
- `forge.config.ts`
- `src/main`
- `src/preload`
- `src/renderer`
- `src/shared`
- `tests/unit`
- `tests/e2e`
- `docs/product/write-storm-product-design.md`
- `docs/product/FLOWS.md`
- `docs/tasks/TASK-002-v1-work-breakdown-master-plan.md`
- `docs/vibecoding-workflow.md`

Block 1 scaffold/security/e2e baseline has landed and is suitable for total-thread review as an engineering baseline. It should not be described as macOS-ready, remote-CI-ready, release-ready, or as authorization to enter Block 2.

Current Block 1 evidence:

- Windows packaged smoke exists and has launched the packaged Electron app from the real window entry.
- macOS packaged smoke still requires a macOS runner.
- Remote CI is not configured.
- Packaged smoke proves package-and-launch only; it does not prove production distribution readiness.

Block 2 shared contract, product IPC, and preload product API artifacts in the working tree belong to the accepted Block 2 baseline and are not counted as Block 1成果.

Current Block 2 facts:

- Tasks 2.1-2.9 artifacts are present: shared domain IDs/unions/DTOs/errors, Zod contract registry, main typed IPC router, product `NOT_IMPLEMENTED` handlers, and typed `window.writestorm.internal/library/books/structure/modules/jobs/exports` preload API.
- Product IPC calls still return stable `NOT_IMPLEMENTED` envelopes until real services are authorized.
- Task 2.10 boundary gates are part of the accepted Block 2 baseline.
- Total-thread recertification for Block 2 passed `npm run check` before Block 3 authorization.
- SQLite, real LibraryService/BookService, import implementation, AI, and full product UI have not started.

Current Block 3 facts:

- Tasks 3.1-3.8 artifacts are present in shared domain contracts, unit fixtures/tests, and the renderer no-library contract readout.
- The seven ordinary analysis modules are fixed in `ANALYSIS_MODULE_DEFINITIONS`; `AI 约束摘要` is a secondary system page and does not create a normal `AnalysisModuleInstance`.
- `AnalysisModuleInstance` contract aligns with `ModuleInstanceSummary`: instance identity uses `moduleId`, `scope`, `analysisRevision`, and an instance-level summary `status` from `MODULE_INSTANCE_STATUSES`.
- Reviewable assets are separated from module instance state: `ReviewAssetEnvelope` uses `ReviewAssetId`, `sourceModuleInstanceId`, source `AnalysisModuleKey` snapshot, same-scope `scopeRef`, `ReviewAssetStatus`, `EvidencePolicy`, edition/version/revision fields, and timestamps.
- `ReviewAssetStatus` is the canonical asset review state vocabulary for pending/confirmed/rejected/excluded/needs_evidence/stale; it is distinct from `ModuleInstanceStatus`.
- Review asset confirmation uses the asset's own `EvidencePolicy`: only `required_for_confirmation` requires a valid `EvidenceAnchor` before `confirmed`; `not_required` and `optional` are not blocked by the transition contract. Critical conclusions must use `required_for_confirmation`.
- Markdown body remains human-readable text only; evidence, relations, structured objects, technique observations/candidates, AI constraints and review status remain structured assets.
- The renderer no-library entry shows `Analysis module contract readout` sourced from shared domain constants, including the module list, secondary-system-page disabled placeholder, and unsupported scope reasons.
- Latest Block 3 repair verification on 2026-07-08: `npm run check` passed with `typecheck`, `29 unit files / 126 tests`, and Electron e2e `1 passed`.
- Block 3 still does not authorize SQLite, real services, import implementation, AI/Codex SDK calls, real prompts, generated module body, seven-module deep output schema, or ordinary-module treatment of thematic perspectives.

Current Block 4 facts:

- Tasks 4.1-4.8 artifacts are present in shared domain technique contracts, source snapshot contracts, original-reference placeholder contracts, unit fixtures/tests, and the renderer no-library technique-library contract readout.
- Technique assets are three separate layers: `WorkTechniqueObservation` and `ReusableTechniqueCandidate` belong to `BreakdownBook`; `TechniqueEntry` belongs to `TechniqueLibrary`.
- `TechniqueEntry` is not a mutable mirror of the source candidate and must not write back to source observations, source candidates, or source evidence state.
- `SourceSnapshot` stores stable source ids, ISO `capturedAt`, redacted `summary`, redacted `evidenceSummary`, and readonly traceability. Its runtime schema rejects non-ISO `capturedAt`, incomplete redaction envelopes, forbidden content shapes, full original excerpts, original sentences, character names, and proprietary setting fields.
- Reusable technique candidates must contain `reusablePrinciple`, `applicableScope`, `limitations`, and `ProblemSolutionPattern`; pattern fields are deproprietized text envelopes rather than bridge reenactments or source-text strings.
- Evidence chain boundary: breakdown-book observations and candidates may use `EvidenceAnchorId[]`; technique-library entries use `SourceSnapshot`, with evidence summary read from `sourceSnapshot.evidenceSummary`. `EvidenceAnchor` is not a cross-domain mutable fact source for the technique library.
- `TechniqueEntryStatus` is `draft | organized | pending_merge | deprecated`; `pending_merge` is an organization state only and does not trigger or create automatic merge output.
- Technique-library manual primary creation is disabled in V1: empty state copy is `来自已采纳候选`, direct-create primary flow is blocked, and future manual creation requires a new product decision.
- `OriginalReferenceSnapshot` is a placeholder only: future original references may target only confirmed reusable candidates or organized technique entries, store a snapshot, and must not follow source mutations, reference raw evidence, draft entries, unconfirmed AI assets, or create `OriginalBook` data.
- The renderer no-library entry now shows `Technique library contract readout` from shared domain constants, including the accepted-candidate empty-state copy, source-snapshot secondary information position, and disabled manual-primary-action state. It exposes no create/edit/adopt/merge buttons and uses no fake technique data.
- Latest Block 4 closeout verification on 2026-07-08: `npm run check` passed with `typecheck`, `29 unit files / 123 tests`, and Electron e2e `1 passed`.
- Block 4 still does not authorize complete technique library UI, automatic fusion/merge, multi-source publication gates, original citation system implementation, OriginalBook data, SQLite, migrations, real services, import implementation, AI/Codex SDK calls, real prompts, generated prose, or new IPC channels.

## 2. Product Domains

### Breakdown Shelf

V1 primary domain. Owns imported books, source text, structure, story ranges, module instances, jobs, evidence placeholders and review workflow.

### Technique Library

V1 semi-usable domain. Owns `TechniqueEntry` records created from confirmed reusable candidates through future authorized flows. It does not publish gates/prompts in V1, does not expose manual primary creation by default, and does not mutate source breakdown evidence.

### Original Shelf

V1 placeholder only. It may only reserve snapshot-based reference boundaries for future original writing; it must not create original novel projects, `OriginalBook` data, or reuse breakdown evidence/objects as mutable original-project facts.

## 3. Core Domain Objects

| Object | Meaning |
| --- | --- |
| `Library` | User-selected local folder and SQLite database |
| `BreakdownBook` | Imported source project in breakdown shelf |
| `SourceText` | Copied txt/md source file and metadata |
| `StructureNode` | Title tree node: book, volume, chapter |
| `StorySegmentRange` | Cross-chapter story scope; not a title-tree child |
| `AnalysisModule` | Stable module definition |
| `AnalysisModuleInstance` | Module + scope instance that owns body, state, evidence refs and revisions |
| `EvidenceAnchor` | Evidence state and future source reference |
| `Job` | Import, structure, export or future AI task |
| `Revision` | Body or structured-asset version record |
| `WorkTechniqueObservation` | Breakdown-book technique observation that references evidence anchors |
| `ReusableTechniqueCandidate` | Breakdown-book reusable technique candidate with deproprietized principle/scope/limits/pattern |
| `SourceSnapshot` | Readonly redacted source trace copied into a technique-library asset |
| `TechniqueEntry` | Technique-library item copied/derived from confirmed candidate |
| `OriginalReferenceSnapshot` | Placeholder snapshot contract for future original references, not OriginalBook data |

## 4. Stable Technical Language

- Main fact source: SQLite.
- Derived artifacts: JSON exports, Markdown exports, optional mirrors.
- Renderer: React UI with no privileged APIs.
- Main process: Electron privileged process, service host and IPC router.
- Preload: typed bridge only.
- Utility/worker process: large file work and future Codex execution boundary.
- Codex SDK: only V1 AI integration surface.
- Codex SDK spike: gate before real AI breakdown implementation.
- `codex exec`, app-server, GUI automation, API Key, local model and other providers: not V1 fallback paths.

## 5. Mandatory Boundaries

- Do not merge breakdown shelf, technique library and original shelf.
- Do not make `StorySegmentRange` part of the title tree.
- Do not store per-book analysis output on `AnalysisModule`; use `AnalysisModuleInstance`.
- Do not let Markdown or JSON mirrors become authoritative.
- Do not expose fs, SQLite, shell, child process or Codex SDK APIs to renderer.
- Do not implement real AI analysis before Codex SDK spike passes.
- Do not claim Web support.
- Do not merge observations, reusable candidates and technique-library entries into one object.
- Do not let `TechniqueEntry` write back to source candidates or evidence state.
- Do not store full original excerpts, original sentences, character names or proprietary setting body in `SourceSnapshot`, `ReusableTechniqueCandidate`, `ProblemSolutionPattern`, or `TechniqueEntry`.
- Do not treat `EvidenceAnchor` as a cross-domain mutable source of truth for the technique library.
- Do not expose technique-library manual primary creation, automatic merge/fusion, or OriginalBook creation before a new product decision authorizes it.

## 6. First Implementation Path

The V1 implementation path is:

1. Create Electron Forge + Vite + React + TypeScript scaffold. Completed in Block 1.
2. Add strict TypeScript and process-separated source tree. Completed in Block 1.
3. Add shared domain/contracts/errors and main typed IPC bridge. Completed in Block 2.
4. Lock analysis module boundary contracts and expose the contract readout from the desktop entry. Completed in Block 3.
5. Lock technique asset boundary contracts and expose the technique-library contract readout from the desktop entry. Completed in Block 4.
6. Add SQLite connection and migrations. Not started.
7. Implement library create/open. Not started.
8. Implement txt/md import and metadata. Not started.
9. Implement structure/story range shells. Not started.
10. Implement module instance shell. Not started.
11. Implement job state shell. Not started.
12. Implement export blocked state. Not started.

## 7. Validation Expectations

Every implementation task must define exact commands for:

- Type checking.
- Unit or integration tests.
- Build.
- Manual entry-path verification.

The minimum user-visible path to verify is:

1. Fresh start.
2. Create/open library.
3. Open breakdown shelf.
4. Import txt/md.
5. See source metadata.
6. Review structure and story ranges separately.
7. Freeze structure.
8. See module instance shells.
9. See job recovery state.
10. See export blocked reason.

## 8. Source Documents To Read First

Implementation threads should read these in order:

1. `docs/engineering/TECHNICAL_DESIGN.md`
2. `docs/engineering/DECISIONS.md`
3. `docs/product/FLOWS.md`
4. `docs/tasks/TASK-001-breakdown-workbench-foundation.md`
5. `docs/product/write-storm-product-design.md` only when deeper product context is needed.
