# V1 Block 13 Status

Date: 2026-07-23
Status: In progress through Task 13.5

Current verdict: `Conditional Go — Windows feasibility verified; macOS packaged runtime deferred-by-user.`

| Task | Status | Evidence and boundary |
| --- | --- | --- |
| 13.1 | PASS | Total-thread review accepted the versioned Block 6A Windows feasibility evidence; macOS remains deferred. |
| 13.2 | PASS | SDK/CLI `0.144.6`, Windows platform package `0.144.6-win32-x64`, integrity, dependency tree and Node/Electron/Forge/Vite boundary were revalidated without install or version drift. |
| 13.3 | PASS, sealed and intentionally fieldless | The non-generic `AiExecutionPort` accepts only branded application-owned request/handle types; event is likewise branded for later projection. Codex and SDK types cannot instantiate the port, and the adapter fixes its own frozen capabilities. Validated business schemas/factories remain mandatory in Tasks 13.7–13.9. |
| 13.4 | PASS for build-tree boundary | The production utility uses import-only SDK loading, a fixed launcher and fail-closed unsupported-message behavior. The deterministic offline Electron smoke loads the same production configuration through Vite's public loader, launches the instrumented real entry, observes exit 28, and requires an installed guard with zero network attempts. Negative witnesses prove `net.connect`, `dns.promises.lookup` and direct `node:dns/promises` calls are blocked and counted. Default packaged SDK redistribution/runtime remains Task 13.11. |
| 13.5 | PASS for Windows | Evidence `block13-task13-5-windows-no-global-git-packaged-001` binds clean runtime HEAD `a8e8961814b9736e5ab3df1ae00224a2972f5eff`, separate supply-chain (3 files), production-protocol (12 files) and probe-artifact (31 files) fingerprints, and actual artifact/ASAR contents. A fixed synthetic structured turn succeeds while both outer and utility environments cannot resolve Git. |
| 13.6 | NOT STARTED | Requires separate authorization. Auth observation and fail-closed mapping are not implemented by Tasks 13.1–13.5. |

No Task 13 code creates a production AI Job, checkpoint, AnalysisModuleInstance, SQLite migration or renderer AI action. No result is resumable. No fallback provider or direct product `codex exec`/app-server/GUI automation path exists.

The Task 13.4 smoke is offline and deterministic. The Task 13.5 real SDK/auth/network probe is a separate explicit command and is not part of `npm run check`.
