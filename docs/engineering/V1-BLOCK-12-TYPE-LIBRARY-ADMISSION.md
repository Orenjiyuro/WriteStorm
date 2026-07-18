# WriteStorm V1 Block 12 TypeLibrary Selection Governance

Date: 2026-07-17

Status: Approved governance override; Tasks 12.6A–12.6D complete through natural Electron acceptance

## Current Verdict

Tasks 12.6A–12.6C are complete for shared governance and the user-confirmed MainType and ContentFocus display names and selection descriptions. D051–D052 approve the K1 identities and fourteen-entry TypeLibraryVersion 1 shared typed release. D053 approves the Book-binding CAS and archive-only lifecycle. D054 implements migration 006 reference facts; D055 implements migration 007 Book-owned binding facts; D056 certifies their complete schema boundary inventory.

There are now four TypeLibrary reference tables, one exact fourteen-entry V1 SQLite seed, `book_type_bindings`, and `book_content_focus_bindings`. D057 adds strict reads; D058 completes main-only CAS mutation orchestration; D059 adds three typed IPC channels and a narrow `typeLibrary` preload namespace. D060 completes Task 12.6D.4: optional import-time selection is part of the source-import transaction, the existing Breakdown shelf exposes user-only selectors and later CAS editing, and Book summaries expose display names only. D061 completes Task 12.6D.5 with real packaged Electron natural-entry evidence across restart. D062 completes Task 12.7 only as a separately authorized disabled renderer shell.

This document and Decisions D047–D061 override the TypeLibrary assumptions in the protected historical master plan and the over-broad classification-review requirements in D046. The protected master plan remains unchanged.

## Product Boundary

Type selection belongs entirely to the user:

- WriteStorm does not automatically classify a Book;
- WriteStorm does not infer a type from source text, metadata, examples, or model output;
- source import may complete without any selection;
- formal analysis requires one selected MainType;
- missing MainType blocks analysis with `missing_main_type`;
- Block 12 does not define entry conditions, positive examples, negative examples, boundary cases, classification corpora, or seven-module effects.

A built-in option needs only enough product semantics for a user to understand the choice and for later methodology work to preserve its intent:

1. display name;
2. one-sentence selection description;
3. explicit `user_only` selection authority and no automatic classification;
4. methodology ownership deferred to Block 14.

Runtime methodology validation belongs to Block 17. Automatic type recognition is outside the current scope.

## Domain Boundary

The two classification dimensions are orthogonal:

- `MainType`: zero or one user-selected primary analysis baseline;
- `ContentFocus`: zero to three user-selected cross-cutting focuses, displayed as “看点标签”.

`ContentFocus` is not a child of `MainType`. It has no parent key, parent foreign key, inheritance relationship, or owning MainType. Its explicit order determines Overlay composition order only and grants no override permission. An incompatible composition blocks with `composition_conflict`.

A focus-only Book configuration is valid metadata and may be saved, reopened, and edited, but it is not analysis-ready. Existing and newly imported Books receive no silent default, upgrade, rerun, rebase, or reinterpretation.

The common hard-gate title is “方法论尚未就绪，不能开始正式分析”. Specific reason codes are `missing_main_type`, `type_definition_version_unavailable`, `methodology_not_ready`, `prompt_not_ready`, `schema_not_ready`, and `composition_conflict`.

## Built-In Option Confirmation

Unconfirmed built-in option proposals are source-controlled planning assets only. They never enter production SQLite, selectors, Book metadata, or a seed. Their minimal status is `proposed | confirmed | deferred`.

A `confirmed` option requires a display name and a user-approved one-sentence selection description. Copy confirmation does not assign a production stable key. A stable key may belong only to confirmed copy and requires a separately approved release set; only that later release makes an option eligible for production seed and Book binding. A `proposed` or `deferred` option has no stable key. Confirmation does not claim methodology or Prompt readiness.

The seven user-confirmed MainType options are:

1. **日轻校园**：以校园、社团为主要舞台，用轻小说式节奏展开青春日常、恋爱喜剧、群像互动或校园中的异常事件，注重人与人之间关系的描写。
2. **日轻异界**：以DQ为蓝本的日式西幻世界舞台，围绕异世界探索、异能\金手指规则、伙伴关系、冒险等内容描写。
3. **现代都市**：以现实社会为舞台，围绕主角拥有的金手指，可能重点描写人际关系互动，也可能重点描写事业经营。
4. **现代幻想**：在现代社会结构中引入修行、怪异、异能、神秘组织等超常体系，重点表现日常现实与隐秘力量世界的交织。
5. **古代幻想**：以中国古代或古典东方世界为基础，通过王朝、宗门、修行、神魔和江湖秩序推动人物成长、权力斗争与世界变局。
6. **西式幻想**：以欧洲中世纪式文明为主要审美基础，围绕帝国、宗教、种族、魔法、战争及文明兴衰展开宏观幻想叙事。
7. **诸天无限**：主角团在不同的世界冒险探索，重点展示不同世界的独特规则\生态，描写对其摸索理解。

The copy-confirmation checkpoint preserved these seven strings without assigning identities. D052 now publishes their approved K1 stable keys, TypeDefinition identities, and V1 TypeDefinitionVersion payloads in `src/shared/domain/type-library-built-ins.ts`; this still creates no SQLite seed row or Book-binding write path.

The first seven user-confirmed ContentFocus options are:

1. **恋爱炒股**：男主和多个女主之间的情感纠葛，女主的塑造是重中之重。主要阅读和不同女主的互动，读者一般有最支持的一名。
2. **英雄史诗**：主角和众人抗争命运、轰轰烈烈的战争。核心看众人如何在高压环境下成长、挣扎。
3. **能力规则**：主要关注不同角色的技能效果、限制、成长，结合情报博弈，不同能力之间如何碰撞出火花。
4. **种田运营**：如何用更高领先的知识引领社会发展，如何分配剧情中获得的资源建设社会。
5. **群像**：主角只是主要视角，但不等于独占剧情分量。重点看不同角色的成长，互相之间由交织出怎样的故事。
6. **事业**：如何运用眼光、金手指等个人资源去发展事业。
7. **冒险探索**：在一个又一个崭新的环境，一点点探索揭露新的情报资讯，努力冒险。重点关注不同的情景\压力设置，和如何突破难关又最终获得什么样的回报。

The copy-confirmation checkpoint preserved these seven strings without assigning identities. D052 now publishes their approved K1 stable keys, TypeDefinition identities, and V1 TypeDefinitionVersion payloads in `src/shared/domain/type-library-built-ins.ts`; this still creates no SQLite seed row or Book-binding write path.

Future user-defined types are separate Library-owned production objects with their own local draft, sample, publication, activation, archive, and version lifecycle. Block 12 provides only an honest disabled shell; custom types do not need to impersonate built-in options or pass a built-in identity process.

## Version Ownership

The following objects remain independent:

- `TypeDefinition`: immutable identity, kind, origin, and built-in stable key where applicable;
- `TypeDefinitionVersion`: versioned display name and one-sentence selection description;
- `MethodologyVersion`: Block 14 Base or Overlay specification tied to an exact TypeDefinitionVersion;
- `PromptTemplateVersion`: independently versioned Base or Overlay Prompt tied to exact definition and methodology provenance.

Changing a display name or selection description creates a new TypeDefinitionVersion. Book classification CAS updates only the Book's current classification target. It never rewrites an existing `AnalysisConfigurationSnapshot` or historical result.

Upgrading breakdown logic creates a new AnalysisConfigurationSnapshot and explicit impact plan. Only actually affected modules may be rebuilt; a complete rerun requires separate explicit confirmation.

## Effective Snapshots

Before formal analysis, deterministic composition creates two immutable snapshots:

- `EffectiveMethodologySnapshot` pins the MainType Base MethodologyVersion, ordered ContentFocus Overlay MethodologyVersions, schemaVersion, and compositionVersion;
- `EffectivePromptSnapshot` pins the MainType Base PromptTemplateVersion, ordered ContentFocus Overlay PromptTemplateVersions, schemaVersion, and compositionVersion.

System schema, safety, evidence, review, and output gates override both. A Book selection may exist before either snapshot is ready, but analysis remains disabled. Upgrades never silently rewrite old Book or analysis snapshots.

## PromptTemplate State Separation

Prompt concepts are separate axes, not one status enum:

- `PromptTemplateRegistryEntry` owns `publishedVersionId` and `activationStatus = enabled | disabled`;
- each immutable `PromptTemplateVersion` owns `sampleGateStatus = not_run | blocked | failed | passed`;
- editing creates a new draft version starting at `not_run`;
- rollback repoints `publishedVersionId` to an earlier immutable version and never creates a `rolled_back` version state;
- existing Book snapshots never change because a registry pointer changes.

Block 12 exposes contracts and blocked reasons only. Real sample execution, publication runtime, and AI behavior remain outside this block.

## Revised Task Breakdown

### Task 12.6A: Selection Governance Contract

Freeze user-only selection, MainType/ContentFocus orthogonality, cardinality, CAS policy, readiness reasons, independent versions, effective snapshots, and Prompt state ownership. This task creates no persistence or product selector.

### Task 12.6B: Seven MainType Option Copy Confirmation

Complete. The seven display names and one-sentence selection descriptions are frozen as one product-copy checkpoint. The checkpoint does not request entry conditions, examples, boundary cases, corpora, automatic classification rules, or module effects. D052 later approved their stable keys and TypeDefinitionVersion 1 payloads as a separate release-set decision.

### Task 12.6C: ContentFocus Option Set

Complete. The first seven built-in “看点标签” names and one-sentence selection descriptions are frozen using the same minimal model. Their explicit order in this admission list is not a Book's selection priority; each Book later chooses zero to three unique options and orders that binding independently. D052 later approved their stable keys; methodology remains a separate Block 14 decision.

### Task 12.6D: Persistence, Binding, And Analysis Gate

After option and persistence admission, implement the natural write/read path in small checkpoints: physical schema and migration witnesses; repository/service CAS; IPC/preload contracts; optional import-time selection; later metadata editing; and natural Electron acceptance. A Book may remain unassigned until analysis. Book summaries expose display-only fields; full version references and snapshots belong to metadata/detail contracts.

### Task 12.6R1: Import Retry Classification Retention

Status: complete as a renderer request-reconstruction repair with natural Electron evidence.

The active Library session retains the user's current import selection. `choose_file`, `choose_smaller_file`, and `retry_import` rebuild the initial request from that retained selection and the current TypeLibrary version. An explicitly empty selection remains unassigned; a non-empty selection is never silently replaced with an empty binding.

Manual encoding retry remains pending token-owned and submits only `pendingImportId` plus `encodingOverride`. Its original classification stays inside the main-side pending token, so renderer cannot replace it during encoding repair. Library replacement clears both ownership scopes.

### Task 12.6R4: CAS Conflict Recovery

Status: complete through the natural renderer path and packaged Electron acceptance.

On `revision_conflict`, the affected Book binding is invalidated and refreshed, but the dirty user draft is never overwritten by the conflict refetch. The editor exposes “Retry my selection”, which sends the preserved draft with the latest refreshed revision, and “Load latest saved classification”, which explicitly replaces the draft with the latest persisted binding. No automatic merge, silent overwrite, schema change, migration, IPC expansion, classifier, methodology, Prompt, or AI behavior is introduced.

### Task 12.7: Custom Type Disabled Shell

Status: complete as a disabled shell.

Block 12 does not create, copy, edit, archive, publish, activate, or rebase custom types. The disabled reason states that local identity, persistence, versioning, sample, and publication flows are not admitted.

The natural TypeLibrary classification editor displays a native disabled “Copy a built-in template to customize” button with an accessibility-linked reason. The shell has no action callback and does not call preload. No custom-type migration, table, seed, repository, service, IPC, or preload method is admitted.

### Task 12.8: PromptTemplate Registry Domain Shell

Status: complete as a metadata-only domain shell.

The strict aggregate freezes registry ownership as registry key + module key + TypeDefinition identity + `base | overlay`. Each version pins exact TypeDefinitionVersion and MethodologyVersion provenance together with distinct `templateVersion` and `schemaVersion` numbers. D077 requires those provenance identities to resolve inside the aggregate and rejects cross-definition, cross-version, and cross-role ownership. The provenance arrays are in-memory validation facts, not production seed or persistence. `sampleGateStatus`, historical publication, the registry's current `publishedVersionId`, and `activationStatus` are separate axes; `rolled_back` is never a version status.

`publishedAt = null` identifies a draft. A non-null publication timestamp is an immutable historical fact, requires a passed sample gate, and must be the same parsed instant as or later than `createdAt`; mixed UTC offsets are compared as instants and equal instants are allowed. The current published pointer must resolve to a historically published version in the same registry. Editing creates a new draft identity, increments `templateVersion`, resets the sample gate to `not_run`, and clears inherited publication history.

No PromptTemplate table, seed, repository, service, IPC, preload, renderer entry, sample execution, publication transition, or AI runtime is admitted. There is no production template key/module/type mapping or template body in Task 12.8. Task 12.10 owns the first minimal Settings/sample-preview entry, Task 12.11 owns constrained publication operations, Task 12.13 owns the broader Settings/AI capability shell, Block 14 owns methodology/template content, and Block 17 owns runtime execution.

Task 12.11R2 closes the edited-draft helper gap without widening that shell. Every edit requires a new version identity, and its `createdAt` must not predate the current version under parsed-instant comparison; equal instants are allowed across equivalent UTC offsets. The helper continues to increment `templateVersion`, reset sample state, and clear publication history without mutating the old version or creating a persistence path.

### Task 12.9: Book Version Snapshot DTO

Status: complete as a contract and test-fixture boundary.

`AnalysisConfigurationSnapshot` is the immutable per-Book version claim. It pins the source classification revision, TypeLibraryVersion, selected TypeDefinitionVersions, EffectiveMethodologySnapshot, and EffectivePromptSnapshot. Effective Prompt provenance is module-complete: all seven authoritative module keys appear exactly once in canonical order, and each module records Base plus ordered Overlay registry/version identities, numeric `templateVersion`, and module `schemaVersion`. The effective composition independently pins `compositionVersion`.

The full snapshot does not widen `BookSummary`. `BookMetadataDetail` independently carries the display-oriented BookSummary, current mutable TypeLibrary binding, and nullable latest immutable AnalysisConfigurationSnapshot. The current binding and latest snapshot may legitimately diverge after classification CAS; reading metadata must expose both rather than rewriting the snapshot to match the current target.

An upgrade is an envelope containing the previous snapshot, a distinct later snapshot, and an impact plan for the same Book. Creation chronology is determined from parsed instants across mixed UTC offsets, not from ISO source-string order; equal instants are rejected. A selective rebuild must exactly equal the affected module set. Rebuilding all seven modules requires `completeRerunConfirmed = true`. Registry pointer changes, template publication, or TypeLibrary upgrades never mutate either snapshot in the envelope.

No analysis-configuration migration, table, repository, service, IPC, preload, renderer read path, or production snapshot producer is admitted. The source-controlled DTO fixture uses synthetic Prompt identities only as validation data; it is not a template seed or production mapping. Persistence remains blocked until methodology, concrete Prompt mappings, snapshot-creation ownership, and the formal-analysis transaction are admitted.

### Task 12.10: Sample Preview Blocked Entry

Status: complete as a natural-path blocked shell.

The minimal top-level Settings route exposes Templates & schemas after a Library is open. Its sample-preview card shows `status = blocked`, a native disabled “Run sample preview” action, and the exact blocker codes `codex_sdk_gate_required`, `prompt_template_instance_unavailable`, and `sample_preview_runtime_not_admitted`. This is a product route rather than Diagnostics readout and it performs no query on entry.

The same card states the publication hard gate: a template version cannot be published until its sample preview status is `passed`. This statement does not create a publish action or state transition; Task 12.11 owns that constrained shell. The preview component accepts no action callback and calls neither preload nor IPC.

No sample Job, fixture execution, Prompt body, SDK call, provider call, AI output, persistence, IPC, or preload method is admitted. Task 12.10 does not claim that the early Codex feasibility gate passed. Real sample preview remains blocked until Block 17; Task 12.13 extends the Settings route without weakening this gate.

### Task 12.11: Publication Controls State Machine Shell

Status: complete as a natural-path constrained state-machine shell.

The shared pure policy freezes the only three operations as `publish`, `rollback`, and `disable`. It resolves all lifecycle facts from a validated `PromptTemplateRegistryAggregate` instead of duplicating sample, publication, or activation fields in a weaker state model. Publish requires a draft and `sampleGateStatus = passed`. After the first publication, D078 additionally requires a strictly larger `templateVersion`; otherwise permission returns `draft_version_not_newer`. The compound preview records its immutable `publishedAt` fact before repointing the registry, requires that fact to equal or follow the current publication instant, and reparses the complete aggregate.

Rollback is an operation that repoints the current published version to a distinct historically published target version with a smaller `templateVersion` and never creates a `rolled_back` status. Unknown or draft targets return `rollback_target_not_published`; a same or newer target returns `rollback_target_not_earlier`. Successful rollback clears the selection rather than treating the previously current newer version as a rollback target. Disabling retains the current published pointer and only changes activation. Every successful preview preserves provenance and produces another aggregate-valid value; blocked previews return their exact input unchanged.

The current shell truthfully contains no PromptTemplate aggregate, draft selection, rollback selection, or admitted persistence. Settings therefore renders three native disabled actions with accessibility-linked reasons and exact blocker codes. The renderer component has no callback, query, preload call, or IPC path. Synthetic aggregate previews exist only in focused domain tests and perform no write.

No migration, table, repository, service, IPC, preload method, template instance, or Book snapshot mutation is admitted. Publication timestamps, real pointer transactions, authorization, and runtime execution remain owned by Task 17.13.

### Task 12.12: Original Shelf Independent Placeholder

Status: complete as a natural-path non-creating placeholder.

The top-level product navigation exposes an independent Original shelf after a Library is open. The page shows no project instances and renders “Create original project” as a native disabled action with an accessibility-linked reason. The route receives the current Library summary only for display context, accepts no action callback, and enables no Breakdown-only query or Job polling.

The Original shelf does not render Technique Library entries, candidates, SourceSnapshots, or adoption/editing controls. It does not reuse Breakdown Book evidence as mutable original-project facts. No OriginalBook, original-project table, repository, service, IPC, preload method, or creation handler is admitted. Task 12.12 adds no filesystem, SQLite, shell, Codex SDK, provider, AI-output, or generated-content capability.

### Task 12.13: Settings And AI Unavailable Shell

Status: complete as a natural-path non-executing capability shell.

The existing Settings route truthfully displays `Codex SDK gate = Required` and `Connector = Unavailable` without probing either runtime. Templates, schemas, repair, and health appear as native disabled entry placeholders with visible ownership reasons. Entering Settings continues to enable no Breakdown-only query or Job polling.

Task 12.15 now owns the `local_only` policy and disabled recent-error, cleanup, and manual-export shell. Block 18 owns actual Library health scans and repair. Template production management and schema inspection remain unadmitted. No SDK probe, connector discovery, health scan, repair, schema inspection, log read, log write, or template mutation is implemented. Task 12.13 adds no migration, table, repository, service, IPC, preload method, privileged renderer access, SDK/provider dependency, credential access, AI output, or generated content.

### Task 12.14: Cross-Domain Boundary Gates

Status: complete as four executable non-capability gates.

The consolidated focused suite reuses existing authoritative contracts rather than introducing a duplicate Block 12 policy object. TechniqueEntry must keep SourceSnapshot provenance readonly and has no source/evidence/observation mutation channel. OriginalReferenceSnapshot remains non-creating and the Original route exposes no creation callback or product channel. AnalysisConfigurationSnapshot upgrades still require a distinct immutable snapshot, explicit impact plan, selective affected-module rebuild, and explicit confirmation before a complete rerun.

The renderer import scanner parses every production renderer source file, including ESM imports/exports, dynamic imports, and CommonJS `require()`, and rejects Node built-ins, Electron, SQLite, secure-storage, Codex/provider packages, and relative imports into main, preload, or utility-process code. Product IPC vocabulary independently rejects AI, secret, credential, token, secure-storage, filesystem, logging/telemetry, and shell channels. Synthetic forbidden imports and channels prove the scanners are non-vacuous positive rejection witnesses.

Task 12.QA-R2 closes naming and syntax bypasses with explicit rejection witnesses for `technique-library:update-source`, `logging:upload`, `templates:bulk-upgrade`, AI/FS aliases, Original creation aliases, crash/telemetry namespaces, and CommonJS `require()`. The remediation changes only executable gates and governance evidence; it adds no production channel or capability.

Task 12.14 adds no product capability, migration, table, repository, service, IPC, preload method, UI control, SDK/provider dependency, Original project, Technique persistence, template mutation, snapshot persistence, or rerun execution.

## Acceptance Boundary

- Users choose types; the application never auto-classifies or infers them.
- Import works without selecting a type.
- Formal analysis blocks without a MainType and reports exact readiness reason codes.
- MainType and ContentFocus have no parent-child persistence relationship.
- Focus-only metadata and zero to three unique ordered ContentFocus references are valid.
- Unconfirmed options have no production identity, stable key, seed row, selector entry, or Book binding.
- TypeDefinitionVersion stores selection semantics, not methodology rules or classification evidence.
- EffectiveMethodologySnapshot and EffectivePromptSnapshot independently pin exact versions.
- Prompt sample, publication, activation, and rollback remain separate concepts.
- Task 12.7 is complete as a disabled shell.
- Task 12.8 is complete as a metadata-only PromptTemplate registry domain shell.
- Task 12.9 is complete as an immutable snapshot contract and DTO fixture only.
- Task 12.10 is complete as a natural Settings sample-preview blocked shell.
- Task 12.11 is complete as a natural Settings publication-controls state-machine shell.
- Task 12.12 is complete as an independent Original shelf non-creating placeholder.
- Task 12.13 is complete as a natural Settings non-executing capability shell.
- Task 12.14 is complete as four executable non-capability gates.
- Task 12.15 is complete as a natural `local_only` observability shell and final boundary acceptance under D070. Clear and export remain disabled under `local_log_clear_not_admitted` and `manual_log_export_not_admitted`.
- Final acceptance verifies the absence of Technique production tables; it does not reinterpret the blocked/deferred Task 12.1 repository/service target as implemented.
- No real AI, sample execution, automatic rebase, or silent snapshot upgrade is introduced.

## Task 12.6A Evidence

`src/shared/domain/type-library.ts` provides strict schemas and pure policies for minimal built-in option confirmation, user-only selection, independent definition/methodology/Prompt versions, focus-only Book targets, current-target-only CAS, immutable effective snapshots, exact readiness blockers, and Prompt draft sample reset.

The corrected RED failed because the old contract still required classification-review fields. GREEN passes the seven focused governance tests. Task 12.6A creates no TypeLibrary production record, stable key, table, seed, migration, repository/service, IPC, renderer flow, Prompt execution, or AI runtime.

Task 12.6B RED failed because confirmed copy still required a stable key and the seven-option typed asset did not exist. At that copy-only checkpoint, GREEN preserved all seven user strings, confirmed `user_only` selection, rejected classifier fields, and left every stable key null. D052 later superseded only the null-key release state by publishing approved identities; it did not create persistence.

Task 12.6C RED failed because the seven ContentFocus typed asset, D049, and completed plan state did not exist. At that copy-only checkpoint, GREEN preserved all seven user strings, confirmed `content_focus`, left every stable key null, and added no methodology or automatic classification behavior. D052 later published approved identities without adding methodology or persistence.

Task 12.6D.1B RED rejected missing or duplicate identities, copy drift, wrong kinds, incomplete release membership, and methodology/Prompt leakage. GREEN publishes the approved K1 identities and fourteen-entry TypeLibraryVersion 1 in the shared typed registry. D053 additionally freezes no-row revision 0, first-write revision 1, retained empty binding rows, Book-owned cascade, and archive-only definition/version/release retirement. No SQLite object is created.

Task 12.6D.1C checkpoint 1 RED failed because the migration registry ended at 005 and the four reference tables did not exist. GREEN adds migration 006 with migration-local historical seed literals, 14 definitions, 14 definition versions, one release, 14 release entries, foreign-key kind/version ownership, unique per-kind order, archive-only retirement, immutable version/release triggers, and two-sided semantic witnesses. It creates no Book binding table or product write path.

Task 12.6D.1C checkpoint 2 RED failed because the migration registry ended at 006 and both Book binding tables were absent. GREEN adds migration 007 with absent-row semantics for unassigned Books, first-write revision 1, exact single-step revision increments, nullable paired MainType references, zero-to-three unique ordered ContentFocus rows, pinned-release/kind validation, and Book-owned cascades. It adds no callable mutation path.

Task 12.6D.1C checkpoint 3 RED exposed two fact-layer bypasses: direct binding deletion could return a Book to revision 0, and a published V1 release could accept a fifteenth membership. GREEN rejects direct delete while the Book exists, preserves Book cascade, seals release membership at immutable declared `entry_count`, proves priority-gap fail-closed behavior, and records the DB/service responsibility matrix in `V1-BLOCK-12-TYPE-LIBRARY-SCHEMA-INVENTORY.md`.

Task 12.6R5 closes archive retirement semantics. Migration 006 permits only a one-way archive from null to one immutable timestamp. Current selectors exclude archived definitions and derive dense effective order, including an empty selector when every option is retired. New binding writes reject archived references, while historical pinned Book bindings remain readable and immutable release membership remains complete.

## Open Inputs

- Custom-type identity, persistence, version, sample, publication, activation, archive, and rebase contracts remain unadmitted after the Task 12.7 disabled shell;
- PromptTemplate production keys, module/type mappings, seed membership, bodies, persistence, executable publication operations, and runtime remain unadmitted after the Task 12.11 non-executing state-machine shell;
- AnalysisConfigurationSnapshot persistence, latest-pointer ownership, creation transaction, detail read path, and impact-plan execution remain unadmitted after the Task 12.9 contract fixture;
- Sample fixture ownership, preview Job/runtime, SDK/provider execution, result persistence, and any passed sample status remain unadmitted after the Task 12.10 blocked shell;
- Block 14 methodology content;
- Block 17 runtime validation.

These remaining product or admission decisions must not be invented during implementation. Task 12.6 persistence, CAS, import integration, IPC/preload, renderer, and natural Electron acceptance are complete and are not open inputs.
