# V1 Block 14 Inference Governance Planning Addendum

Date: 2026-07-25

Status: 14-G0 approved; Story Plot domain semantics closed/production configuration open (1/7);
14-G1 impact assessment complete/implementation admission open; six module reviews and shared contracts pending;
REV3.2 system-quality direction confirmed; Block 14 not frozen; quality unproven; implementation not started

Authority: This addendum expands the active meaning of Block 14 under D122–D132. The approved 14-G0 inventory and ownership record is `docs/engineering/V1-BLOCK-14-G0-CROSS-EXAMINATION-RECORD.md`. The corrected Story Plot domain semantics are recorded in `docs/engineering/V1-BLOCK-14-STORY-PLOT-CROSS-EXAMINATION-RECORD.md`; the 14-G1 impact inventory is `docs/engineering/V1-BLOCK-14-G1-IMPLEMENTATION-BASELINE-IMPACT-ASSESSMENT.md`. The cross-module production-quality gate is single-sourced in `docs/engineering/V1-BLOCK-14-SYSTEM-PRODUCTION-QUALITY-GATE.md`. The historical master tasks are narrowed by an explicit REV3.2 override and do not authorize implementation.

## Purpose

Block 14 must freeze a finite, testable inference-review discipline so that important literary interpretations expose what was observed, what was inferred, how strong the support is, which material alternatives remain, what could disconfirm the current assessment, and which downstream assets depend on it.

The discipline must not become:

- a new eighth analysis module;
- a universal knowledge graph;
- one persisted object for every sentence or fact;
- an encyclopedia of literary concepts;
- a deterministic engine that decides what fear, desire, shame, jealousy, conflict or theme “really means”;
- a request for or storage of model-private chain of thought;
- a real Prompt, SDK call, AI result, persistence path or review UI during Block 14 design work.

## Confirmed Design Direction

The common semantic relationship is:

```text
EvidenceAnchor
  -> textual fact / grounded observation
  -> material interpretation alternatives
  -> current assessment or unresolved
  -> derived conclusion
  -> explicit downstream dependencies
```

These are semantic levels. Module-native facts and ordinary reading prose do not receive independent identities by default.

An interpretation crosses the structured threshold only when it:

- requires user confirmation/correction;
- crosses an analysis-module boundary;
- participates in a Perspective, WorkTechniqueObservation, ReusableTechniqueCandidate, AIConstraint or export;
- affects completion, rerun or invalidation;
- makes an important non-direct claim about psychology, motive, causality, narrative effect, style effect or technique mechanism.

The bounded structured unit is provisionally called `InferenceReviewRecord`. Block 14 may refine the final contract name, but it may not remove the threshold or turn the four semantic levels into default database entities.

## Required Block 14 Planning Additions

### 14-G0: Module System Cross-Examination Gate

Gate result: `CLOSED` on 2026-07-26. The approved core inventory is:

1. `故事情节` — 故事事件、因果与情节线；
2. `叙述调度` — 叙述结构与信息调度；
3. `人物塑造`；
4. `关系动力`；
5. `世界设定` — 世界设定、环境与规则；
6. `语言文体` — 语言与文体；
7. `主题意蕴` — 主题、象征模式与意义结构。

The structure layer is a non-module prerequisite. Block 15 Perspectives, Block 16 Technique assets and module-external AIConstraint governance are downstream domains, not additional source-analysis modules. Full ownership, scope, qualification, dependency and completion decisions are recorded in `V1-BLOCK-14-G0-CROSS-EXAMINATION-RECORD.md`.

The seven modules in the current shared contract, migration seed, workbench and tests remain an implementation baseline only. The completed cross-examination covered:

- whether the product needs the current module count;
- whether each current name describes a user-meaningful responsibility;
- whether any module should be retained, renamed, merged, split, removed or added;
- the exact boundary and fact ownership of every proposed module;
- the allowed dependency direction and cross-module reference rules;
- which scopes each proposed module owns or consumes;
- whether secondary pages, Perspectives, Technique flows or AI-constraint aggregation have been mistaken for fact-owning analysis modules.

Acceptance required an explicit approved module inventory, responsibility/boundary map, fact-ownership map, dependency graph and scope matrix. The 14-G0 record supplies those artifacts. Existing code and tests remain evidence about implementation impact and current behavior, not authority for the final product shape.

This was the first Block 14 gate. Its closure permits module-specific deep-methodology cross-examination, but does not freeze any focus card, payload Schema, state machine, Prompt or implementation. The changed module system also triggers 14-G1 before implementation admission.

### 14-G1: Module Baseline Impact Decision

Because 14-G0 approved a module system different from the implementation baseline, Block 14 must next complete a separate impact/admission plan covering at least:

- shared analysis contracts and stable keys;
- migration 003 reference seed and every downstream migration or fixture coupled to it;
- ModuleWorkspace and renderer route/gate assumptions;
- TypeLibrary, methodology, Prompt and analysis-configuration snapshots and derivation rules;
- `inputModuleKeys`, whole-module readiness assumptions, completion/publication gates and export module counts;
- stable cross-scope asset identity, routed-candidate ownership and the external constraint-governance domain;
- unit, integration, schema-compatibility and packaged-entry tests;
- compatibility and upgrade behavior for existing libraries.

Impact assessment result: `IMPACT_ASSESSMENT_COMPLETE / IMPLEMENTATION_ADMISSION_OPEN`.
The linked 14-G1 assessment identifies the exact current contract, migration, service, workbench,
TypeLibrary/Prompt, Perspective/Technique, export and test surfaces. It does not choose canonical keys,
shared Schema, migration strategy or physical storage and therefore authorizes no code change.

The impact plan must be reviewed and separately authorized before implementation. It may not be folded into 14-I2, 14-I4 or another deep-payload-schema Task as incidental cleanup.

### 14-I1: Semantic Levels And Structured Threshold

Freeze:

- the distinction between textual fact, grounded observation, interpretation and derived conclusion;
- the distinction between ReviewAsset workflow status and epistemic support;
- the exact rule deciding when an interpretation must become structured;
- the rule that ordinary Markdown analysis has no structured downstream authority.

Acceptance:

- a direct textual fact does not require its own inference record unless it becomes independently reviewable or dependency-bearing;
- behavior cannot satisfy a personality conclusion without an interpretation;
- chronology cannot satisfy a causal conclusion without an interpretation;
- a stylistic pattern cannot satisfy a reader-effect conclusion without an interpretation.

### 14-I2: Bounded Inference Review Record

Freeze the minimum logical content needed to validate:

- subject/question and module ownership;
- Book, scope and optional character-stage/text-range applicability;
- grounded observations and EvidenceAnchor mapping;
- material interpretation alternatives;
- ordinal support classification;
- selected current assessment or explicit unresolved result;
- concise audit rationale;
- counterevidence, evidence conflict and disconfirmation conditions;
- upstream and downstream dependency references;
- revision and review-envelope integration.

This Task defines a Zod-first contract and fixtures only after separate implementation authorization. It does not choose a table topology or admit persistence.

Acceptance:

- missing applicability on a stage-bound character claim fails;
- missing observation/evidence mapping on a critical interpretation fails;
- an unresolved record cannot masquerade as a selected deterministic conclusion;
- unknown/extra contract fields fail closed;
- the contract contains no free-form private-reasoning trace.

### 14-I3: Alternatives, Evidence And Confirmation Gate

Freeze:

- “material alternative” as an explanation that remains reasonable under current evidence and would change a conclusion or downstream result;
- when multiple material alternatives must be retained;
- when a selected assessment may remain provisional;
- how low support, insufficient evidence, conflicting evidence and counterevidence differ;
- which combinations block a settled confirmed conclusion;
- how a hypothesis may be reviewed without being promoted to fact.

Acceptance:

- the same evidence can support two live competing interpretations;
- strong unresolved counterevidence blocks a settled conclusion;
- user acceptance cannot upgrade weak support to direct fact;
- excluding evidence recomputes eligibility instead of silently retaining the old confirmation basis.

### 14-I4: Post-Gate Module Focus And Payload Inputs

Only modules approved by 14-G0 receive a bounded focus card. Story Plot has completed its separate
deep-methodology cross-examination; the other six rows remain interrogation inputs. No row is a final
shared payload Schema:

| Approved module | Methodology status | Focus/boundary |
| --- | --- | --- |
| 故事情节 | `DOMAIN_SEMANTICS_CLOSED / PRODUCTION_CONFIGURATION_OPEN` — D131 | Four canonical asset kinds; detailed domain, lifecycle, relation, recap and production-gate rules are single-sourced in `V1-BLOCK-14-STORY-PLOT-CROSS-EXAMINATION-RECORD.md` |
| 叙述调度 | `OPEN` | presentation instances, narrator/level/focalization, order/duration/frequency and information operations; must not duplicate story events, character knowledge truth or language-form observations |
| 人物塑造 | `OPEN` | identity, phase-bound goals/knowledge/beliefs/values, motive and development interpretations; must not duplicate event actions or relationship states |
| 关系动力 | `OPEN` | light relationship facts, directed/asymmetric states, phases and multi-party dynamics; must not create participant identities or infer importance from co-occurrence |
| 世界设定 | `OPEN` | environment, resources, institutions, norms, public ability/rule definitions, costs and exceptions; must not become an encyclopedia or turn belief into world truth |
| 语言文体 | `OPEN` | version-identified linguistic form, local observations, patterns, variation and scope synthesis; must not attribute a translation directly to the author or assert reception without data |
| 主题意蕴 | `OPEN` | central thematic questions, symbolic/meaning patterns, value conflict and competing interpretations; must not copy domain facts or recover one mandatory authorial intention |

The six open rows guide later adversarial methodology rounds; they do not enumerate literary concepts or
prescribe a closed theory. Story Plot domain closure supplies domain inputs only: its shared claim envelope,
Evidence contract, review state machine, physical storage and IPC DTO remain open. No deep payload Schema
may be implemented until the shared protocol, 14-G1 and the relevant freeze gate close.

### 14-I5: Correction And Dependency Specification

Freeze correction targets:

- evidence;
- textual fact/grounded observation;
- interpretation alternative;
- current assessment;
- derived conclusion.

Every accepted correction creates a new revision, retains the prior state and records the user-visible correction reason. A result-level correction cannot edit the common protocol or global methodology; such a change requires a new MethodologyVersion.

Freeze two independent invalidation inputs:

1. Configuration changes: TypeLibrary, Methodology, Prompt, Schema and composition snapshots.
2. Semantic changes: evidence, observation, interpretation and conclusion revisions.

Configuration impact uses the versioned analysis-configuration snapshot diff authority. Semantic impact follows actual dependency references. The algorithms, reason codes and tests remain separate. Neither accepts caller-declared affected modules.

### 14-I6: Corpus And Freeze Gate

The gate is staged and the stages cannot be treated as one “fixture passed” claim:

1. Freeze human-authored walkthrough cases, expected behavior and pass criteria.
2. Pass the product-responsibility walkthrough.
3. Resume the six open module reviews and Story Plot's open production configuration for limited
   semantics only.
4. Complete the shared logical specification baseline.
5. After separate authorization, implement pure contracts, reference algorithms and deterministic
   fixtures that reuse the production contract and real routing/dependency logic.
6. Only after that deterministic gate may the result become `BLOCK14_SPEC_FROZEN`.
7. Block 17 separately runs real-AI thin slices and multi-corpus quality/cost validation.
8. Only a passing runtime gate may become `PRODUCTION_CONFIGURATION_VALIDATED`.
9. Block 18 separately validates real-user review, correction and selective-rerun paths.

The deterministic Block 14 corpus must still prove competing interpretations, weak-evidence limits,
fact/inference separation, phase applicability, counterevidence, insufficient evidence, owner routing,
correction-driven selective stale, distinct configuration/semantic invalidation and rejection of
Markdown-only authority. It must additionally cover gapless core accounting, halo non-ownership,
candidate dedup/idempotency, visible overflow/coverage-risk, the three orthogonal state axes,
consumer-specific eligibility and the two Book-level semantics.

The freeze manifest must cover the common logical protocol, the 14-G0 module-system decision, 14-G1
impact, approved limited module focus cards, `CoverageSliceRevision`, structured-threshold rules,
alternatives/counterevidence, ownership, participation, budget priority B and the validation corpus.
Any missing or drifted item fails closed before Block 17. Block 14 fixtures run no real AI and admit no
production Job, SQLite queue, persistence topology or review UI.

## Block 17 Handoff

Block 17 executes, but does not redefine, the Block 14 protocol.

Block 14 material is split before runtime:

1. module-specific literary method that the model must actually apply;
2. one shared Evidence/version/candidate/review/invalidation/completion protocol;
3. ID, cycle, ownership, Schema and transaction invariants enforced by code.

For Story Plot, the runtime focus card is the six-question skeleton: trackable change; chooser/actor/affected
party and direct result; connections; affected development lines; contradictions/unreliable/unknown material;
and minimum sufficient evidence. Agency, expected outcome, risk, fine time, event hierarchy, fine relations
and cross-line relations are composed only when their trigger matches. The full Q1–Q47 record must not be
concatenated into every request.

Every request for a module approved by 14-G0 composes:

1. one short versioned common inference protocol;
2. the selected module/scope focus card;
3. the exact strict output Schema;
4. only a small number of targeted examples relevant to the current module or known failure risk.

Block 17 must:

- validate the structured output before any business write;
- reject missing observation/evidence/alternative/applicability information when the Schema requires it;
- keep partial output out of confirmed assets;
- record exact methodology, Prompt, Schema and composition versions;
- return concise audit rationale rather than requesting private chain of thought;
- create only candidate/pending-review analysis assets.
- synthesize StandardStoryRecap separately after its source assets qualify.

This addendum does not provide real Prompt text, invoke Codex, admit a production analysis Job or claim that real literary analysis works.

## Block 18 Handoff

Block 18 owns:

- persistence topology and table admission for Evidence, Relation and bounded inference records;
- review and correction UI;
- immutable revision history;
- candidate rerun diff;
- semantic dependency storage and stale propagation;
- completion and export participation gates.

Structured assets are not all mandatory review. Block 18 must define risk-tiered review and calculate
eligibility for each real consumer; unreviewed assets never enter an authoritative set automatically.
The two Book-level semantics are `AnalysisCoverageComplete` and `AuthorityReviewComplete`, not one
global completion switch.

When evidence, an observation, an interpretation or a conclusion changes, Block 18 follows real dependency references and marks affected content stale or in need of review. It preserves the old version and never silently rewrites confirmed downstream content.

## Continuation Context Brief Handoff

Story Plot question 21 is closed with `short overview + key development steps`, organized by PlotLine and sourced from canonical events/connections. This does not add a Story Plot asset or enlarge the current deep-methodology scope.

The future `续写上下文简报` is a downstream author-preparation projection:

- it combines current situation, active/unresolved PlotLines, recent key choices, relevant Character/Relationship/World states, outstanding promises/setups and source locations through stable references;
- typed facts update through deterministic projection, so viewing it does not call AI;
- AI is limited to compressed expression and records dependency versions;
- material dependency change marks the generated compression stale; regeneration is explicit or occurs when the user prepares to continue writing;
- Block 14 freezes source eligibility, stable-reference and material-invalidation contracts only;
- Block 17 owns AI context composition and generation;
- Block 18 owns persistence, versions, selective stale propagation and refresh entry;
- a later Original-writing Block owns the actual continuation workflow.

The brief is not an eighth module, a new Story Plot fact/asset or a Block 14 freeze requirement.

## Book-Specific Focus Question Handoff

Story Plot question 29-B is `WITHDRAWN`. MainType and ContentFocus example copy does not add universal mandatory module questions.

The future `本书特别关注` capability:

- accepts zero or more user-authored natural-language questions before first formal analysis;
- optionally targets one approved module and one supported scope;
- only adds questions and cannot alter the module ontology, fact admission/ownership, evidence policy, standard story review, Schema or completion rules;
- permits an answer, checked-no-finding, not-applicable, insufficient-evidence or unresolved outcome;
- freezes with the Book analysis-configuration snapshot;
- is routed by Block 17 into existing work without a default extra full-Book AI pass;
- leaves persistence, dependencies, history and selective rerun impact to Block 18.

Block 14 must later freeze addition, routing qualification and evidence boundaries, but this capability does not enlarge the current Story Plot methodology round. MainType, ContentFocus, system focus cards, Markdown edits and Perspective notes are not substitutes.

Block 12 separately requires remediation because its current later-edit CAS path conflicts with permanent freeze after MainType/ContentFocus confirmation. This addendum records the conflict but authorizes no UI, service, schema or migration change.

## Block 15 And 16 Boundaries

- Block 15 Perspectives consume confirmed source-module assets and remain derived views. They cannot create foundational observations or resolve competing source interpretations as new facts.
- Block 16 owns formal Technique observation discovery/intake, abstraction, redaction, reusable candidates, review and rerun. Core modules provide stable source conclusions or routed non-authoritative discovery candidates; they do not persist formal Technique assets.
- Core analysis modules may submit provenance-bearing constraint candidates but do not own formal AIConstraint assets. A module-external constraint-governance domain is the single writer for formal constraints, source identity, applicability, priority, exceptions, conflicts and lifecycle. `AI 约束摘要` remains a read-only secondary aggregate page and never becomes an eighth module or a fact writer.

## Current Implementation Truth

At this design checkpoint:

- 14-G0 has approved a new seven-module product ontology; current shared keys, migration seed, workbench and tests still represent the pre-gate implementation baseline. The 14-G1 impact inventory is complete, but canonical keys, shared contracts and implementation admission remain open;
- `ReviewAssetEnvelope` is a shallow envelope;
- `ANALYSIS_REVIEW_ASSET_CONTRACT.definesDeepPayloadSchema` is false;
- `ANALYSIS_REVIEW_TRANSITION_POLICY.definesCompleteWorkflow` is false;
- no production EvidenceAnchor or RelationLink deep payload exists;
- no production inference schema, persistence, service, IPC or renderer correction surface exists;
- Block 13 has no production manuscript-analysis Job, module result persistence or real Prompt pipeline;
- the approved inference protocol is a design authority and future Block 14 gate, not an implemented capability.

## Planning And Verification Discipline

- The historical master tasks are retained but narrowed by the explicit REV3.2 override in
  `TASK-002-v1-work-breakdown-master-plan.md`; this addendum and the system-quality authority supply the
  missing governance detail.
- 14-G0 closed on 2026-07-26. D131 closes the endpoint/ownership Story Plot patch on 2026-07-27 as progress `1 / 7`; production configuration and the other six module reviews remain open.
- Story Plot domain closure freezes its bounded semantics, not external validity, production configuration, an `AddressableClaim` type, Zod payload, state machine, storage model, Prompt or implementation.
- The 14-G1 impact assessment is complete; implementation admission remains open and deep-schema work cannot absorb the registered migration.
- Each later implementation Task must name exact files, RED/GREEN evidence, focused tests, typecheck and diff-check, and must stop after one authorized Task.
- Block 14 tests are separately authorized pure contract/reference-algorithm and deterministic fixture
  tests; they do not run real AI or implement a production queue.
- Block 17 runtime tests cannot begin until Block 13 admission and the complete Block 14 freeze gate are separately accepted.
- macOS packaged AI remains deferred by user and must not be represented as verified.
