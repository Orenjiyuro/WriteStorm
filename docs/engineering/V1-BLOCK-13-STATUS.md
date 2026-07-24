# V1 Block 13 Status

Date: 2026-07-24
Status: In progress through Task 13.6

Current verdict: `Conditional Go — Windows feasibility verified; macOS packaged runtime deferred-by-user.`

| Task | Status | Evidence and boundary |
| --- | --- | --- |
| 13.1 | PASS | Total-thread review accepted the versioned Block 6A Windows feasibility evidence; macOS remains deferred. |
| 13.2 | PASS | SDK/CLI `0.144.6`, Windows platform package `0.144.6-win32-x64`, integrity, dependency tree and Node/Electron/Forge/Vite boundary were revalidated without install or version drift. |
| 13.3 | PASS, sealed and intentionally fieldless | The non-generic `AiExecutionPort` accepts only branded application-owned request/handle types; event is likewise branded for later projection. Codex and SDK types cannot instantiate the port, and the adapter fixes its own frozen capabilities. Validated business schemas/factories remain mandatory in Tasks 13.7–13.9. |
| 13.4 | PASS for build-tree boundary | The production utility uses import-only SDK loading, a fixed launcher and fail-closed unsupported-message behavior. The deterministic offline Electron smoke loads the same production configuration through Vite's public loader, launches the instrumented real entry, observes exit 28, and requires an installed guard with zero network attempts. Negative witnesses prove `net.connect`, `dns.promises.lookup` and direct `node:dns/promises` calls are blocked and counted. Default packaged SDK redistribution/runtime remains Task 13.11. |
| 13.5 | PASS for Windows | Refreshed evidence `block13-task13-5-windows-no-global-git-packaged-001` binds clean runtime HEAD `0f6e3717f622e31ea39a46d6f6b41b5741c945f2`, separate supply-chain (3 files), production-protocol (15 files) and probe-artifact (31 files) fingerprints, and actual artifact/ASAR contents. A fixed synthetic structured turn succeeds while both outer and utility environments cannot resolve Git. |
| 13.6 | PASS for boundary | Main owns the provider-neutral six-state auth vocabulary and an in-memory compatibility-bound observation. Codex accepts only strict actual-runtime observations: authenticated requires fresh compatibility plus a successful execution; `login_required → auth_required`; `auth_failed → unknown`; `unverified → unknown`. `auth_runtime_unavailable` requires the dedicated incomplete-observation kind. `auth_expired` and `permission_denied` remain unverified and have no producer. The utility launcher owns an explicit runtime/auth/proxy/certificate allowlist and excludes API credentials and injection hooks. |
| 13.7 | NOT STARTED | Requires separate authorization. Structured-output application schemas and execution are not implemented by Task 13.6. |

No Task 13 code creates a production AI Job, checkpoint, AnalysisModuleInstance, SQLite migration or renderer AI action. No result is resumable. No fallback provider or direct product `codex exec`/app-server/GUI automation path exists.

The Task 13.4 smoke is offline and deterministic. The Task 13.5 real SDK/auth/network probe is a separate explicit command and is not part of `npm run check`. Its successful turn is dated packaged evidence, not a permanent application connection state. No Task 13.6 product connection check ran, so the application observation remains `unknown`; Task 13.12 owns the future explicit user action. All Task 13.6 mapping fixtures are contract tests only and do not claim that expired, permission-denied, login-required or generic auth-failure scenarios were observed.
