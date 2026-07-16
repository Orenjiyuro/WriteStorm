# Electron E2E

The packaged Electron smoke resolves app paths for Windows and macOS:

- Windows: `out/writestorm-win32-${arch}/writestorm.exe`
- macOS: `out/writestorm-darwin-${arch}/writestorm.app/Contents/MacOS/writestorm`

Current validation in this workspace is Windows-only. macOS path handling is covered by unit tests, but macOS packaged smoke still requires a macOS runner.

Electron stderr is captured and attached to e2e failures so startup, CDP connection, and assertion failures do not lose native-process diagnostics.

All packaged Electron processes in specs must be created through `spawnPackagedApp` in `electron-app.ts`. Individual specs must not call Node's `spawn` directly. This keeps executable resolution, hardware-acceleration settings, environment isolation, and stderr behavior in one entry point.

## Secondary-display screenshot gate

The one canonical command for Windows packaged screenshot/display acceptance is:

```text
npm run test:e2e:secondary-display
```

Do not launch the executable directly for screenshot acceptance. A screenshot spec must include the `@secondary-display` title tag and use `spawnPackagedAppOnSecondary`. That wrapper is the only E2E entry that sets the main-process test contract `WRITESTORM_E2E_DISPLAY_TARGET=secondary`; normal packaged specs explicitly remove that variable from the child environment.

This mode exists only in automated test process environments. `npm start`, installed/packaged product launches, and the ordinary `npm run test:e2e` path do not set the variable and retain the existing product window behavior. The test position is never persisted to product settings.

After Electron is ready, main process selection works entirely in Electron DIP coordinates:

1. Remove the primary display from `screen.getAllDisplays()` candidates by display id.
2. Prefer a display whose `workArea` contains the default `1100 x 760` DIP window.
3. Break ties by descending work-area size, then `y`, `x`, and display id.
4. Clamp and center the window within the selected `workArea` without multiplying coordinates by `scaleFactor`.
5. Construct `BrowserWindow` with `x`, `y`, `width`, `height`, and `show: false`; verify actual placement before calling `show()`.

The algorithm makes no right-of-primary assumption, so negative coordinates and vertically stacked displays are valid. With no non-primary display, an unusable secondary work area, an OS relocation to primary, or a disconnected target, test mode exits with exit code `86` and never falls back to the primary display.

Main process writes a `WRITESTORM_E2E_DISPLAY ` JSON record to stderr before the hidden test window is shown. The packaged smoke automatically asserts and attaches:

- `primaryDisplay` and `targetDisplay`, with different display ids;
- target `workArea` and `scaleFactor`;
- `requestedWindowBounds` and `actualWindowBounds`, both fully contained by the target work area;
- `centerDisplayId`, equal to the target display id.

Future screenshot threads must first run the canonical command and pass these assertions, then capture their screenshot in the same tagged spec. Evidence is incomplete without the placement JSON and final screenshot. Cleanup may close only the `ChildProcess` returned by the current spec; it must not stop Electron or other applications by name and must not manipulate applications on the user's primary display.

The packaged smoke is a scaffold/runtime check, not a production release signal. Remote CI is not configured, Windows signing is not configured, macOS notarization is not configured, and auto-update is not configured.

## Current Status

- Local CI equivalent command is `npm run check`, which runs `typecheck`, unit tests, and full Electron e2e.
- `npm run test:e2e` passes end to end after Forge package was configured to use local `electron/checksums.json` for Electron zip checksum validation.
- The command covers `npm run build`, `electron-forge package`, and the real Electron window smoke.
- Real-window smoke should run in an environment that can launch and connect to the packaged Electron app; the Codex sandbox may time out at the Playwright connection phase.
- `npx playwright test` remains useful for isolating the window smoke, but it is not a replacement for full `npm run test:e2e`.
- The secondary-display command is a development acceptance gate, not a product launch command and not part of Blocks 9 or 10 product functionality.
