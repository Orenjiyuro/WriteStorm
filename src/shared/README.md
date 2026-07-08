# Shared Contracts

Current status: Block 2 Tasks 2.1-2.9 have added shared domain IDs/unions/DTOs, stable `DomainError`, Zod IPC contracts for the product allowlist, and the shared `WritestormApi` preload type.

Rules:

- Shared code must stay serializable and process-neutral.
- Shared code must not import Electron, Node privileged modules, SQLite packages, React/React DOM, Codex packages, or main/preload/renderer source.
- Product contracts describe request/response envelopes only. They do not implement LibraryService, BookService, import, SQLite, AI, or UI behavior.
- Task 2.10 boundary tests may verify shared/renderer/registry/preload consistency, but a Block 2 completion claim still requires explicit total-thread authorization and fresh verification.
