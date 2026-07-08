# TASK-001: Breakdown Workbench Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` or equivalent task-by-task execution discipline. This task is the first implementation slice for the “拆解工作台优先” route. Do not expand into AI analysis, original novel creation, or full technique-library fusion.

**Goal:** Build the first usable Breakdown Workbench foundation: local library entry, breakdown shelf, txt/md import, structure review shell, `StorySegmentRange` review shell, `AnalysisModuleInstance` shell, job state shell and basic export entry.

**Architecture:** Product-first vertical slice on Electron + React + TypeScript with SQLite as the main fact source. The app should let a writer reach the breakdown workbench with one imported source text and see stable objects that future Codex SDK analysis can write into. The first slice proves object boundaries and user path before work expands into real AI, Codex SDK auth or full module generation.

**Tech Stack:** Electron Forge + Vite + React + TypeScript, SQLite main store, typed IPC between renderer and privileged main/utility services. Implementation must first read the repo and create an exact scaffold implementation plan because this repository is currently docs-only.

---

## 1. Scope

### In Scope

- Local library create/open entry.
- Main shelf with clear separation between breakdown shelf, technique library and original shelf.
- Breakdown shelf list and empty state.
- Import `.txt` and `.md` into a local library.
- Source file copy and metadata display: file name, extension, size, detected or selected encoding, hash, import time.
- Structure review shell for `StructureNode`.
- Story segment range review shell for `StorySegmentRange`.
- Structure freeze/unfreeze affordance and invalidation warning.
- Breakdown workbench shell with stable `AnalysisModuleInstance` rows/cards for V1 modules.
- Job state shell for queued, estimating, waiting confirmation, running, paused, failed, resumable, cancelled and completed.
- Basic export entry that can explain why export is unavailable.
- Empty, error and recovery routes listed in `docs/product/FLOWS.md`.

### Out of Scope

- Real Codex SDK implementation.
- Codex SDK compatibility spike execution.
- Real AI analysis output.
- Prompt template editor.
- Module rerun diff implementation.
- Evidence extraction beyond placeholder state display.
- Original novel project creation.
- Full fusion technique library.
- Published gate/prompt output.
- Final visual high-fidelity design.

## 2. Required Product Objects

The implementation plan for this task must preserve these object boundaries:

| Object | Required responsibility in this slice |
| --- | --- |
| `Library` | Local root selected or created by user |
| `BreakdownBook` | Imported source project shown in breakdown shelf |
| `SourceText` | Copied txt/md file and metadata |
| `StructureNode` | Title tree only: book, volume, chapter |
| `StorySegmentRange` | Cross-chapter story range scope, not a child of title tree |
| `AnalysisModule` | Stable V1 module definition |
| `AnalysisModuleInstance` | Module + scope shell with status |
| `Job` | Import, estimation, analysis placeholder, export state |
| `EvidenceAnchor` | Placeholder state only; no real extraction required |

## 3. User Path

1. User opens WriteStorm.
2. If no library exists, user creates or selects a local library.
3. User sees the main shelf.
4. User enters breakdown shelf.
5. If shelf is empty, user sees an import-first empty state.
6. User imports a `.txt` or `.md` file.
7. App copies the source file and records metadata.
8. User sees structure review with title tree and story segment range areas.
9. User can adjust or accept the detected structure shell.
10. User freezes the structure.
11. User enters breakdown workbench.
12. User sees module instance shells for V1 modules and their statuses.
13. User sees task state and recovery actions if the placeholder job is paused or failed.
14. User sees export entry and unavailable reason until minimum required assets exist.

## 4. Forbidden Moves

- Do not merge original shelf and technique library into breakdown workbench.
- Do not make `StorySegmentRange` a title-tree child.
- Do not store per-book module result on `AnalysisModule`; use `AnalysisModuleInstance`.
- Do not allow free Markdown edits to write structure, evidence, relation or AI constraint fields.
- Do not claim AI analysis is implemented with mock data.
- Do not choose a final tech stack without first closing or explicitly downgrading `TASK-000` gates.
- Do not implement provider login with unofficial browser automation as V1 acceptance.
- Do not hide import, structure or export errors behind generic failure messages.

## 5. Implementation Tasks

### Task 1: Repository and Scaffold Audit

**Files:** Read existing repo files only.

**Steps:**

- [ ] Run `rg --files` to list the repository shape.
- [ ] Identify whether an application scaffold already exists.
- [ ] Identify available package manifests, build scripts, test scripts and existing docs.
- [ ] Produce an implementation plan that names exact files to create or modify.
- [ ] Stop before writing application code unless exact Electron/React/TypeScript scaffold files and verification commands are named.

**Acceptance:**

- The implementer can state whether this repo is docs-only or already has an app scaffold.
- If docs-only, the next task is an Electron Forge + Vite + React + TypeScript scaffold plan, not ad hoc file creation.

### Task 2: Library and Main Shelf Entry

**Files:** Task 1 must produce exact create/modify/test paths before this slice starts. If the repository is still docs-only, first execute the Electron scaffold task defined by the engineering technical design.

**Steps:**

- [ ] Add a first-launch route/state for creating or opening a local library.
- [ ] Add a main shelf route/state.
- [ ] Show breakdown shelf as the primary usable area.
- [ ] Show technique library as V1 semi-usable.
- [ ] Show original shelf as V1 placeholder with no project creation action.
- [ ] Add empty and missing-library states.
- [ ] Verify the user can reach breakdown shelf from a fresh start.

**Acceptance:**

- A fresh user can create/open a library and reach breakdown shelf without preloaded data.
- Original shelf cannot create projects.
- The three domains are visually and behaviorally distinct.

### Task 3: txt/md Import and Source Metadata

**Files:** Task 1 must produce exact create/modify/test paths before this slice starts. If the repository is still docs-only, first execute the Electron scaffold task defined by the engineering technical design.

**Steps:**

- [ ] Add an import action from breakdown shelf.
- [ ] Accept only `.txt` and `.md`.
- [ ] Copy source file into the selected library.
- [ ] Record file name, extension, size, hash, encoding and import time.
- [ ] Handle unsupported file, empty file, encoding failure, duplicate import and copy failure.
- [ ] Show imported book in breakdown shelf.
- [ ] Verify import success and at least three import failure states.

**Acceptance:**

- Import does not depend on AI configuration.
- User can see why a failed import failed and what action is available next.

### Task 4: Structure Review Shell

**Files:** Task 1 must produce exact create/modify/test paths before this slice starts. If the repository is still docs-only, first execute the Electron scaffold task defined by the engineering technical design.

**Steps:**

- [ ] Display a `StructureNode` title tree area.
- [ ] Display a separate `StorySegmentRange` area.
- [ ] Provide manual correction affordances for title levels and story ranges.
- [ ] Add structure confidence or uncertainty display when available.
- [ ] Add freeze/unfreeze action.
- [ ] On unfreeze, show that affected module instances and evidence may become stale.
- [ ] Verify a user can freeze structure and proceed to workbench.

**Acceptance:**

- Title tree and story segment ranges are not represented as one hierarchy.
- Structure freeze is a visible gate before workbench analysis states.

### Task 5: Breakdown Workbench Shell

**Files:** Task 1 must produce exact create/modify/test paths before this slice starts. If the repository is still docs-only, first execute the Electron scaffold task defined by the engineering technical design.

**Steps:**

- [ ] Add stable V1 module list from the product design.
- [ ] Create `AnalysisModuleInstance` shell for at least book scope.
- [ ] Show module instance status: not generated, generated pending review, confirmed, stale, needs rebuild.
- [ ] Show placeholder areas for module body, evidence status, relations and review actions.
- [ ] Add clear disabled state for rerun and diff if AI is not connected.
- [ ] Verify each module instance points to a module and scope.

**Acceptance:**

- The workbench proves the `AnalysisModule + scope` model.
- Users can distinguish missing AI output from broken UI.

### Task 6: Job State and Recovery Shell

**Files:** Task 1 must produce exact create/modify/test paths before this slice starts. If the repository is still docs-only, first execute the Electron scaffold task defined by the engineering technical design.

**Steps:**

- [ ] Add job state display for queued, estimating, waiting user confirmation, running, paused, failed, resumable, cancelled and completed.
- [ ] Add visible failure reason field.
- [ ] Add checkpoint summary field.
- [ ] Add resume, cancel and keep-draft actions where applicable.
- [ ] Verify an interrupted or failed placeholder job shows a recovery path.

**Acceptance:**

- Job state is separate from book state and module instance state.
- Restart/recovery UX has a visible place even before real AI analysis exists.

### Task 7: Basic Export Entry

**Files:** Task 1 must produce exact create/modify/test paths before this slice starts. If the repository is still docs-only, first execute the Electron scaffold task defined by the engineering technical design.

**Steps:**

- [ ] Add export entry from breakdown workbench.
- [ ] Show Markdown package and machine-readable package as target export forms.
- [ ] If minimum assets are missing, show blocking reasons instead of silently failing.
- [ ] Ensure credentials and Windows secure storage references are not listed as export contents.
- [ ] Verify export blocked state before real AI output exists.

**Acceptance:**

- Export affordance exists but does not pretend the book is complete.
- Blocking reasons are specific enough for a user or subsequent implementation task to act on.

## 6. Validation Scenarios

Run these as manual or automated acceptance scenarios after implementation:

1. Fresh start: no library exists, user creates one and reaches empty breakdown shelf.
2. Valid import: user imports a small `.md`, sees metadata, structure review and workbench shell.
3. Unsupported import: user selects unsupported file and gets a clear reason.
4. Encoding failure: user gets manual encoding path.
5. Structure correction: user separates title tree from story segment range and freezes structure.
6. No connector: user can still import and structure-review, but AI actions are disabled with reason.
7. Failed placeholder job: user sees checkpoint, failure reason and recovery actions.
8. Export blocked: user sees exact missing requirements.
9. Domain boundary: original shelf remains placeholder and technique library does not receive draft breakdown candidates.

## 7. Required Verification Commands

Exact commands depend on the eventual tech stack. The implementation plan produced after scaffold audit must define:

- Typecheck command.
- Unit or component test command.
- Build command.
- Manual entry-path verification steps.

Before tech stack exists, verify this task document with:

```powershell
rg -n "Goal|Scope|User Path|Forbidden Moves|Acceptance|Validation Scenarios" docs\tasks\TASK-001-breakdown-workbench-foundation.md
rg -n "T[B]D|TO[D]O|fi[l]l in|To be determine[d]" docs\tasks\TASK-001-breakdown-workbench-foundation.md
```

Expected result:

- The first command finds all required sections.
- The second command returns no unresolved placeholders.

## 8. Dependencies

- `docs/product/write-storm-product-design.md`
- `docs/product/FLOWS.md`
- `docs/tasks/TASK-000-pre-v1-hard-gates.md`
- `docs/engineering/TECHNICAL_DESIGN.md`

## 9. Completion Rule

TASK-001 is complete only when a fresh implementation thread can read this file plus `docs/product/FLOWS.md` and know:

- what to build first;
- what not to build;
- which user path to validate;
- which object boundaries must not be violated;
- which hard gates remain outside the first implementation slice.
