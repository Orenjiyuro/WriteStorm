# V1 Block 8 Structure Detection Performance Baseline

## Scope and numbering

This record covers the internal execution slice `8A-10 performance recorder`, which maps to master-plan Task 8.13. Master-plan Task 8.10 is structure validation and is not redefined by this record.

The recorder measures deterministic local parsing only. It does not authorize Codex SDK structure recognition, AI runtime, evidence extraction, module bodies, review/freeze UI, or downstream rebuilds.

## Measurement policy

- Fixtures are generated deterministically at exact UTF-8 byte sizes: 50 KiB, 1 MiB, and 5 MiB in both `.txt` and `.md` forms.
- Each detection runs in a fresh Electron utility process.
- Worker telemetry records detector duration, RSS and heap-used endpoints, and process-lifetime `maxRSS`.
- Main elapsed time includes utility-process startup, typed message round trip, and worker detection.
- Packaged renderer evidence records animation-frame heartbeat and a synthetic test-button acknowledgement while the real `structure:detect` request and background Job are active.
- The JSON document declares `thresholdPolicy: observation_only`.
- Provisional advisory lines are 10,000 ms main elapsed and 512 MiB worker `maxRSS`. Crossing them adds an advisory string but does not fail the performance test.
- Hard failures are limited to invalid fixture size, detection/Job failure, invalid telemetry, packaged app failure, no 5 MiB renderer heartbeat, or no button acknowledgement while detection is pending.

Absolute performance values must not become stable regression limits from this single Windows observation. A later gate requires repeated observations across representative machines and packaged platforms.

## Task 20 Windows packaged observation

Re-recorded on 2026-07-14 using Windows x64, Electron 43.0.0 and embedded Node 24.17.0 after Task 19 reattachment and the Schema Compatibility Gate. Values are observations, not promises.

| Fixture | Bytes | Main elapsed (ms) | Worker detector (ms) | Worker max RSS (MiB) | Renderer frames | Max frame gap (ms) | Pending click acknowledged | Advisories |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 50kb-txt | 51,200 | 189.46 | 5.08 | 100.99 | 15 | 16.80 | yes | none |
| 50kb-md | 51,200 | 194.01 | 5.24 | 102.11 | 21 | 16.80 | yes | none |
| 1mb-txt | 1,048,576 | 201.04 | 23.29 | 109.57 | 20 | 17.30 | yes | none |
| 1mb-md | 1,048,576 | 208.85 | 23.00 | 109.61 | 21 | 16.80 | yes | none |
| 5mb-txt | 5,242,880 | 265.99 | 87.10 | 143.80 | 22 | 16.80 | yes | none |
| 5mb-md | 5,242,880 | 286.73 | 94.70 | 138.55 | 23 | 16.80 | yes | none |

The two 5 MiB samples retained renderer animation frames and accepted the test-button event while the real packaged detection Job was pending. This is the non-blocking hard-gate evidence; the precise frame count and gap are recorded only.

## Block 8 final Windows packaged observation

Re-recorded during final certification on 2026-07-15 using the same Windows x64, Electron 43.0.0, and embedded Node 24.17.0 boundary. All six samples completed without advisories.

| Fixture | Bytes | Main elapsed (ms) | Worker detector (ms) | Worker max RSS (MiB) | Renderer frames | Max frame gap (ms) | Pending click acknowledged | Advisories |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 50kb-txt | 51,200 | 199.43 | 5.19 | 101.93 | 21 | 16.70 | yes | none |
| 50kb-md | 51,200 | 197.85 | 5.28 | 102.71 | 15 | 16.70 | yes | none |
| 1mb-txt | 1,048,576 | 206.66 | 26.91 | 110.27 | 22 | 16.70 | yes | none |
| 1mb-md | 1,048,576 | 255.56 | 29.95 | 113.02 | 21 | 20.10 | yes | none |
| 5mb-txt | 5,242,880 | 279.06 | 87.90 | 139.60 | 22 | 16.80 | yes | none |
| 5mb-md | 5,242,880 | 372.40 | 84.63 | 142.57 | 29 | 16.70 | yes | none |

The recorder waits for automatic post-import detection to finish before starting its measured heartbeat-wrapped detection. It then records the latest recorder sample, preventing automatic and explicitly measured runs from being combined into a misleading baseline.

## Reproduction and evidence

Run in this order:

```powershell
npm run build
npx playwright test tests/e2e/structure-worker-probe.spec.ts
npx playwright test tests/e2e/structure-performance-recorder.spec.ts
```

The final command writes the machine-readable record to `test-results/structure-performance/baseline.json` and per-fixture raw records under `test-results/structure-performance/raw/`.

Playwright clears its default `test-results` output directory at the start of a separate invocation. Therefore the performance recorder must run last, or its artifact must be copied before another Playwright command. Re-running unrelated Playwright tests after the recorder is not additional performance evidence and can delete the recorded artifact.

## Protocol boundary

Required telemetry changed the typed utility-worker response shape, so `STRUCTURE_WORKER_PROTOCOL_VERSION` is version 2. StructureService intentionally depends only on `result + workerPid`; telemetry remains an internal worker/runner/main observation concern and is not exposed through product IPC or persisted as structure truth in SQLite.
