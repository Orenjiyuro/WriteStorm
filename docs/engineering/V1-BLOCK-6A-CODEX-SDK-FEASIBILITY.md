# WriteStorm V1 Block 6A Codex SDK Feasibility

Date: 2026-07-19

Verdict: `pending recertification — historical Windows-only conditional Go expired for the current working tree; macOS deferred-by-user`

## Authority and scope

This document is the current authority for Task 6A.1 through Task 6A.8b and the subsequent remediation. Tasks 6A.1–6A.8b record the original spike and its historical Windows-only conditional verdict. R1–R7 subsequently changed admission, environment, protocol, supervision, process ownership, cleanup, error classification, assertion provenance and evidence lineage behavior. Those changes trigger the recorded expiry conditions, so the current working tree is pending fresh R8 recertification.

V1 admits Codex SDK only. WriteStorm has a long-term multi-provider direction, but this task does not install, implement or call Claude, DeepSeek or another provider, and it never uses another provider as fallback. It does not implement a production `AiExecutionPort`, provider registry, Job integration, Settings connection flow, renderer AI action, Prompt runtime, module body generation or real breakdown pipeline.

The probe uses only fixed, short, non-sensitive synthetic input. Repository source, Library contents, user manuscripts, prompts from production, secrets and credential material are outside the probe input boundary.

macOS packaged runtime evidence is `deferred-by-user`. The pending Windows status is not a full Go and does not claim current Windows verification, cross-platform compatibility, macOS verification or release readiness.

## Evidence record format

Every committed evidence item is a sanitized JSON summary with this minimum shape:

```json
{
  "schemaVersion": 1,
  "evidenceId": "block6a-task-source-sequence",
  "task": "6A.x",
  "source": "static_manifest",
  "recordedAt": "RFC3339 timestamp",
  "commandName": "stable command name only",
  "classification": "stable non-sensitive classification",
  "versions": {},
  "assertions": {
    "assertionName": {
      "value": true,
      "source": "static_manifest",
      "evidenceId": "supporting-evidence-id",
      "classification": "supporting-classification"
    }
  }
}
```

The closed provenance vocabulary is:

`source = real_sdk | packaged_sdk | local_validator_fixture | static_manifest`

Sanitized JSON summaries are committed. Exact package/runtime versions, stable classifications, provenance-bearing boolean assertion leaves, command names and timestamps may be committed. Every fresh assertion is exactly `{ value, source, evidenceId, classification }`; it must not upgrade static or fixture evidence into a real SDK claim.

Prompts, complete stdout/stderr, environment values, credentials, auth files, and raw temporary PID logs are not committed. Tokens, cookies, request headers, secrets, source snippets and user content are never printed, exported or stored as evidence.

PID values may appear only inside one probe run as `ephemeral_correlation_only`. They are not stable identity, are never compared across runs and are not treated as a durable product fact. Durable summaries retain the probe run id, ownership checks, graceful/forced classification, cleanup acknowledgement and residual-process boolean; raw process enumeration logs remain temporary and uncommitted.

## Supply-chain acceptance

Task 6A.2 is the only task authorized to install the exact approved SDK after its pre-install audit. It must use the official npm registry, `--save-exact` and `--ignore-scripts`.

Lockfile may contain all official optional platform records. That is dependency-resolution metadata, not proof that every platform binary is installed or packaged. On the Windows x64 target, actual `node_modules` and packaged resources may contain only the required Windows binary and required project-local OpenAI runtime. Unrelated platform binaries in the Windows package fail the gate.

Task 6A.2 must discover and record the actual project-local CLI path. Task 6A.4 must consume that evidence for its Forge allowlist and ASAR unpack rules; neither task may guess the path, depend on `%PATH%`, or use a globally installed Codex.

Task 6A.2 stops for new authorization if it finds an unexpected provider, native addon, `preinstall`/`install`/`postinstall`, version drift, Node conflict, unrelated lockfile rewrite or packaged-platform contamination.

## Task 6A.3 installed SDK runtime semantics

Task 6A.3 records two deliberately different evidence classes in `docs/engineering/evidence/block6a-task6a3-runtime-semantics.json`: installed-package inspection is `static_manifest`, while the local Node import is `real_sdk` with classification `esm_import_only_no_turn`. The latter is not a real model turn and must never be cited as structured-output, auth, cwd, cancellation or packaged-runtime success.

The official sources used for this classification are:

- OpenAI Codex SDK documentation: <https://learn.chatgpt.com/docs/codex-sdk>
- The official TypeScript SDK source location named by that documentation and by the package manifest: <https://github.com/openai/codex/tree/main/sdk/typescript>
- The exact installed `@openai/codex-sdk@0.144.6` manifest, declarations and distribution code resolved from the official npm tarball recorded in `package-lock.json`
- Node child-process documentation for `spawn` pipes and `AbortSignal`: <https://nodejs.org/api/child_process.html#child_processspawncommand-args-options>

### Public server-side ESM API

OpenAI documents the TypeScript SDK as a server-side library requiring Node 18 or later. The installed 0.144.6 manifest declares `type: module`, exposes an ESM import at `dist/index.js`, and exposes declarations at `dist/index.d.ts`. On Windows x64, Node 24.14.1 successfully imported the installed package, constructed `Codex`, created a `Thread`, and resolved the executable inside this project's `node_modules/@openai/codex-win32-x64` package without calling `run()` or `runStreamed()`.

The public declarations expose `Codex.startThread()` and `resumeThread()`, buffered `Thread.run()`, streamed `Thread.runStreamed()`, `ThreadOptions.workingDirectory`, `ThreadOptions.skipGitRepoCheck`, and per-turn `outputSchema` and `AbortSignal`. This establishes API availability only. Node 24 runtime import verified; Node `>=22.12.0` remains static manifest compatibility and Node 22 runtime not exercised.

### SDK-owned CLI and JSONL mechanism

The installed SDK resolves its pinned platform package and spawns that project-local native executable. Its SDK-owned implementation mechanism supplies `exec --experimental-json`, writes the input to the child stdin, reads stdout line by line, parses each line as JSON, and maps the resulting JSONL events into `ThreadEvent` values. `workingDirectory` maps to the CLI `--cd` argument. `outputSchema` is serialized to a temporary schema file, passed through `--output-schema`, and deleted in a `finally` cleanup. The per-turn signal is passed to Node's `spawn` options.

These observations explain the SDK's internal contract; WriteStorm does not own or reimplement that JSONL protocol. Node documents that aborting a signal passed to `spawn` requests child-process termination and reports an `AbortError`, but this static/API evidence does not prove cancellation cleanup or absence of orphan processes. Task 6A.7 must verify the attributed Windows process tree and two-stage cleanup in practice.

The installed SDK may include an unparseable JSONL line or collected CLI stderr in a thrown error message. That raw error can contain sensitive or unstable content. The feasibility utility/main boundary must map it immediately to an approved stable classification and must not persist or forward the raw SDK error message to renderer DTOs, logs or committed evidence.

### Product boundary and remaining limitations

The official SDK invoking its pinned CLI is an internal OpenAI implementation detail behind the admitted SDK API. It is not permission for a WriteStorm product fallback. WriteStorm must not spawn `codex exec` directly, parse Codex JSONL in main/renderer code, search `%PATH%`, use a global Codex installation, or switch to direct CLI execution when the SDK fails. Task 6A.4 must keep the SDK import inside the dedicated utility and externalize/package the exact project-local runtime.

No authenticated model turn ran in Task 6A.3. No prompt or user content was supplied. Default or explicit cwd behavior, Git checks, auth classification, structured-output acceptance, abort effects, residual processes, Electron utility execution and packaged execution remain unverified. `outputSchema`, `workingDirectory` and `AbortSignal` are therefore recorded as available SDK mechanisms, not as completed feasibility outcomes.

## Task 6A.4 utility boundary and packaging rules

Task 6A.4 implements only a feasibility harness. It does not register product IPC, alter the preload bridge, expose a renderer action, integrate Job/Pipeline code, or run a prompt. The main-side `CodexFeasibilityRunner` forks a dedicated Electron utility entry and accepts only a strict versioned `inspect-runtime` then `shutdown` exchange. The protocol contains stable versions, booleans, package versions, an ephemeral utility PID and closed error codes; prompt, auth, token, environment, raw SDK objects, stdout and stderr fields are rejected.

The dedicated `src/main/codex-feasibility/utility-entry.ts` is the only application source allowed to import `@openai/codex-sdk`. Its inspection command imports and constructs the SDK client, verifies that the SDK-resolved executable belongs to the installed platform package, and returns only the sanitized inspection shape. It never calls `Thread.run()` or `runStreamed()`. The main runner requests an explicit shutdown, waits for cleanup acknowledgement and a normal utility exit, and maps utility failures to stable messages without forwarding raw errors. These unit-tested lifecycle mechanics cover an SDK-free inspection only; they are not Task 6A.7 cancellation or CLI cleanup evidence.

The Codex utility Vite configuration externalizes both `@openai/codex-sdk` and `@openai/codex`. A fresh direct Vite build retained the external SDK import and did not inline `CodexExec` or the CLI JSONL implementation. A separate fresh renderer build contained no OpenAI SDK reference, Node filesystem/child-process import, raw environment access or secret-bearing runtime identifier. Source guards independently cover renderer, preload, shared, `PRODUCT_IPC_CHANNELS` and the preload exposure, with positive rejection witnesses for each rule class.

Forge's package allowlist now admits only the exact project-local SDK, CLI wrapper and `@openai/codex-win32-x64` package on the current Windows target. ASAR unpack preserves the existing native `**/*.node` rule and adds the complete discovered `node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/**` target, including `codex.exe`, companion executables, `rg.exe`, resources and `codex-package.json`. It does not allowlist another Codex platform package or a global installation.

The package guard at `tests/verification/block6a-codex-package-boundary.test.ts` scans packaged renderer resources, rejects platform contamination, and requires all six Windows target runtime files under `app.asar.unpacked`. Task 6A.4 itself did not create or inspect an Electron package; Task 6A.8a later supplied the required packaged renderer, ASAR placement and real Electron SDK execution evidence. macOS package rules and runtime remain `deferred-by-user`.

### R2 remediation: utility base environment and SDK overlay

The official TypeScript SDK documentation states that `Codex({ env })` replaces inherited `process.env` as the CLI base environment, while the SDK still overlays variables required by its implementation: <https://github.com/openai/codex/blob/main/sdk/typescript/README.md#controlling-the-codex-cli-environment>. Therefore WriteStorm does not claim that the final CLI environment contains only its allowlist. The committed `static_manifest` record is `docs/engineering/evidence/block6a-remediation-r2-environment-boundary.json`; it contains key names and booleans only, never environment values.

The shared WriteStorm utility allowlist contains only Windows runtime/profile keys, the ChatGPT-managed auth location (`CODEX_HOME`), proxy/CA keys, and the two approved ephemeral synthetic-input controls. All other parent keys—including API credentials, unrelated provider credentials, `NODE_OPTIONS`, arbitrary secrets and result/path orchestration controls—are omitted before Electron forks the third-party SDK utility. The CLI base is narrower again: it omits both synthetic controls and retains only the runtime/profile/auth/proxy/CA keys. Isolated-auth mode fails closed unless it receives an explicit temporary `CODEX_HOME`.

The locked `@openai/codex-sdk@0.144.6` installed source has exactly one unconditional overlay key, `CODEX_INTERNAL_ORIGINATOR_OVERRIDE`; it has one conditional `apiKey`-option overlay key, `CODEX_API_KEY`; and automatic development CLI resolution may prepend the platform-package directory to the existing `PATH`. WriteStorm never supplies the SDK `apiKey` option, so `CODEX_API_KEY` is not claimed as present in an actual WriteStorm run. Packaged Windows execution supplies `codexPathOverride`, while development resolution may perform the documented `PATH` mutation. A focused source guard extracts these names from the installed locked package and fails if they drift. Fresh real and packaged execution under this repaired environment remains an R8 requirement; this R2 static evidence does not recertify those turns.

### R3a remediation: typed operation descriptor

The feasibility protocol now exposes command-indexed request payload and response types. A closed operation registry owns the seven wire operations—runtime inspection, capability probe, outputSchema probe, lifecycle start/cancel, timeout cancel and shutdown—including their command, runner phase, exact payload-key list and sanitized failure classification. Both runner and utility dispatch reference that registry. The shared request builder re-validates every constructed request through the strict protocol schema, and the response matcher requires both the descriptor command and the operation-specific request id.

This change removes handwritten command/request matching drift only. It does not claim that the current runner is the Task 13/17 production adapter, and it does not yet unify per-supervisor single-flight, settlement, termination or cleanup state. Those remain explicit R3b and R4b requirements; no Job, renderer, Prompt or product AI capability is added here.

### R3b remediation: per-session supervision and single settlement

Each runner invocation now owns exactly one `CodexFeasibilitySessionSupervisor`. The supervisor is the sole owner of the primary session state: created, one active operation, operation settled, explicit lifecycle continuation, shutdown active/acknowledged, utility exit, and one final completed or failed settlement. It rejects a second operation while one is active, a response that does not belong to the active descriptor and request id, a utility PID change within the session, lifecycle cancel without the explicit `await-trigger` continuation, shutdown before operation settlement, exit before cleanup acknowledgement, and any second final settlement. Its sanitized snapshot retains state, phase, counts and booleans only; it never retains request payloads or response bodies.

The four feasibility entry points no longer keep independent `settled`, `phase`, utility-PID or cleanup-acknowledgement variables. R3c additionally routes inspect, capability, outputSchema and lifecycle through one typed `runUtilitySession` orchestration. That single driver owns Promise settlement, utility spawn binding, guarded sends, response validation, shutdown acknowledgement, exit observation and listener disposal; the three one-step probes also share `runSingleOperation`. Lifecycle contributes only its typed start/await-trigger/cancel continuation. A static test freezes one Promise and one spawn/message/exit listener set so orchestration cannot silently fork again. R3b/R3c do not establish runtime cleanup evidence; the later R4b repair below supplies termination coordination. None of these remediations recertifies lifecycle cleanup by itself or makes this feasibility runner a production Task 13/17 adapter.

## Process ownership and residual checks

The approved boundary is a dedicated Electron `utilityProcess`. Renderer and preload gain no AI execution surface. Main owns the typed feasibility protocol, timeout/cancel/lifecycle supervision and process attribution. Utility is the only source location allowed to import `@openai/codex-sdk`; the SDK launches its official project-local CLI.

Residual checks associate the current probe by an exact utility identity and an observed utility-to-CLI parent chain. Every identity binds PID, parent PID, creation time and executable path; PID alone is never identity. Global process-name matching is not ownership evidence and must not be used to classify or terminate processes. Never terminate a Codex process whose ownership by the current probe is not proven.

### R4a remediation: session-owned Windows process attribution

The lifecycle observer now uses one `WindowsOwnedProcessTracker` per probe. The utility must have the PID returned by that session, the expected Electron executable path and a creation time inside the probe observation boundary. The CLI must have the exact project-local executable path and an unambiguous parent chain whose every observed link has one PID record, a complete PID/parent-PID/creation-time/path identity and non-decreasing parent-to-child creation time. A stale utility, unrelated CLI, duplicate PID observation, incomplete chain or multiple attributed CLI candidates fails closed.

Once the tracker has observed a complete utility-to-CLI relationship, it freezes those exact identities for that session. A later process with a reused PID, different creation time, different path or different parent is not substituted for the owned process. Residual checks compare only the frozen exact identities. Persisted evidence receives derived booleans only; PID, path, process lists and parent-chain values remain ephemeral and uncommitted. The `static_manifest` repair record is `docs/engineering/evidence/block6a-remediation-r4a-process-ownership.json`.

R4a changes attribution only; it did not itself implement termination. The lifecycle admission contract now requires the new identity/relationship/freeze booleans, so the prior persisted lifecycle evidence remains historical and cannot be reused as fresh R8 evidence. Fresh Windows lifecycle execution is required after R4b; no process may be terminated by name or without this session ownership proof.

### R4b remediation: unified safe termination

All four runner entry points now delegate timeout and abnormal termination to one `CodexFeasibilityTerminationSupervisor`. Invalid protocol data, command/request mismatch, utility-PID mismatch, malformed shutdown response, unexpected utility exit and `waitForTrigger` rejection no longer reject first or call `child.kill()` directly. The coordinator preserves the original stable failure classification while it requests the typed `cancel-active-probe`, waits for its abort/SDK-settlement response, requests typed shutdown, waits for cleanup acknowledgement and observes utility exit. Only then does the caller receive the sanitized failure plus termination summary.

Normal session traffic also crosses one guarded `sendSessionMessage` boundary. The unified session driver is the only runtime caller; operation-specific code supplies typed request factories and cannot invoke `postMessage` directly. A synchronous request-construction or transport exception is discarded rather than logged or propagated, classified conservatively as the fixed sanitized `crash` failure, and handed to the same termination coordinator. The runner retains one mechanically checked `child.postMessage` location: the guarded boundary itself.

If cancel acknowledgement does not arrive, shutdown is still attempted as the utility's second cooperative cancellation boundary; the missing cancel/settlement assertions remain false. If shutdown or exit grace then expires, the coordinator rechecks the R4a exact utility identity. It calls the session-owned utility handle's `kill()` only when that exact utility is still proven; absent or conflicting ownership fails closed without killing. The coordinator never terminates the CLI, never searches by process name and never touches an unrelated Codex process.

Every abnormal result performs the attributed residual scan after an observed exit or after the safe escalation attempt. `graceful` requires abort request/observation, SDK settlement, cleanup acknowledgement, utility exit, ownership observation and both utility/CLI residual absence. `forced` additionally records ownership proof and the owned-handle kill attempt. Missing ownership, exit or residual proof is `unverified` and cannot pass recertification. The only application-source `kill()` is inside this coordinator behind the ownership check; runner entry points contain none.

The reusable `WindowsOwnedProcessGuard` is supplied to development capability, outputSchema, lifecycle and packaged probes. It begins observation from the session's spawned utility, caches one post-exit residual scan and retains no PID, path or process list in evidence. The `static_manifest` record is `docs/engineering/evidence/block6a-remediation-r4b-safe-termination.json`.

R4b is a structural and unit-tested repair, not fresh SDK evidence. The older Task 6A.7 and packaged results predate this coordinator and remain historical. R8 must rerun Windows lifecycle and packaged probes against the final code and evidence lineage before the fixed candidate verdict can be reissued.

The graceful cleanup protocol is:

1. Main sends a typed cancel, close or timeout `cancel-active-probe` message.
2. Utility aborts the SDK turn through its `AbortController`.
3. Utility waits for the SDK promise or stream to settle.
4. Utility reports whether abort was observed and the SDK promise settled.
5. Main requests shutdown; utility sends a cleanup acknowledgement and exits normally.
6. Main waits for actual utility exit before returning success or timeout failure.
7. The lifecycle observer verifies both attributed CLI and utility identities have no residual instance.

Main may force-kill only its proven utility process after the cancel or shutdown grace period. It must still wait for an exit observation and record `graceful | forced`, AbortController request/observation, SDK settlement, shutdown acknowledgement and utility-exit status. A forced result without actual utility exit, cleanup acknowledgement or an attributed CLI residual scan fails closed; no CLI is terminated directly. The successful Task 6A.7 runner-timeout evidence completed gracefully and therefore did not manufacture the unsafe forced-fallback state.

## Runtime, cwd and auth classification

Runtime evidence must separate actual execution from manifest compatibility. The current planned environment may verify development Node 24 and Electron 43 embedded Node 24. Node `>=22.12.0` remains static manifest compatibility only unless a real Node 22.12+ probe is executed.

Cwd probes distinguish SDK default behavior from the recommended product constraint. The formal path must explicitly use an isolated temporary Git workspace. It must not use the WriteStorm source repository, a user Library root or packaged resources as working directory. Git, non-Git and `skipGitRepoCheck` behavior require separate evidence.

Auth classification is closed to:

`authenticated | login_required | auth_failed | unverified`

An authenticated successful SDK return is a stable execution fact. In the locked 0.144.6 wrapper, Git, login, expired-session and CLI non-zero failures do not reach WriteStorm with a stable structured error code: `Thread.run()` reduces `turn.failed` to a message-only `Error`, and non-zero CLI exit combines stderr into another message-only `Error`. The repaired feasibility classifier does not inspect either message. Such failures are conservatively `runtime_failed / unverified`; `login_required`, `auth_failed` or `git_repo_required` may be emitted in a future runtime only after a separately audited stable structured signal exists. An isolated empty `CODEX_HOME` remains a required scenario, but failure there is not upgraded into a specific auth fact without such a signal. Unsafe-to-manufacture expired state remains `unverified`.

A real success probe is blocked when authenticated state is unavailable. Task 6A.5 found current authenticated state and therefore allowed Task 6A.6 to proceed; Task 6A.8a later obtained a fresh authenticated packaged success. A future rerun that lacks authentication must fail closed rather than reuse either result as a durable credential fact.

### R5 remediation: conservative error classification

The committed `static_manifest` record is `docs/engineering/evidence/block6a-remediation-r5-error-classification.json`. It distinguishes four boundaries mechanically in code: a successful SDK return proves only that run's authenticated success; the AbortController path recognizes the structured `AbortError` name; `validateMinimalStructuredOutput` owns stable local `invalid_json | missing_field | extra_field | accepted` contract results; and every other unstructured SDK/CLI failure becomes `runtime_failed / unverified`. Raw errors, messages and stderr are neither propagated nor persisted.

#### R5b pinned SDK error-signal audit

The exact installed `@openai/codex-sdk@0.144.6` package was audited at its manifest, exported declarations and compiled implementation. Its exported `ThreadError` and top-level `ThreadErrorEvent` contain only `message: string`; `Thread.run()` throws a new plain `Error` from `turn.failed.error.message`; and a non-zero CLI exit becomes another plain `Error` composed from exit detail and stderr. No exported code, status, category or discriminant survives for Git/auth classification. A focused test reads those exact installed files and expires when the pinned version or shapes change. The official SDK README confirms the SDK/CLI JSONL boundary, while the official `events.ts` and `thread.ts` sources corroborate the message-only public model: <https://github.com/openai/codex/blob/main/sdk/typescript/README.md>, <https://github.com/openai/codex/blob/main/sdk/typescript/src/events.ts>, and <https://github.com/openai/codex/blob/main/sdk/typescript/src/thread.ts>. The installed 0.144.6 package is the version-specific primary source; current `main` links are corroboration only. Therefore `git_auth_structured_classification_unavailable` is a proven compatibility limitation, not a transient test omission, and remains a closed recertification blocker for this pinned version.

The invalid outputSchema probe is deliberately narrower. The exact installed version must be 0.144.6, the closed scenario must be `invalid-schema`, the fixed internal schema value must be a non-object array, and the SDK call must reject. Only that conjunction records the historical-compatible `invalid_schema_rejected` feasibility outcome. It does not compare or retain the SDK's English message, is not an auth/runtime business error, and expires on any SDK version, integrity or local-guard change.

Evidence validation and recertification admission are separate states. A fresh development record with the exact five scenarios, sanitized envelope and conservative `runtime_failed / unverified` Git/auth outcomes is `evidenceAccepted: true` so the real limitation is retained rather than discarded. It is simultaneously `recertificationAdmitted: false` with the closed blocker `git_auth_structured_classification_unavailable`; absence of the authenticated capability/outputSchema successes adds `authenticated_sdk_success_unavailable`. The repository runner prints only that sanitized evaluation and exits non-zero. The legacy `admitBlock6aProbeResults` wrapper also rejects every such blocked evaluation, so no caller can mistake evidence retention for conditional-Go eligibility.

This feasibility classifier is not the Task 13 Job error contract. Task 13/17 must separately design typed adapter failures, Job failure/checkpoint/event mapping and renderer-safe localization from reviewed structured signals. It must conservatively use `runtime_failed` where the provider supplies none and must never expose raw SDK/CLI errors, stderr or arbitrary English text.

### R6 remediation: per-assertion provenance

Fresh capability, outputSchema, lifecycle and packaged records no longer store bare boolean assertions. Every assertion leaf carries the closed `source`, exact supporting `evidenceId` and supporting `classification` alongside its boolean value. Admission freezes all four fields for every expected key and rejects a legacy boolean, missing/extra leaf field, false value, wrong source, wrong evidence id or wrong classification.

SDK scenario counts and lifecycle/process observations point to their exact `real_sdk` run. Packaged gate/runtime/turn observations point to the exact `packaged_sdk` run. Local workspace checks and the typed-protocol exclusion point to `block6a-remediation-r6-assertion-provenance-001` as `static_manifest`; the utility environment exclusion points to the separate R2 environment evidence. Thus a record's top-level runtime source cannot upgrade a local or hard-coded boundary into SDK execution.

The R6 contract is recorded in `docs/engineering/evidence/block6a-remediation-r6-assertion-provenance.json`. Historical 6A.5–6A.8a JSON records retain their dated pre-R6 shape and are not rewritten. They remain historical only and cannot pass fresh admission or R8 lineage. R6 is structural evidence, not a real SDK or packaged recertification.

### R7 remediation: final evidence lineage and artifact binding

The outer repository runner—not the SDK utility or evidence producer—adds one exact lineage envelope to every fresh sanitized result: `gitHeadAtRun`, `criticalInputsCleanAtRun`, `packageLockSha256`, `runtimeBoundarySha256`, `packagedArtifactSha256` and ordered `evidenceInputs[{ evidenceId, sha256 }]`. Development/lifecycle records require a null artifact hash; packaged records require the deterministic SHA-256 of the complete sorted packaged directory manifest and every file hash.

The runtime-boundary hash includes package/lock/Forge configuration, every Vite config, main startup, every Codex feasibility source, admission/runner/lineage scripts and the packaged boundary verification. The evidence-input list binds R2, R4a, R4b, R5, R6 and the R7 gate itself. The runner rejects a run when any critical tracked or untracked input differs from `gitHeadAtRun`, so an uncommitted runtime working tree cannot create admissible R8 evidence.

Final verification requires `git merge-base --is-ancestor gitHeadAtRun finalHead`, exact current lock/runtime/artifact/input hashes, and a `git diff --name-only gitHeadAtRun finalHead` containing only Block 6A evidence JSON, the three current authority documents, or the two corresponding authority/lineage consistency tests. Any runtime, probe, admission, package, lock, Forge/Vite or unrelated test change invalidates the run and requires fresh execution. The stable command is `node scripts/verify-block6a-evidence-lineage.mjs <sanitized-evidence.json> [...]`.

The R7 structural record is `docs/engineering/evidence/block6a-remediation-r7-evidence-lineage.json`. It is `static_manifest` only. No existing historical runtime record gains a fabricated Git, lockfile or artifact binding, and the current uncommitted remediation tree cannot satisfy `criticalInputsCleanAtRun: true`.

Task 6A may determine whether the official SDK/CLI exposes a supported ChatGPT-managed login mechanism and record packaging limitations. It has no WriteStorm login UI or admitted product connector, so it cannot claim that a natural WriteStorm login path or an all-users authentication experience has been verified. API Key fallback remains forbidden.

## Task 6A.5 cwd, Git, environment and auth result

The committed historical `real_sdk` record is `docs/engineering/evidence/block6a-task6a5-cwd-git-env-auth.json`. A no-window Electron 43.0.0 main probe forked the dedicated utility under embedded Node 24.17.0 and `@openai/codex-sdk@0.144.6`. It used only operating-system temporary directories: separate Library and workspace roots, two temporary Git repositories, one non-Git directory and one empty isolated `CODEX_HOME`. Its pre-R6 boolean assertions recorded the probe-root, Library, packaged-resource, environment and protocol boundaries; they are dated facts rather than the provenance-bearing fresh shape.

The historical record says all five utility cwd checks matched. At that checkpoint, the fixed-version spike interpreted message-only failures as `git_repo_required` and `auth_failed`: default and explicit temporary Git workspaces failed under the empty isolated home, the explicit non-Git workspace with `skipGitRepoCheck: false` failed before auth, and the skip-Git scenario crossed that boundary before failing under isolated auth. R5 does not rewrite that dated record, but those message-derived labels are not stable current runtime classifications and cannot certify the repaired classifier at R8.

The current ChatGPT-managed auth scenario used an explicit temporary Git workspace and completed one real SDK turn. It returned `authenticated`, and the final response matched the fixed expected sentinel. The probe neither read nor changed credential material and did not admit an API key. This real success unblocks Task 6A.6 execution, but it is development Electron evidence only: it does not prove packaged execution, timeout/cancel cleanup, Windows feasibility, a WriteStorm login UI, an all-users login experience, macOS compatibility or release readiness.

Official authentication documentation records browser-based ChatGPT sign-in through `codex login` and shared cached CLI/IDE authentication; the SDK documentation records the server-side TypeScript entry point used here: <https://learn.chatgpt.com/docs/auth> and <https://learn.chatgpt.com/docs/codex-sdk>. WriteStorm did not invoke direct CLI fallback or automate a login flow. Unsafe-to-manufacture expired-session behavior remains `unverified`.

## Structured output provenance

- `success`: a real SDK run over fixed synthetic input plus WriteStorm final-response validation; source is `real_sdk` or `packaged_sdk`.
- `invalid schema`: a fixed-version installed-SDK local-guard rejection identified by the closed scenario, fixed non-object input, exact installed version and rejection—not by error text. This is a feasibility-only result whose runtime and static premises require separate provenance.
- `missing field`: a local final-response validator fixture proving WriteStorm error mapping only; source is `local_validator_fixture`.
- `extra field`: a local validator fixture proving `additionalProperties: false` mapping only; source is `local_validator_fixture`.

The authority must never claim that the real SDK returned missing-field or extra-field JSON when those paths were exercised only by fixtures.

## Task 6A.6 minimal outputSchema result

Task 6A.6 commits two deliberately separate records. `docs/engineering/evidence/block6a-task6a6-real-output-schema.json` is `real_sdk`; `docs/engineering/evidence/block6a-task6a6-validator-fixtures.json` is `local_validator_fixture`. Their provenance must not be merged or upgraded.

The real no-window Electron 43.0.0 probe used embedded Node 24.17.0, `@openai/codex-sdk@0.144.6`, current ChatGPT-managed auth and one isolated temporary Git workspace. The closed main/utility request selected only `valid-minimal | invalid-schema`; it admitted neither prompt text nor caller-supplied schema. API credential environment variables remained excluded.

For `valid-minimal`, the utility passed a fixed object schema with one required string field and `additionalProperties: false` to `Thread.run`. The authenticated real turn completed, its final response parsed as JSON, the same strict WriteStorm validator accepted it, and the expected sentinel matched. Neither the response body nor the sentinel is retained in committed evidence.

For `invalid-schema`, the utility deliberately passed a non-object schema through the installed SDK API. The installed 0.144.6 SDK rejected it through its local guard before a model turn. This is not described as a remote API rejection or a model-generated malformed object. R5 identifies the fixed version/scenario/input/rejection conjunction and discards the error without inspecting its message; the result is a restricted feasibility fact, not a stable product error code.

The missing-field and extra-field cases run only through `validateMinimalStructuredOutput`. They prove the local strict validator's stable `missing_field` and `extra_field` mappings. They do not prove that Codex or a model produced either invalid shape. The official Codex structured-output documentation describes `--output-schema` with object properties, required fields and `additionalProperties: false`: <https://learn.chatgpt.com/docs/developer-commands?surface=cli#cli-codex-exec>. The installed TypeScript SDK declarations and implementation establish the `Thread.run(..., { outputSchema })` bridge used by the probe.

This development-runtime structured-output result does not prove cancellation cleanup, packaged execution, Windows feasibility, macOS compatibility or release readiness. Direct `codex exec`, API Key, app-server, GUI automation, local-model and alternate-provider fallback remain forbidden.

## Lifecycle scenarios

`app-level timeout`, `explicit cancel`, `window close` and `app quit` are separate evidence scenarios. In particular, window close and app quit are distinct trigger scenarios even when closing the final Windows window subsequently causes quit. Each record identifies the initial trigger source, the later lifecycle events and whether cleanup was graceful or forced.

Lifecycle cleanup is guarded so cleanup executes at most once. A final-window close followed by `before-quit` must share one idempotent cleanup operation and one acknowledgement rather than starting two cleanup races.

## Task 6A.7 timeout, cancel and lifecycle cleanup result

The committed `real_sdk` record is `docs/engineering/evidence/block6a-task6a7-lifecycle-cleanup.json`. Four separate hidden Electron 43.0.0 processes exercised `app-timeout`, `explicit-cancel`, `window-close` and `app-quit` against `@openai/codex-sdk@0.144.6` under embedded Node 24.17.0. Each used a fixed short synthetic input and an isolated temporary Git workspace. Aborted turns retain `authClassification: unverified`; Task 6A.7 does not infer auth from an interrupted turn and instead relies on the separate completed successes in Tasks 6A.5 and 6A.6.

The repaired `app-timeout` scenario exercises the runner's actual timeout rather than scheduling the same cooperative lifecycle trigger used by explicit cancel. After four seconds, main sent `cancel-active-probe`; utility requested SDK AbortController cancellation, observed `AbortError`, awaited the SDK promise, acknowledged shutdown and exited. Only then did the observer re-read the exact utility and CLI identities attributed before timeout. Both were absent. The sanitized timeout summary is `classification: graceful`, with abort requested/observed, SDK settled, cleanup acknowledged and utility exit observed all true. The forced fallback is separately unit-tested for ordering and classification but cannot pass the real lifecycle gate without the same exit and attributed residual evidence.

Every scenario observed the project-local CLI before its trigger, attributed it through the utility PID parent chain and start time, requested AbortController cancellation, observed SDK `AbortError`, waited for the SDK promise to settle, received utility cleanup acknowledgement, and then found neither the same utility identity nor the same CLI identity. Paths and PIDs remained ephemeral and are not committed. The observer did not classify or terminate by process name, never terminated the CLI directly and never touched an unowned Codex process.

`window-close` and `app-quit` are distinct real event paths. The hidden window-close scenario first observed `window-close`, then `window-all-closed` and `before-quit`; those events requested cleanup twice but the idempotent gate executed cleanup once. The separate app-quit scenario first observed `app-quit` through `before-quit`, executed cleanup once, and did not observe window-close or window-all-closed. The timeout and explicit-cancel scenarios each had one request and one execution.

The exact installed SDK implementation passes the per-turn signal to Node `spawn`; Node documents `AbortSignal` child-process cancellation, while Electron documents the utility process and app lifecycle events used by the harness: <https://nodejs.org/api/child_process.html>, <https://www.electronjs.org/docs/latest/api/utility-process>, and <https://www.electronjs.org/docs/latest/api/app#event-before-quit>. These development results satisfy Task 6A.7 but do not establish packaged execution, Windows feasibility, macOS compatibility or release readiness.

## Task 6A.8a Windows packaged SDK result

The committed runtime record is `docs/engineering/evidence/block6a-task6a8a-windows-packaged-sdk.json`, with `source: packaged_sdk`. A hidden packaged Electron 43.0.0 process ran the SDK under embedded Node 24.17.0 on Windows x64 using `@openai/codex-sdk@0.144.6`, CLI `0.144.6` and platform package `0.144.6-win32-x64`. The real structured turn used an isolated temporary Git workspace outside packaged resources and completed as `authenticated`; final JSON parsing, strict local validation, expected-value matching and utility cleanup acknowledgement all passed. API credential environment names were removed from the utility environment. No prompt, response body, absolute path, environment value, credential, PID or raw SDK error was committed; packaged stderr was zero bytes.

The packaged startup gate rejects the probe before any SDK turn unless Electron reports `app.isPackaged`, the target is exactly `win32-x64`, a UUIDv4 run id is valid, and the short input plus expected value match the approved SHA-256 fingerprints and length/newline limits. The result path is not caller-controlled: it is derived under the operating-system temporary directory from the validated run id. `packaged_sdk_probe_completed` includes these gate facts as prerequisites rather than merely recording them afterward.

Forge keeps the SDK and CLI wrapper in `app.asar` and unpacks the exact Windows target beneath the project-owned `app.asar.unpacked/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc` tree. The utility supplies the exact `bin/codex.exe` in that tree through the SDK's official `codexPathOverride`; WriteStorm does not spawn the CLI directly. This is a packaged-path accommodation inside the SDK execution mechanism, not the forbidden `codex exec` fallback.

The independent `static_manifest` record is `docs/engineering/evidence/block6a-task6a8a-windows-package-boundary.json`. Fresh package guards prove that renderer resources contain no OpenAI SDK, Node privilege or secret-bearing runtime surface; the package contains the SDK module and CLI wrapper; only `codex-win32-x64` is present; and `codex.exe`, code-mode host, ripgrep, command runner, sandbox setup and the Codex manifest are non-empty under `app.asar.unpacked`. Lockfile-only optional platform records are not treated as packaged binaries.

A separate packaged manifest-inspection command timed out and is not cited as success. Executable provenance instead rests on the successful real SDK turn together with the package guard. This stable limitation remains recorded. Task 6A.8a establishes Windows packaged execution evidence only; it does not itself issue the Task 6A.8b Windows Go/conditional Go/No-Go decision, authorize Task 13.2, prove a WriteStorm login UI, prove macOS compatibility or establish release readiness. macOS packaged runtime remains `deferred-by-user`.

## Historical Task 6A.8b decision

The committed historical decision summary is `docs/engineering/evidence/block6a-task6a8b-verdict.json`, with `source: static_manifest` and classification `conditional_go_windows_only_macos_deferred_by_user`. It reconciled, but did not upgrade, the independently sourced 6A.3 through 6A.8a records available at that checkpoint.

At that historical checkpoint, the decision was **conditional Go for Windows-only implementation feasibility**. Its dated Windows x64 evidence covered the official npm supply chain, server-side TypeScript SDK mechanism, dedicated utility-process isolation, explicit temporary Git cwd, environment filtering, current ChatGPT-managed authentication, strict structured output, supervised runner timeout and cancellation, distinct window-close and app-quit cleanup, residual-process attribution, Windows package contents and a real packaged SDK turn.

### Current status: pending recertification

R1–R7 changed the evidence admission contract, utility environment, typed protocol, unified utility-session orchestration, session/termination supervision, owned-process cleanup, error classification, assertion provenance and evidence lineage. These are explicit expiry-condition changes. The current implementation is not Windows-feasibility verified, and the historical Task 6A.8b record cannot be applied to the changed working tree.

Fresh R8 Windows lifecycle and packaged evidence is required before the total thread may reissue the candidate `conditional Go — Windows-only feasibility verified; macOS deferred-by-user`. No current Windows feasibility verdict may be reissued before R8. This pending state is not a No-Go, does not erase the dated 6A.5–6A.8 evidence and does not authorize Task 13.2.

The current static status record is `docs/engineering/evidence/block6a-remediation-pending-recertification.json`. It records only authority state; it is not `real_sdk` or `packaged_sdk` evidence and cannot satisfy R8.

### R8a 2026-07-20 Windows development recertification attempt

`probe:codex:dev` ran once from clean committed and pushed HEAD `74ec65f4d91990caf03a6723140037374d4ba768` with the approved fixed synthetic values supplied ephemerally. Both values matched the runner's frozen SHA-256 fingerprints and length limits before execution. Electron ran hidden, raw process output was ignored, API credential environment names were removed, and no prompt, response body, environment value, credential, auth file, PID or executable path was persisted.

The 6A.5 capability producer timed out at its 45-second per-operation boundary before it could emit the complete five-scenario result. The 6A.6 outputSchema producer independently timed out at its 60-second per-operation boundary before it could emit the complete two-scenario result. Both failures used the unified termination coordinator and recorded `graceful` cleanup: abort requested and observed, SDK promise settled, shutdown cleanup acknowledged, utility exit observed, attributed residual scan completed, and both utility/CLI residual absence true. Neither path force-killed the utility.

Admission correctly rejected both `probe_infrastructure_failed` envelopes at the exact-result gate because they were not the required complete classifications and scenario sets. Consequently this run did not reach `evidenceAccepted`, did not produce the expected `git_auth_structured_classification_unavailable` evaluation, and does not prove current authenticated success, cwd/Git behavior or outputSchema behavior. The exact sanitized producer outputs are `docs/engineering/evidence/block6a-r8a-windows-dev-capability-attempt.json` and `docs/engineering/evidence/block6a-r8a-windows-dev-output-schema-attempt.json`. Their lineage binds the clean run HEAD, lockfile, runtime boundary and six static evidence inputs. Current status remains pending recertification; lifecycle and packaged R8 probes have not run against this boundary.

This is not a full Go. macOS packaged runtime is `deferred-by-user`, so this decision does not establish cross-platform compatibility, macOS support or release readiness. A complete Go claim still requires a macOS packaged package-boundary scan and real SDK runtime probe under the same privacy, auth, schema, cleanup and no-fallback rules. Unsafe-to-manufacture expired-session behavior and a natural WriteStorm login experience also remain unverified; the official SDK/CLI login mechanism is not a WriteStorm product login entry.

The conditional verdict does not authorize Task 13.2. Only the total thread may review this record and explicitly decide whether Windows-only Task 13 work may begin. Until that review, existing renderer actions remain disabled and this feasibility harness remains outside production Job, Prompt, module-body and workflow integration.

Direct `codex exec`, app-server, GUI automation, API Key, local model, Claude, DeepSeek and other-provider fallback remain forbidden. The SDK-owned pinned CLI and JSONL mechanism, including the packaged `codexPathOverride`, remain an internal implementation detail behind the SDK API rather than a WriteStorm fallback surface.

### Expiry conditions

The historical conditional verdict expires and requires focused plus packaged recertification when any of these conditions occurs. Condition 4 has occurred in the current working tree:

1. The exact SDK, CLI or Windows platform-package version or integrity changes.
2. The resolved dependency tree, install-script inventory or official registry provenance changes.
3. Electron, embedded Node, Forge, Vite, ASAR, externalization or package allowlist changes can affect the verified boundary.
4. The utility protocol, SDK-only import guard, cwd/Git policy, environment filter, auth mapping, schema validator or cleanup supervisor changes.
5. SDK executable layout, `codexPathOverride`, SDK-owned CLI/JSONL behavior or ChatGPT-managed authentication mechanics change.
6. The target differs from the verified Windows x64 operating-system, architecture, package or release-runtime boundary.
7. A required recertification cannot obtain a fresh authenticated SDK success or produces a different auth, schema, cancellation, cleanup or packaged-runtime outcome.
8. Renderer, preload or shared code gains an SDK, filesystem, shell, child-process, environment, token, secret or secure-storage surface.

There is no arbitrary time-only expiry. The authenticated result is not a durable credential fact: every required recertification must classify the then-current state honestly, and `login_required` or `auth_failed` blocks a new success claim without retroactively rewriting this dated run.

## Safe reproduction commands

The approved short synthetic input and expected value are supplied ephemerally through `WRITESTORM_CODEX_SYNTHETIC_INPUT` and `WRITESTORM_CODEX_SYNTHETIC_EXPECTED`. Repository runners verify their frozen SHA-256 fingerprints and length/newline limits but do not contain, print or retain the prompt. They remove API credential environment names, hide Electron windows, ignore raw process output and retain only sanitized summaries under the operating-system temporary directory when `WRITESTORM_CODEX_KEEP_SANITIZED_RESULTS=1` is explicitly set.

After the approved ephemeral values are loaded into the current shell, the reproducible commands are:

```text
npm run probe:codex:dev
npm run probe:codex:lifecycle
npm run probe:codex:packaged
npm run test:verification
npm run check
node scripts/verify-block6a-evidence-lineage.mjs <sanitized-evidence.json> [...]
```

`probe:codex:dev` rebuilds and runs the cwd/auth and outputSchema probes. `probe:codex:lifecycle` rebuilds and runs all four lifecycle scenarios. `probe:codex:packaged` creates a fresh Windows package, runs the static package/build guards and then invokes the packaged-only SDK probe. `npm run check` includes the fixed `test:verification` package-boundary suite after packaged E2E. None of these commands is a product fallback or Task 13 workflow.

The runner evaluates results through an exact fail-closed contract, not a negative substring scan. Each mode freezes the complete top-level evidence envelope as well as result count, task, source, classification, evidence identity, command name, SDK version and exact assertion-key set. `prompt`, `stdout`, `stderr`, arbitrary producer fields, missing fields and every other unlisted top-level key are rejected. The permitted `limitations` array is also an exact string allowlist rather than a free-text channel. Every assertion key and its exact `{ value, source, evidenceId, classification }` leaf are frozen; legacy booleans and producer-invented provenance are rejected. Development evidence requires exactly all five cwd/Git/auth scenarios and both outputSchema scenarios with their complete field sets and semantics. Conservative unverified Git/auth results may pass evidence validation only; they always block recertification and produce a non-zero runner exit. Lifecycle recertification requires exactly the four named scenarios, their distinct trigger/event records, a single cleanup execution, the timeout cleanup summary, and separate utility/CLI attribution plus residual-absence assertions. Packaged recertification requires the packaged-only gate, exact approved input and expected-value SHA-256 fingerprints, the OS-temporary/validated-UUID result-path policy, Windows x64 runtime, the complete structured result and cleanup assertions. Malformed, unknown, partial, wrong-source, missing, extra or false-assertion results are rejected; valid-but-unverified results are retained with closed blockers and still exit non-zero.

This R1 admission-contract revision intentionally makes the earlier persisted probe records insufficient for final recertification: they remain historical feasibility evidence, but only fresh R8 outputs carrying the frozen nested fields may pass this admission gate. No existing evidence file is rewritten to simulate that fresh run.

## Historical and current truth

Block 7 and Block 8 documents correctly record that 6A had not executed at their historical checkpoints. Those sentences remain unchanged and must not be globally deleted. This document remains the current authority: it preserves the later historical Task 6A.8b decision while recording that the changed working tree is pending R8 recertification. It does not rewrite either historical fact.

Task 6A.8b does not authorize Task 13.2. Only the total thread may review this verdict and authorize subsequent work.
