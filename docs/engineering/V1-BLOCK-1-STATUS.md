# WriteStorm V1 Block 1 Status

Date: 2026-07-07

Status: Block 1 scaffold/security/e2e baseline landed, pending total-thread review

Scope: Block 1 scaffold, security baseline, local verification status, and known blockers. This file does not mark Block 1 complete and does not authorize Block 2.

## Scaffold And Versions

- Scaffold location: repository root `C:\SoftWork\Git\WriteStorm`; no nested project copy, version directory, or worktree is used.
- Stack shape: Electron Forge + Vite TypeScript + manually wired React renderer.
- Process layout: `src/main`, `src/preload`, `src/renderer`, `src/shared`.
- Electron main entry: `package.json` points `main` to `.vite/build/main.js`.
- Forge Vite plugin: main, preload, and renderer entries are configured separately.
- Node baseline: `package.json` requires `>=22.12.0`; local observed Node is `v24.14.1`.
- Package manager: npm; local observed npm is `11.12.1`.

Dependency versions from `package.json` and `package-lock.json`:

| Dependency | Declared | Locked |
| --- | --- | --- |
| `@electron-forge/cli` | `^7.11.2` | `7.11.2` |
| `@electron-forge/plugin-vite` | `^7.11.2` | `7.11.2` |
| `electron` | `^43.0.0` | `43.0.0` |
| `vite` | `^8.1.3` | `8.1.3` |
| `react` | `^19.2.7` | `19.2.7` |
| `react-dom` | `^19.2.7` | `19.2.7` |
| `typescript` | `^6.0.3` | `6.0.3` |
| `vitest` | `^4.1.10` | `4.1.10` |
| `@playwright/test` | `^1.61.1` | `1.61.1` |

## Security Checklist

| Item | Status | Evidence |
| --- | --- | --- |
| Renderer Node access disabled | Present | BrowserWindow uses `nodeIntegration: false`; e2e checks `require` is absent from `window`. |
| Context isolation | Present | BrowserWindow uses `contextIsolation: true`. |
| Renderer sandbox | Present | BrowserWindow uses `sandbox: true`. |
| Preload API scope | Present | Preload exposes only `window.writestorm.internal.health`. |
| IPC sender validation | Present | Health IPC accepts only `writestorm://app` or the explicit Vite dev origin; arbitrary `file:` senders are rejected by unit test. |
| CSP | Present | Renderer HTML has CSP meta; dev server pages can receive CSP header. |
| Navigation guard | Present | Main process blocks non-app navigation through `will-navigate`. |
| New-window guard | Present | Main process denies new windows through `setWindowOpenHandler`. |
| `openExternal` allowlist | Present, empty | `shell.openExternal` is gated by `isAllowedExternalUrl`; current allowlist is intentionally empty. |
| Renderer/shared privileged import guard | Present | Unit tests reject privileged imports from renderer/shared source files. |
| Native dialog e2e rule | Not yet exercised | Current e2e does not use a web file chooser. Real native dialogs are not implemented yet; future dialog tests must use main-process stubs. |

## Verification State

Latest accepted results from the implementation thread:

- `npm run typecheck`: passed.
- `npm run test:unit`: passed, 4 test files and 17 tests.
- `npm run build`: passed after `forge.config.ts` was updated to pass local `electron/checksums.json` into `packagerConfig.download.checksums`.
- `npm run test:e2e`: passed, including `npm run build`, `electron-forge package`, and 1 real Electron window smoke.
- `npm run check`: passed outside the Codex sandbox; this is the local CI equivalent command for Block 1.
- Windows packaged smoke: present; the smoke launches the packaged Windows Electron app and verifies the no-library empty state plus renderer privilege isolation.
- macOS packaged smoke: not yet run; it still requires a macOS runner.
- Historical note: `npx playwright test` passed outside the Codex sandbox before this fix, but it only proved the already-packaged window smoke and did not clear the full e2e gate.
- Sandbox caveat: the same real-window smoke can time out inside the Codex sandbox at the Playwright connection phase; GUI smoke evidence should come from an environment allowed to launch and connect to the packaged Electron window.

`npx playwright test` only proves the already-packaged real Electron window smoke can run. It does not replace `npm run test:e2e`, because `npm run test:e2e` also runs `npm run build` and `electron-forge package`.

## Local CI/CD Baseline

- Local CI equivalent command: `npm run check`.
- Command chain: `typecheck` -> unit tests -> full Electron e2e.
- Full Electron e2e includes `npm run build`, `electron-forge package`, and the real packaged-window smoke.
- Latest local CI equivalent result: passed outside the Codex sandbox on Windows.
- Remote CI status: blocked/not configured.
- Remote CI blocked reason: the V1 total thread has not selected a remote CI provider/workflow or provided a macOS runner policy; macOS packaged smoke also requires a macOS runner before cross-platform CI can be claimed.

## Current Workspace Verification Caveat

- During the Block 1 maintenance pass on 2026-07-07, targeted Block 1 unit tests passed: `scaffold.test.tsx`, `scaffold-boundaries.test.ts`, `main-security.test.ts`, and `e2e-support.test.ts`.
- `npm run build` passed and still produced the Windows package.
- Full `npm run typecheck` and `npm run test:unit` are currently blocked by separate in-progress Block 2 typed IPC/contract tests and type definitions in the working tree.
- This caveat must not be downgraded into a warning: the mixed working tree is not full-local-CI green until those Block 2 failures are fixed or isolated.

## Scaffold Test Maintenance Notes

- Security policy behavior is covered through exported pure helpers in `src/main/security.ts` and `tests/unit/main-security.test.ts`.
- The real packaged-window smoke covers the user-observable renderer boundary: no Node `require`, visible empty state, and health bridge.
- Some `tests/unit/scaffold-boundaries.test.ts` checks remain static by design: Forge plugin entry wiring, BrowserWindow `webPreferences`, app protocol wiring, and preload exposure are Electron startup assembly details with no stable public behavior API before launching Electron.
- Those static checks are kept narrow and do not expose new production internals only for testing.

## A11y And I18n Shell Baseline

- Empty-state semantics: renderer uses a top-level `main` labelled by the empty-state heading and a descriptive text region through `aria-describedby`.
- Keyboard/focus baseline: the current no-library shell has no interactive controls; future controls must be keyboard reachable and must keep visible focus styles.
- I18n resource layer: visible renderer copy and the baseline date formatter live in `src/renderer/i18n.ts`; `App.tsx` imports text from that resource layer instead of hardcoding interface copy.
- Current smoke coverage: unit rendering checks the empty-state text from the resource layer; e2e checks the real Electron window heading and description.
- Date/number display status: no user-visible date or number formatting is currently rendered; future date/number output must use the replaceable renderer formatting layer.

## Release And Update Strategy

- Current distribution status: packaged smoke only. This proves the app can be packaged and launched locally; it does not prove production distribution readiness.
- Windows signing: blocked, pending certificate, publisher identity, and installer/distribution decision.
- macOS codesign/notarization: blocked, pending macOS runner plus Apple Developer signing and notarization credentials.
- Auto-update: disabled/not configured, pending update channel, hosting, signing, rollback, and security policy decisions.
- V1 release strategy decision: blocked until the total thread chooses manual installer-only distribution, signed packages, or an auto-update channel.

## Resolved Blocker

The previous complete `npm run test:e2e` blocker is resolved:

- Previous failure stage: `electron-forge package`, before Playwright started.
- Previous error summary: `Client network socket disconnected before secure TLS connection was established`.
- Root cause: `@electron/get` hit the local Electron zip cache, then tried to download remote `SHASUMS256.txt` for checksum validation because Forge/Packager had not been given local checksums.
- Fix: `forge.config.ts` passes `require('electron/checksums.json')` to `packagerConfig.download.checksums`.
- Verification: `npm run test:e2e` passed end to end after the fix.

This status update resolves the e2e blocker only. It does not by itself mark Block 1 complete or authorize Block 2.

## Unlock Conditions

Before Block 1 can be marked complete by the total thread:

1. Total-thread review must accept the current scaffold, security checklist, and verification evidence.
2. macOS packaged smoke still needs a macOS runner. Current coverage is Windows smoke plus macOS package path unit tests.
3. Remote CI remains blocked until a provider/workflow and macOS runner policy are selected.
4. Production release strategy remains blocked until signing, notarization, and auto-update decisions are made.
# Task 20 recertification note

The Block 1 security foundation remains active: BrowserWindow guards and product sender identity are installed before first navigation, with Node integration disabled, context isolation enabled and sandbox enabled. Windows packaging/e2e is recertified by Task 20; macOS packaged smoke and release makers remain blocked/not verified.

Task 20 fresh Windows evidence on 2026-07-14: `npm run check` passed with 86 unit files / 366 tests, 21 integration files / 133 tests, successful Windows x64 package, and 7/7 packaged Electron e2e tests. This does not change the blocked macOS, maker, signing or notarization rows above.
