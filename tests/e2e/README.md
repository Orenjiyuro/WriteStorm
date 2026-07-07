# Electron E2E

The packaged Electron smoke resolves app paths for Windows and macOS:

- Windows: `out/writestorm-win32-${arch}/writestorm.exe`
- macOS: `out/writestorm-darwin-${arch}/writestorm.app/Contents/MacOS/writestorm`

Current validation in this workspace is Windows-only. macOS path handling is covered by unit tests, but macOS packaged smoke still requires a macOS runner.

Electron stderr is captured and attached to e2e failures so startup, CDP connection, and assertion failures do not lose native-process diagnostics.

## Current Status

- Local CI equivalent command is `npm run check`, which runs `typecheck`, unit tests, and full Electron e2e.
- `npm run test:e2e` passes end to end after Forge package was configured to use local `electron/checksums.json` for Electron zip checksum validation.
- The command covers `npm run build`, `electron-forge package`, and the real Electron window smoke.
- Real-window smoke should run in an environment that can launch and connect to the packaged Electron app; the Codex sandbox may time out at the Playwright connection phase.
- `npx playwright test` remains useful for isolating the window smoke, but it is not a replacement for full `npm run test:e2e`.
