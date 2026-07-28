# WriteStorm

WriteStorm is a local-first Electron desktop tool for writers. It imports long-form source material,
builds reviewable structure and analysis assets, preserves evidence and revision boundaries, and is
designed to support later AI-assisted analysis without treating generated output as automatically
authoritative.

The repository is an active V1 implementation, not a docs-only project.

## Authority entry points

Read these in order:

1. [`docs/engineering/CONTEXT.md`](docs/engineering/CONTEXT.md) — current checked-out implementation
   facts, reproducibility status and active boundaries.
2. [`docs/engineering/DECISIONS.md`](docs/engineering/DECISIONS.md) — accepted product and engineering
   decisions. A decision may define future work and is not implementation evidence by itself.
3. [`docs/engineering/TECHNICAL_DESIGN.md`](docs/engineering/TECHNICAL_DESIGN.md) — target architecture
   plus explicitly identified current implementation contracts.
4. [`docs/product/write-storm-product-design.md`](docs/product/write-storm-product-design.md) — product
   direction and confirmed product boundaries; it is not a current feature-completion ledger.
5. [`docs/tasks/TASK-002-v1-work-breakdown-master-plan.md`](docs/tasks/TASK-002-v1-work-breakdown-master-plan.md)
   — V1 task history and future plan. Historical task wording is not current implementation authority.

## Document classes

| Class | Location | How it may be used |
| --- | --- | --- |
| Current engineering facts | `docs/engineering/CONTEXT.md` active current-state section | Primary entry for what exists in the checked-out implementation |
| Decisions | `docs/engineering/DECISIONS.md` | Accepted direction, including future/unimplemented contracts |
| Product and technical design | `docs/product/`, `docs/engineering/TECHNICAL_DESIGN.md` | Product intent and architecture; completion requires separate implementation evidence |
| Active Block 14 governance | `docs/engineering/V1-BLOCK-14-*.md` | Design review and quality-gate state; currently not a claim of real-AI quality or implementation |
| Block status records | `docs/engineering/V1-BLOCK-*-STATUS.md` | Historical checkpoint evidence unless the active `CONTEXT.md` section explicitly promotes one |
| Task plans | `docs/tasks/` | Plans and historical execution boundaries, not live feature status |
| Approved specifications and ADRs | `docs/superpowers/specs/`, `docs/adr/` | Design/reset rationale; implementation claims still require current evidence |
| Voided records | `docs/voided/` | Retained only for history; never a source of truth |

## Reproducibility rule

A working tree with modified or untracked authority documents is provisional. Do not claim that a
code-and-document state is reproducible until:

- `git status --short --branch` is clean;
- the implementation and its current-state documentation exist in the same commit;
- current migrations, user-visible routes and admitted runtime capabilities agree with
  `docs/engineering/CONTEXT.md`;
- verification results name the exact commit they exercised.

If a historical status file conflicts with current code or the active `CONTEXT.md` section, treat the
historical file as stale and report the contradiction. Do not change a test merely to preserve obsolete
wording.

## Current product boundary

The checked-out V1 foundation includes local Library management, txt/md import, persisted Books,
deterministic structure workflows, analysis-module shells, Jobs/recovery UI, TypeLibrary selection and
bounded Block 13 Codex integration infrastructure. Production AI analysis, generated module content,
TechniqueEntry persistence/editing, export execution and Block 14 quality validation are not complete.

Block 14 currently records design direction only:
`BLOCK14_NOT_FROZEN / QUALITY_UNPROVEN`.
