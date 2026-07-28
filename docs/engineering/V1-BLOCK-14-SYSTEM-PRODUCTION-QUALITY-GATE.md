# V1 Block 14 System Production Quality Gate

Date: 2026-07-28

Status:

`USER_CONFIRMED_DIRECTION / REV3.2_CONFIRMED / BLOCK14_NOT_FROZEN / QUALITY_UNPROVEN`

Authority:

- This document is the single detailed authority for the Block 14 cross-module production-quality
  architecture and its staged admission gates.
- D132, the product/technical designs, the inference-governance plan, CONTEXT and TASK-002 contain
  only summaries or explicit overrides that link here.
- The detailed seven-module ontology remains owned by
  `V1-BLOCK-14-G0-CROSS-EXAMINATION-RECORD.md`; implementation impact remains owned by
  `V1-BLOCK-14-G1-IMPLEMENTATION-BASELINE-IMPACT-ASSESSMENT.md`; Story Plot domain semantics remain
  owned by `V1-BLOCK-14-STORY-PLOT-CROSS-EXAMINATION-RECORD.md`.
- This direction does not freeze Block 14, prove literary quality, authorize a production Prompt,
  run real AI, admit a migration or physical Schema, or authorize Block 17/18 implementation.

## 1. Problem And Candidate Direction

Seven rigorous modules do not automatically produce a rigorous Book analysis. Running every module
against every chapter, story segment, volume and Book would create a Cartesian workload, duplicate
reading, encourage low-value gate-filling, amplify upstream errors through repeated summaries and
overload user review.

The confirmed production candidate is:

```text
shared gapless coverage
  -> non-authoritative candidate discovery and routing
  -> domain-owner source review
  -> conditionally triggered deep analysis
  -> conclusion/range/dependency-driven selective rerun
```

The seven modules are independent ownership, bounded-completion and review units. They are not default
independent full-text AI-call units. Chapter, Story segment, volume and Book remain structural
projections, context and synthesis scopes; none fixes an AI-call boundary.

## 2. CoverageSliceRevision

### 2.1 Logical identity

`TextRange` is a generic source interval. It may overlap other ranges and is used by evidence,
applicability, retrieval and structural projections. It cannot also be the identity that proves
gapless, non-overlapping scan coverage.

`CoverageSliceRevision` is the logical coverage and positioning unit. It binds:

- one `SourceTextEdition`;
- one `CoveragePlanRevision`;
- one gapless/non-overlapping core range;
- an optional overlapping halo used only as context;
- deterministic coverage/run metadata.

For one source edition and coverage-plan revision, active core ranges cover the required source
exactly once: no gap and no overlap. Halo text may overlap adjacent cores but earns no coverage credit.
EvidenceAnchor and ordinary TextRange identities may still overlap freely.

`CoverageSliceRevision`:

- owns no literary fact, candidate or canonical asset;
- is not a chapter, Story segment, volume, Scope or AI call;
- does not decide the minimum rerun unit;
- has a version independent of the source edition, so tokenizer/window-policy changes create a new
  coverage plan without changing canonical literary identity;
- stores source references and run metadata only. Source text remains single-copy; halo text is never
  permanently duplicated.

Block 17 decides whether multiple slices are composed into one call, one slice is split across calls,
or context is reused across calls.

### 2.2 Coverage run states

Every required core has an explicit outcome. A failure or overflow can never become checked-empty.
Coverage run states include:

- `succeeded`;
- `failed`;
- `retry_pending`;
- `deferred`;
- `overflow`;
- `coverage_risk`.

The final vocabulary and persistence shape remain open, but these meanings are distinct from literary
support or review status.

## 3. ModuleInstance And CanonicalAsset Responsibilities

`AnalysisModuleInstance` is the module-plus-Scope container for:

- run and input-version records;
- coverage and status projection;
- references to canonical assets;
- module body revision;
- a genuine Scope-level synthesis.

It does not own or duplicate every fact, EvidenceAnchor or structured asset encountered in that Scope.
Canonical assets retain one stable identity across chapter, Story segment, volume and Book views and
belong to their domain owner. A higher Scope may reference lower-level facts to create a new synthesis;
it may not silently copy or overwrite them.

The logical responsibility split is frozen by this direction. Physical table topology, foreign keys,
CAS and migration strategy remain open.

## 4. Candidate Discovery, Long-Distance Recall And Queue Safety

The shared scan may submit cross-domain candidates, but only the target domain owner may merge, split,
reject, transfer, promote or create a formal asset. Candidates have no downstream authority.

Long-distance discovery cannot depend only on already-created candidate summaries. It must support:

- later evidence triggering a targeted search of earlier source text;
- retrieval over original text and stable anchors, not only summaries;
- a non-authoritative “salient but not yet classified” candidate carrying an original-text anchor,
  salience reason and discovery context;
- indexed or directed retrieval rather than all-window pair comparison;
- source reread by the domain owner before a high-impact link becomes authoritative.

The current six-class long-distance sampling frame is only an overlapping experiment and failure-analysis
seed. Foreshadowing, imagery and scene recurrence are important adversarial examples, not a complete
production list. Unclassified residuals record impact, original-text anchors and the miss mechanism;
the sampling frame changes only after a preregistered residual threshold, not after every new example.
Metrics are reported by sample and failure mechanism; “all six classes covered” is never a quality claim.

Candidate queues require:

- deterministic deduplication and idempotent resubmission;
- an explicit budget and visible queue accounting;
- `deferred`, `overflow` and `coverage_risk` outcomes;
- no silent truncation;
- no conversion of overflow or failure into checked-empty;
- a visible reason when work is postponed.

Production CAS/storage and worker-queue design belong to Block 17/18, not Block 14.

## 5. Three Orthogonal State Axes

The system must not compress three different questions into one status:

1. **Run/coverage axis** — did the required work run, fail, defer, overflow or expose coverage risk?
2. **Epistemic axis** — is the claim directly supported, inferential, insufficiently evidenced,
   competing or unresolved?
3. **Review/authority axis** — has the relevant human or owner reviewed it, and is it admitted to a
   particular authoritative consumer set?

Required invariants:

- `failed`, `deferred`, `overflow` and `coverage_risk` are not epistemic conclusions.
- `insufficient-evidence` and `unresolved` do not mean the run failed.
- User acceptance never turns a hypothesis into a textual fact.
- An unresolved item may be honestly disposed for coverage, but it does not automatically gain
  authoritative downstream eligibility.
- A structured asset is not automatically mandatory human review.

The complete persisted state machine and review queue remain Block 18 work.

## 6. Book-Level Semantics And Consumer Eligibility

Two Book-level meanings are frozen:

### `AnalysisCoverageComplete`

This means the required source coverage and finite module/Book focus obligations were honestly handled.
It requires:

- all required active cores have successful coverage, with no silent gap;
- no blocking overflow or coverage risk remains hidden;
- each module's small module/Book-level completion surface is disposed;
- required candidate routing and triggered deep work are accounted for.

It does not mean exhaustive literary understanding, user confirmation of every result or production
quality validation.

### `AuthorityReviewComplete`

This means the current required authority-review set has been explicitly disposed. Unreviewed assets
do not enter the authoritative set automatically. A deferred item is non-blocking only when it is
explicitly excluded from the current authority set and every consumer that needs it remains
`partial` or `blocked`.

These two semantics express analysis progress and authority-review progress. They do not create a third
global “usable” Book state. Eligibility for a Perspective, Technique source handoff, AI constraint,
export or other consumer is calculated per asset and consumer policy. A Book-level milestone cannot
one-click promote all assets.

High-impact sources used by another module as authoritative input require review before that use.
Specific risk scoring, mandatory-review asset types, queue policy and completion UI remain Block 18
decisions informed by real consumers.

## 7. Selective Rerun And Source Change

`module + scope` remains a user request and maximum container boundary, not the internal minimum rerun
unit. The internal target is the affected conclusion, necessary original-text range and actual
dependency closure. Scope, module or full-Book expansion requires evidence that narrower coverage is
insufficient.

Three paths remain distinct:

- **Append** extends the coverage frontier. Prior unchanged text stays valid, but new text may trigger
  targeted back-search and owner review of earlier ranges.
- **Source-edition revision** uses source diff and anchor impact to find affected candidates,
  conclusions and dependency closures. It never invalidates an entire module by default.
- **Coverage-plan revision** rebuilds coverage records for the same source edition. It does not change
  canonical asset identity merely because tokenization/window policy changed.

A delayed back-search may create a new candidate without any source change. It marks prior coverage as
`coverage_risk` only when evidence shows a systemic miss, not merely because a new interpretation became
possible.

User feedback may directly submit a targeted candidate with an anchor and reason. Accepted corrections
preserve history and selectively stale actual consumers; they never silently rewrite confirmed assets.

## 8. Budget Priority B

When Base, ContentFocus Overlay, Book-specific focus and conditional triggers exceed the available
content budget, deterministic priority is:

1. minimum Base coverage;
2. correctness triggers necessary to resolve evidence, identity, ownership or coverage risk;
3. Book-specific focus questions in user order;
4. ordered ContentFocus Overlay questions;
5. optional literary deep dives.

Programmatic safety and contract enforcement sit outside Prompt content budget. They still count toward
total production cost, latency and failure-rate hard limits.

Required layers that do not fit one call are split or rescheduled; they are not silently removed.
If the production hard limit still cannot accommodate them, the system exposes `deferred` or
`coverage_risk` and blocks `AnalysisCoverageComplete`. Optional deep work may defer, but cannot acquire
authoritative downstream eligibility while missing.

## 9. Synthesis, Perspectives And Cross-Module Thin Slices

Book-level synthesis is a sourced synthesis over qualified canonical assets and original-text anchors.
It is not a new fact owner. It must reread original text for high-impact, contradictory or low-confidence
judgments and perform a small stratified audit of unflagged/negative results so undetected contradictions
and upstream error amplification remain measurable. It may not merely concatenate summaries.

Perspectives remain on-demand consumers. They:

- never become fixed seven-module workload;
- never block `AnalysisCoverageComplete`;
- consume only qualified sources;
- never create missing foundational facts.

Their generation timing, refresh interaction and execution details remain Block 15/17/18 work.

The Block 14 architecture walkthrough must include two bounded cross-module chains:

1. World/Character/Relationship persistent states versus Story Plot actions and results.
2. Narrative-presentation and language observations submit an interpretation candidate to the Theme
   owner; they do not directly create an authoritative Theme interpretation.

Block 16 source handoff is attached to those chains rather than becoming a third full analysis chain.
The cases inject an upstream correction and verify selective stale for Theme candidates, Technique
discovery candidates and their real consumers. Block 14 evaluates source-handoff quality only; it does
not claim ownership of final Technique quality.

## 10. Staged Admission

The following stages may not be collapsed:

1. Freeze human-authored walkthrough cases, expected behavior and pass criteria.
2. Pass the human walkthrough of product ownership and failure handling.
3. Resume the six open module reviews and Story Plot's open production configuration only for limited
   domain semantics under the module-admission rule.
4. Complete the shared logical specification baseline.
5. After separate authorization, implement only pure contracts, reference algorithms and deterministic
   fixtures that reuse the production contract and actual routing/dependency logic.
6. Pass that deterministic contract gate before declaring `BLOCK14_SPEC_FROZEN`.
7. Block 17 runs real-AI thin slices and multi-corpus validation.
8. Only after that succeeds may the candidate become `PRODUCTION_CONFIGURATION_VALIDATED`.
9. Block 18 validates the real user review, correction, selective stale/rerun and consumer-use paths.

Block 14 may not bring forward a production Job, SQLite queue, persistence topology or review UI. A
human walkthrough permits limited module cross-examination; a deterministic fixture permits Block 14
spec freeze; neither proves real-model quality.

Each module admitted after the walkthrough defines only:

- its unique fact and formal-asset ownership;
- a small number of module/Book completion questions;
- evidence, counterevidence and disconfirmation handling;
- cross-owner candidate handoff;
- conditional deep-analysis triggers;
- targeted validation cases.

Every new rule states the independent error it prevents and how that benefit will be measured. A
literary rule that cannot yet prove gain remains `PROVISIONAL` as an experiment hypothesis, targeted
case or offline method; it does not enter the regular Prompt or deep production Schema.

## 11. Evaluation And Corpus Governance

### 11.1 Corpus classes

- **Versioned core regression set** — stable and reusable for debugging.
- **Blind rotating challenge set** — unavailable for tuning before evaluation.
- **Exposed-failure regression set** — once a blind item informs a fix, it leaves the blind set and
  enters the next versioned regression set.

Block 14 freezes corpus governance, required representation and failure closure, not a final work list
or evidence that any corpus has passed.

### 11.2 Comparison dimensions

Architecture comparisons cover:

- monolithic joint analysis;
- independent module runs, including their actual repeated-reading cost;
- the shared-coverage candidate architecture in this document.

Method-load comparisons cover:

- short focus card;
- short card plus conditional triggers;
- all deep literary cards resident;
- the full Q1–Q47 overload stress group.

The leading short-card-plus-trigger candidate is compared across architectures, while the shared
architecture covers the four method arms. One-mechanism-at-a-time ablation is preferred; a small
combination test is added only after a material interaction appears. No full factorial Cartesian test
is required.

Fair comparisons fix model/configuration version, source edition, corpus, task target and evaluation
rules. A monolith that exceeds a context hard limit is reported as not runnable; truncating source text
does not create a fair baseline. Real-AI runs repeat and report variance.

### 11.3 Metrics And failure rules

Report separately by work length, structure and failure mechanism:

- local and cross-range omission;
- high-impact long-distance link recall;
- unsupported assertion and misreading;
- duplicate facts and ownership conflict;
- cross-module contradiction and identity stability;
- synthesis fidelity and upstream error amplification;
- source-owner handoff quality;
- candidate load and correction burden;
- token, latency, overlap multiplier, fixed Prompt overhead, deep-dive ratio, failure and retry cost;
- current human reviewers' adjudication/correction time in Block 17;
- real-user review burden and precise correction time in Block 18.

Cross-reviewer literary generalization remains `PROVISIONAL` while no external experts are available.
Literary assessment must allow reasonable multiple readings and distinguish acceptable interpretation,
clear misreading and high-impact omission.

The following accepted deterministic violations are zero-tolerance failures:

- authoritative fact double-write;
- silent coverage gap;
- an unqualified source entering an authoritative downstream consumer;
- silent overwrite of a confirmed asset.

A raw AI candidate rejected by Schema or eligibility gates counts toward failure rate rather than
automatically failing the complete architecture.

Literary issues are judged by impact and frequency; a disputed reading does not automatically fail,
and an average score cannot hide repeated high-impact misses. Token, latency and failure rate have
preregistered production hard limits; a candidate beyond a hard limit cannot enter a quality-cost
frontier merely because its literary score is higher.

Before real evaluation, thresholds, blinded evaluation rules, multiple-reading adjudication and
challenge-set exit rules must be preregistered. Metrics unavailable before Block 17/18 are explicitly
`PROVISIONAL`. Systemic omissions, synthesis distortion or cost failure return to architecture/module
design; thresholds may not be lowered to disguise failure.

## 12. Remaining Open Decisions

The following remain open without weakening the confirmed direction:

- exact evaluation thresholds and selected works;
- exact shared logical contract names beyond the names frozen here;
- physical persistence, candidate CAS/storage and production queue;
- full Block 18 review-risk scoring, mandatory-review set and completion UI;
- Block 15 perspective interactions and Block 18 refresh UX;
- production batching, context reuse and retry topology;
- final Block 16 Technique quality.

These items must close before their owning implementation gate. Their open status cannot be used to
claim Block 14 freeze or production validation.
