# TASK-000: Pre-V1 Hard Gates

> **For agentic workers:** This is a gate task, not an implementation task. The desktop stack and primary store are now decided, but real AI implementation must not start until the Codex SDK gate has a recorded decision.

**Goal:** Close the product and feasibility gates that must be decided before WriteStorm V1 can ship AI-backed breakdown features.

**Source of truth:** `docs/product/write-storm-product-design.md`, `docs/product/FLOWS.md`, `docs/vibecoding-workflow.md`, and the voided audit documents.

**Current status:** Open.

---

## 1. Gate Summary

| Gate | Status required before tech plan | Blocking reason |
| --- | --- | --- |
| Codex SDK compatibility spike | Reproducible Go/No-Go decision | V1 AI acceptance depends on Codex SDK, with no `codex exec` or app-server fallback |
| Schema/version/source/structure edition contract | Written product contract | Evidence invalidation and rerun cannot be stable without version ownership |
| SQLite/Markdown/JSON edit boundary | UI control-level rule | SQLite main fact source breaks if Markdown or export mirrors can edit structural facts |
| Job checkpoint granularity | Recovery unit decision | Long novel analysis must resume predictably |
| `AnalysisModuleInstance` carrier boundary | Confirmed object ownership | Review, rerun, diff and export need one stable unit |
| Minimal type/template/tag contract | First built-in set and override rule | AI output and review cannot align with free-form type drift |
| Review completion condition | Blocking vs non-blocking asset layers | Long novels can create too many review items for an all-or-nothing gate |
| Sample text and AI output example | At least one reviewable fixture set | Evidence density and abstraction quality cannot be judged in the abstract |
| Low-fi entry path | Flow map or page list with empty/error/recovery states | User path must be verifiable before UI or tech stack work |

## 2. Gate Tasks

### Gate 1: Codex SDK Compatibility Spike

**Decision output:** A short spike note that names the Codex SDK version, official documentation source, Electron process target, authentication behavior, structured-output strategy, cancellation behavior, logging behavior, packaged-app behavior on Windows 11 and macOS, and Go/No-Go result.

**Acceptance:**

- Codex SDK can run from Electron main process or utility/worker process without exposing privileged APIs to renderer.
- Codex SDK can produce a machine-checkable structured result for a sample breakdown request.
- Codex SDK calls can be timed out or cancelled from the app job controller.
- SDK errors, auth failures and rate/runtime failures map to `Job` failure states and local logs.
- Packaged Windows 11 and macOS builds can locate and run the SDK path chosen by the spike.
- If the spike fails, V1 AI capability is blocked; do not fall back to `codex exec`, app-server, GUI app automation, API Key, local model or other providers.

**Stop condition:** No real AI breakdown implementation depends on guessed Codex SDK behavior.

### Gate 2: Schema, Version, Source and Structure Edition Contract

**Decision output:** A version ownership table.

Minimum contract:

| Change type | Version/edition owner | Invalidates | Does not rewrite |
| --- | --- | --- | --- |
| Source content, encoding normalization, manual source correction | `source_text_edition` | affected `EvidenceAnchor`, affected `AnalysisModuleInstance` | confirmed user decisions |
| Title tree, chapter split/merge, volume boundary | `structure_edition` | affected scope, evidence positioning, export index | source text copy |
| `StorySegmentRange` adjustment | `structure_edition` | range-scoped module instances and evidence | title tree |
| Module rerun or accepted diff | `analysis_revision` | downstream stale markers | source and structure editions |
| User edits module Markdown body | `analysis_revision` | related structured assets need review | JSON structural fields |

**Acceptance:**

- Evidence anchors state which edition they bind to.
- Stale, needs rebuild and broken evidence states identify whether the cause is source, structure or analysis revision.

### Gate 3: SQLite, Markdown and JSON Edit Boundary

**Decision output:** A control-level rule list for the first implementation.

**Rules:**

- SQLite is the only transactional main fact source.
- Markdown editor can edit only `AnalysisModuleInstance` body text through a controlled service.
- JSON and Markdown are export, mirror or migration artifacts derived from SQLite.
- Structure fields, evidence anchors, object links, relation links, tags, review states and AI constraints are edited through structured controls that write SQLite.
- Markdown body edits create `analysis_revision` in SQLite and mark related structured assets for review.
- Export can include unreviewed body revisions only with visible status markers.

**Acceptance:**

- Implementers know which UI controls write SQLite and which control writes module body text.
- No implementation path can silently parse arbitrary Markdown or JSON mirrors back into structural facts.

### Gate 4: Job Checkpoint Granularity

**Decision output:** A recovery unit table.

Recommended first contract:

| Job type | Checkpoint unit | Resume behavior |
| --- | --- | --- |
| Import | source file copy + metadata | retry copy or cancel cleanly |
| Structure detection | structure draft | resume at manual structure review |
| Estimation | job plan | recompute if structure changes |
| AI analysis | `AnalysisModuleInstance` batch | keep completed instances, retry failed batch |
| Export | package manifest | rebuild package from current facts |

**Acceptance:**

- Closing and reopening the app cannot lose completed source copy, structure draft, or confirmed module instance state.
- Failed jobs show what was kept, what can resume, and what must rerun.

### Gate 5: `AnalysisModuleInstance` Carrier Boundary

**Decision output:** A product ownership statement.

**Required statement:** `AnalysisModuleInstance = AnalysisModule + scope + version + status`; it owns module body, evidence references, review state, rerun candidates, diff acceptance and export inclusion.

**Acceptance:**

- Module definition does not store per-book results.
- Book status does not replace module instance status.
- Perspective views compose instances and relations but do not become a new fact source.

### Gate 6: Minimal Type, Template and Tag Contract

**Decision output:** The minimal first built-in type set and override rule.

**Starting set from the product design:**

- 日轻校园
- 异世界
- 古代玄幻
- 现代幻想
- 都市恋爱
- 无限流

**Rules:**

- User chooses main type and optional subtype.
- Main type sets baseline module concerns.
- Subtype adds additional concerns; it cannot remove V1 required module outputs.
- Character/persona labels require definitions and evidence before being attached.

**Acceptance:**

- AI output can be compared across types because the stable modules remain the same.
- Type-specific prompts cannot create a different module table.

### Gate 7: Review Completion Condition

**Decision output:** Review layers for “book completed”.

Recommended layers:

| Layer | Examples | Blocks completed? |
| --- | --- | --- |
| Hard gate assets | module instance body, key evidence for confirmed conclusions, accepted structure, valid source copy | Yes |
| Review assets | domain entities, relation links, technique observations, reusable candidates, AI constraints | Blocks only if user tries to publish/export as confirmed |
| Deferred assets | low-confidence suggestions, background caches, rejected candidates, optional perspective refresh | No |

**Acceptance:**

- “Task completed” and “Book completed” are different states.
- A long novel does not require every low-value suggestion to be manually handled before the book can be closed.
- Confirmed reusable candidates still require valid key evidence.

### Gate 8: Sample Text and AI Output Example

**Decision output:** A fixture package for product and technical validation.

Minimum fixture contents:

- One short `.txt` or `.md` sample with chapters and at least one cross-chapter story segment.
- Expected `StructureNode` tree.
- Expected `StorySegmentRange` candidate.
- One sample `AnalysisModuleInstance` output.
- At least three `EvidenceAnchor` examples.
- One `WorkTechniqueObservation`.
- One `ReusableTechniqueCandidate` showing removal of source-specific role, setting and wording.

**Acceptance:**

- The fixture can test structure recognition, evidence density, review status, technique abstraction and export shape.
- The fixture text is either original to this project or otherwise legally usable for internal testing.

### Gate 9: Low-Fi Entry Path

**Decision output:** A flow map or page list.

**Current artifact:** `docs/product/FLOWS.md`.

**Acceptance:**

- First launch, empty library, empty breakdown shelf, no connector, import failure, structure failure, task interruption, evidence stale and export blocked states have visible routes.
- The artifact explicitly says it is not high-fidelity visual design.

## 3. Exit Criteria

TASK-000 is complete only when:

- Each gate has an owner decision, a downgrade decision, or a linked follow-up task.
- No gate is left as an implicit implementation choice.
- `TASK-001-breakdown-workbench-foundation.md` can be executed without deciding AI integration inside the implementation thread.

## 4. Verification Commands

Run these before marking the gate task complete:

```powershell
rg -n "source_text_edition|structure_edition|analysis_revision|Review Completion|Codex SDK|Sample Text|Low-Fi" docs
rg -n "T[B]D|TO[D]O|fi[l]l in|To be determine[d]" docs\tasks docs\product\FLOWS.md
```

Expected result:

- The first command finds the hard-gate contracts or linked decisions.
- The second command returns no unresolved placeholders.
