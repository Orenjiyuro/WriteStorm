# WriteStorm V1 Block 6A Codex SDK Feasibility

Date: 2026-07-19

Verdict: `conditional Go — Windows-only feasibility verified; macOS deferred-by-user`

## Authority and scope

This document is the current authority for Task 6A.1 through Task 6A.8b. Task 6A.1 froze scope and evidence format, Task 6A.2 installed and audited the approved dependency, Task 6A.3 verified the installed package's static semantics plus a local ESM import without starting a turn, Task 6A.4 established the dedicated utility boundary, Task 6A.5 completed the development Electron cwd/Git/environment/auth probe, Task 6A.6 completed the minimal structured-output gate, Task 6A.7 completed the development Electron cancellation/cleanup gate, Task 6A.8a completed the Windows x64 packaged SDK gate, and Task 6A.8b records the evidence-backed Windows-only conditional verdict.

V1 admits Codex SDK only. WriteStorm has a long-term multi-provider direction, but this task does not install, implement or call Claude, DeepSeek or another provider, and it never uses another provider as fallback. It does not implement a production `AiExecutionPort`, provider registry, Job integration, Settings connection flow, renderer AI action, Prompt runtime, module body generation or real breakdown pipeline.

The probe uses only fixed, short, non-sensitive synthetic input. Repository source, Library contents, user manuscripts, prompts from production, secrets and credential material are outside the probe input boundary.

macOS packaged runtime evidence is `deferred-by-user`. The current decision is therefore conditional and Windows-only. This is not a full Go and does not claim cross-platform compatibility, macOS verification or release readiness.

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
  "assertions": {}
}
```

The closed provenance vocabulary is:

`source = real_sdk | packaged_sdk | local_validator_fixture | static_manifest`

Sanitized JSON summaries are committed. Exact package/runtime versions, stable classifications, boolean assertions, command names and timestamps may be committed. Every assertion must identify its source and must not upgrade static or fixture evidence into a real SDK claim.

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

## Process ownership and residual checks

The approved boundary is a dedicated Electron `utilityProcess`. Renderer and preload gain no AI execution surface. Main owns the typed feasibility protocol, timeout/cancel/lifecycle supervision and process attribution. Utility is the only source location allowed to import `@openai/codex-sdk`; the SDK launches its official project-local CLI.

Residual checks associate the current probe by utility PID, parent PID chain, process start time, and project-local executable path. Global process-name matching is not ownership evidence and must not be used to classify or terminate processes. Never terminate a Codex process whose ownership by the current probe is not proven.

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

If current ChatGPT-managed authentication exists, the task may continue to a real success probe without reading or printing credential material. If current authentication does not exist, it records `login_required` and does not fabricate success. An isolated empty `CODEX_HOME` must independently prove the unauthenticated classification. Unsafe-to-manufacture expired state remains `unverified`.

A real success probe is blocked when authenticated state is unavailable. Task 6A.5 found current authenticated state and therefore allowed Task 6A.6 to proceed; Task 6A.8a later obtained a fresh authenticated packaged success. A future rerun that lacks authentication must fail closed rather than reuse either result as a durable credential fact.

Task 6A may determine whether the official SDK/CLI exposes a supported ChatGPT-managed login mechanism and record packaging limitations. It has no WriteStorm login UI or admitted product connector, so it cannot claim that a natural WriteStorm login path or an all-users authentication experience has been verified. API Key fallback remains forbidden.

## Task 6A.5 cwd, Git, environment and auth result

The committed `real_sdk` record is `docs/engineering/evidence/block6a-task6a5-cwd-git-env-auth.json`. A no-window Electron 43.0.0 main probe forked the dedicated utility under embedded Node 24.17.0 and `@openai/codex-sdk@0.144.6`. It used only operating-system temporary directories: separate Library and workspace roots, two temporary Git repositories, one non-Git directory and one empty isolated `CODEX_HOME`. Boolean assertions prove the probe root was outside the WriteStorm source repository, the workspaces were outside the Library root and packaged resources, API credential environment variables were excluded, and the fixed synthetic input did not cross the typed main/utility protocol.

All five utility cwd checks matched. Default SDK cwd in a temporary Git repository reached auth and failed under the empty isolated home. An explicit Git `workingDirectory` reached the same auth gate even when the utility process itself started in a separate non-Git directory. An explicit non-Git `workingDirectory` with `skipGitRepoCheck: false` returned `git_repo_required`; the same non-Git directory with `skipGitRepoCheck: true` crossed the Git gate and then returned the isolated auth failure. The empty-home result is the closed classification `auth_failed`, not a fabricated `login_required` or success.

The current ChatGPT-managed auth scenario used an explicit temporary Git workspace and completed one real SDK turn. It returned `authenticated`, and the final response matched the fixed expected sentinel. The probe neither read nor changed credential material and did not admit an API key. This real success unblocks Task 6A.6 execution, but it is development Electron evidence only: it does not prove packaged execution, timeout/cancel cleanup, Windows feasibility, a WriteStorm login UI, an all-users login experience, macOS compatibility or release readiness.

Official authentication documentation records browser-based ChatGPT sign-in through `codex login` and shared cached CLI/IDE authentication; the SDK documentation records the server-side TypeScript entry point used here: <https://learn.chatgpt.com/docs/auth> and <https://learn.chatgpt.com/docs/codex-sdk>. WriteStorm did not invoke direct CLI fallback or automate a login flow. Unsafe-to-manufacture expired-session behavior remains `unverified`.

## Structured output provenance

- `success`: a real SDK run over fixed synthetic input plus WriteStorm final-response validation; source is `real_sdk` or `packaged_sdk`.
- `invalid schema`: a real SDK/API rejection saved only as a stable sanitized classification; source is `real_sdk` or `packaged_sdk`.
- `missing field`: a local final-response validator fixture proving WriteStorm error mapping only; source is `local_validator_fixture`.
- `extra field`: a local validator fixture proving `additionalProperties: false` mapping only; source is `local_validator_fixture`.

The authority must never claim that the real SDK returned missing-field or extra-field JSON when those paths were exercised only by fixtures.

## Task 6A.6 minimal outputSchema result

Task 6A.6 commits two deliberately separate records. `docs/engineering/evidence/block6a-task6a6-real-output-schema.json` is `real_sdk`; `docs/engineering/evidence/block6a-task6a6-validator-fixtures.json` is `local_validator_fixture`. Their provenance must not be merged or upgraded.

The real no-window Electron 43.0.0 probe used embedded Node 24.17.0, `@openai/codex-sdk@0.144.6`, current ChatGPT-managed auth and one isolated temporary Git workspace. The closed main/utility request selected only `valid-minimal | invalid-schema`; it admitted neither prompt text nor caller-supplied schema. API credential environment variables remained excluded.

For `valid-minimal`, the utility passed a fixed object schema with one required string field and `additionalProperties: false` to `Thread.run`. The authenticated real turn completed, its final response parsed as JSON, the same strict WriteStorm validator accepted it, and the expected sentinel matched. Neither the response body nor the sentinel is retained in committed evidence.

For `invalid-schema`, the utility deliberately passed a non-object schema through the installed SDK API. The installed SDK rejected it through its plain-JSON-object guard before a model turn. This is a real installed-SDK rejection and is not described as a remote API rejection or a model-generated malformed object. Raw error text is discarded after exact stable classification.

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

## Task 6A.8b decision

The committed decision summary is `docs/engineering/evidence/block6a-task6a8b-verdict.json`, with `source: static_manifest` and classification `conditional_go_windows_only_macos_deferred_by_user`. It reconciles, but does not upgrade, the independently sourced 6A.3 through 6A.8a records.

The decision is **conditional Go for Windows-only implementation feasibility**. The verified Windows x64 boundary pins the official npm supply chain, server-side TypeScript SDK mechanism, dedicated utility-process isolation, explicit temporary Git cwd, environment filtering, current ChatGPT-managed authentication, strict structured output, supervised runner timeout and cancellation, distinct window-close and app-quit cleanup, residual-process attribution, Windows package contents and a real packaged SDK turn. The repaired runner-timeout path removes the prior cleanup-evidence blocker; a forced fallback remains fail-closed unless its exit and attributed residual requirements are met.

This is not a full Go. macOS packaged runtime is `deferred-by-user`, so this decision does not establish cross-platform compatibility, macOS support or release readiness. A complete Go claim still requires a macOS packaged package-boundary scan and real SDK runtime probe under the same privacy, auth, schema, cleanup and no-fallback rules. Unsafe-to-manufacture expired-session behavior and a natural WriteStorm login experience also remain unverified; the official SDK/CLI login mechanism is not a WriteStorm product login entry.

The conditional verdict does not authorize Task 13.2. Only the total thread may review this record and explicitly decide whether Windows-only Task 13 work may begin. Until that review, existing renderer actions remain disabled and this feasibility harness remains outside production Job, Prompt, module-body and workflow integration.

Direct `codex exec`, app-server, GUI automation, API Key, local model, Claude, DeepSeek and other-provider fallback remain forbidden. The SDK-owned pinned CLI and JSONL mechanism, including the packaged `codexPathOverride`, remain an internal implementation detail behind the SDK API rather than a WriteStorm fallback surface.

### Expiry conditions

The conditional verdict expires and requires focused plus packaged recertification when any of these conditions occurs:

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
```

`probe:codex:dev` rebuilds and runs the cwd/auth and outputSchema probes. `probe:codex:lifecycle` rebuilds and runs all four lifecycle scenarios. `probe:codex:packaged` creates a fresh Windows package, runs the static package/build guards and then invokes the packaged-only SDK probe. `npm run check` includes the fixed `test:verification` package-boundary suite after packaged E2E. None of these commands is a product fallback or Task 13 workflow.

The runner admits success through an exact fail-closed contract, not a negative substring scan. Each mode freezes result count, task, source and successful classification; all published assertions must be boolean `true`. Development recertification additionally requires the current-auth SDK turn and valid outputSchema turn to be authenticated successes plus SDK rejection of the invalid schema. Lifecycle recertification requires exactly the four named scenarios, including the graceful runner-timeout cleanup summary. Packaged recertification requires the packaged-only gate, Windows x64 runtime, real SDK turn, authenticated structured output and cleanup assertions. Blocked, unknown, partial, wrong-source, missing, extra or false-assertion results exit non-zero.

## Historical and current truth

Block 7 and Block 8 documents correctly record that 6A had not executed at their historical checkpoints. Those sentences remain unchanged and must not be globally deleted. This document is the current authority and supersedes the old current-state absence only through the evidence-backed Task 6A.8b conditional verdict; it does not rewrite historical facts.

Task 6A.8b does not authorize Task 13.2. Only the total thread may review this verdict and authorize subsequent work.
