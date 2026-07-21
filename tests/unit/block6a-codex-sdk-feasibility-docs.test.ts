import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const productDesignPath = 'docs/product/write-storm-product-design.md';
const technicalDesignPath = 'docs/engineering/TECHNICAL_DESIGN.md';
const contextPath = 'docs/engineering/CONTEXT.md';
const decisionsPath = 'docs/engineering/DECISIONS.md';
const feasibilityPath = 'docs/engineering/V1-BLOCK-6A-CODEX-SDK-FEASIBILITY.md';
const block8aStatusPath = 'docs/engineering/V1-BLOCK-8A-STATUS.md';
const verdictEvidencePath = 'docs/engineering/evidence/block6a-task6a8b-verdict.json';
const pendingEvidencePath =
  'docs/engineering/evidence/block6a-remediation-pending-recertification.json';
const r8aCapabilityAttemptPath =
  'docs/engineering/evidence/block6a-r8a-windows-dev-capability-attempt.json';
const r8aOutputSchemaAttemptPath =
  'docs/engineering/evidence/block6a-r8a-windows-dev-output-schema-attempt.json';
const r8aCapabilityBlockedPath =
  'docs/engineering/evidence/block6a-r8a2-windows-dev-capability-blocked.json';
const r8aOutputSchemaBlockedPath =
  'docs/engineering/evidence/block6a-r8a2-windows-dev-output-schema-blocked.json';
const r8a3CapabilityBlockedPath =
  'docs/engineering/evidence/block6a-r8a3-windows-dev-capability-blocked.json';
const r8a3OutputSchemaBlockedPath =
  'docs/engineering/evidence/block6a-r8a3-windows-dev-output-schema-blocked.json';
const r8a5GatePath =
  'docs/engineering/evidence/block6a-remediation-r8a5-conditional-development-gate.json';
const r8a5CapabilityAdmittedPath =
  'docs/engineering/evidence/block6a-r8a5-windows-dev-capability-admitted-with-conditions.json';
const r8a5OutputSchemaAdmittedPath =
  'docs/engineering/evidence/block6a-r8a5-windows-dev-output-schema-admitted-with-conditions.json';
const r8a5LifecyclePaths = [
  'docs/engineering/evidence/block6a-r8a5-windows-lifecycle-app-timeout.json',
  'docs/engineering/evidence/block6a-r8a5-windows-lifecycle-explicit-cancel.json',
  'docs/engineering/evidence/block6a-r8a5-windows-lifecycle-window-close.json',
  'docs/engineering/evidence/block6a-r8a5-windows-lifecycle-app-quit.json',
];
const r8a5PackagedPath =
  'docs/engineering/evidence/block6a-r8a5-windows-packaged-sdk.json';
const r8a5VerdictPath =
  'docs/engineering/evidence/block6a-r8a5-windows-conditional-go-verdict.json';

describe('Block 6A Codex SDK feasibility authority', () => {
  it('keeps long-term multi-provider direction compatible with the V1 Codex-only gate', () => {
    const productDesign = readFileSync(productDesignPath, 'utf8');
    const technicalDesign = readFileSync(technicalDesignPath, 'utf8');
    const context = readFileSync(contextPath, 'utf8');
    const decisions = readFileSync(decisionsPath, 'utf8');

    expect(productDesign).toContain('长期多供应商方向');
    expect(productDesign).toContain('V1 仍然只准入 Codex SDK');
    expect(productDesign).toContain('不得静默切换');
    expect(technicalDesign).toContain('AiExecutionPort');
    expect(technicalDesign).toContain('ProviderAdapter');
    expect(technicalDesign).toContain('Task 6A does not implement formal provider registry');
    expect(context).toContain('V1 admitted provider: Codex SDK only.');
    expect(context).toContain('Long-term AI boundary: AiExecutionPort -> independent ProviderAdapter implementations.');
    expect(decisions).toContain('## D079: Long-Term Multi-Provider Direction And V1 Codex-Only Boundary');
    expect(decisions).toContain('Decision: WriteStorm has a long-term multi-provider direction, while V1 admits only Codex SDK.');

    expect(decisions).toContain('## D007: Codex SDK Is V1 AI Surface');
    expect(decisions).toContain('Decision: V1 AI integration supports Codex SDK only.');
  });

  it('records the current Windows-only conditional verdict without erasing historical states', () => {
    expect(existsSync(feasibilityPath)).toBe(true);
    const feasibility = readFileSync(feasibilityPath, 'utf8');
    const verdictLine = feasibility.split(/\r?\n/).find((line) => line.startsWith('Verdict:'));

    expect(verdictLine).toBe(
      'Verdict: `conditional Go — Windows-only feasibility verified; macOS deferred-by-user`',
    );
    expect(feasibility).toContain('Historical Task 6A.8b decision');
    expect(feasibility).toContain('Windows implementation feasibility is now verified under the recorded conditions');
    expect(feasibility).toContain('### R8a5 fresh Windows packaged result');
    expect(feasibility).toContain('every other unstructured SDK/CLI failure becomes `runtime_failed / unverified`');
    expect(feasibility).toContain('This feasibility classifier is not the Task 13 Job error contract');
    expect(feasibility).toContain('Evidence validation and recertification admission are separate states');
    expect(feasibility).toContain('`recertificationAdmitted: false`');
    expect(feasibility).toContain('### R7 remediation: final evidence lineage and artifact binding');
    expect(feasibility).toContain('criticalInputsCleanAtRun');
    expect(feasibility).toContain('git merge-base --is-ancestor');
    expect(feasibility).toContain('This is not a full Go');
    expect(feasibility).toContain('does not authorize Task 13.2');
    expect(feasibility).toContain('real_sdk');
    expect(feasibility).toContain('packaged_sdk');
    expect(feasibility).toContain('local_validator_fixture');
    expect(feasibility).toContain('static_manifest');
    expect(feasibility).toContain('Sanitized JSON summaries are committed');
    expect(feasibility).toContain('Prompts, complete stdout/stderr, environment values, credentials, auth files, and raw temporary PID logs are not committed');
    expect(feasibility).toContain('ephemeral_correlation_only');
    expect(feasibility).toContain('source = real_sdk | packaged_sdk | local_validator_fixture | static_manifest');
  });

  it('freezes R8a5 positive-core admission and safe conditional diagnostics', () => {
    const feasibility = readFileSync(feasibilityPath, 'utf8');
    const decisions = readFileSync(decisionsPath, 'utf8');
    const evidence = JSON.parse(readFileSync(r8a5GatePath, 'utf8')) as {
      source: string;
      classification: string;
      assertions: Record<string, { value: boolean; source: string }>;
    };

    expect(evidence.source).toBe('static_manifest');
    expect(evidence.classification).toBe('conditional_development_gate_frozen');
    expect(Object.values(evidence.assertions).every(
      (assertion) => assertion.value && assertion.source === 'static_manifest',
    )).toBe(true);
    expect(feasibility).toContain('admission: admitted_with_conditions');
    expect(feasibility).toContain('safeFailureCode: SDK_RUNTIME_UNAVAILABLE');
    expect(feasibility).toContain('current-auth non-Git behavioral differential');
    expect(feasibility).toContain('tenth ordered lineage input');
    expect(decisions).toContain(
      '## D089: Development Admission Uses Positive Capabilities and Conditional Diagnostics',
    );
  });

  it('records the fresh R8a5 admitted-with-conditions development evidence', () => {
    const records = [r8a5CapabilityAdmittedPath, r8a5OutputSchemaAdmittedPath].map(
      (recordPath) => JSON.parse(readFileSync(recordPath, 'utf8')) as {
        source: string;
        classification: string;
        scenarios: Array<Record<string, unknown>>;
        lineage: { gitHeadAtRun: string; criticalInputsCleanAtRun: boolean; evidenceInputs: unknown[] };
      },
    );
    const capability = records[0];
    const outputSchema = records[1];
    const feasibility = readFileSync(feasibilityPath, 'utf8');
    const decisions = readFileSync(decisionsPath, 'utf8');

    expect(capability.scenarios).toHaveLength(7);
    expect(capability.scenarios).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scenario: 'current-auth-non-git-check',
        outcome: 'runtime_failed',
        safeFailureCode: 'SDK_RUNTIME_UNAVAILABLE',
      }),
      expect.objectContaining({
        scenario: 'current-auth-non-git-skip',
        outcome: 'success',
        safeFailureCode: null,
        finalResponseMatched: true,
      }),
    ]));
    expect(outputSchema.scenarios).toEqual(expect.arrayContaining([
      expect.objectContaining({ scenario: 'valid-minimal', outcome: 'success' }),
      expect.objectContaining({ scenario: 'invalid-schema', outcome: 'invalid_schema_rejected' }),
    ]));
    for (const record of records) {
      expect(record.source).toBe('real_sdk');
      expect(record.lineage.gitHeadAtRun).toBe('9eb679cb2b20c33f1e14a12a48f6ff246d4aaf24');
      expect(record.lineage.criticalInputsCleanAtRun).toBe(true);
      expect(record.lineage.evidenceInputs).toHaveLength(10);
      expect(JSON.stringify(record)).not.toMatch(
        /"(?:prompt|responseBody|stdout|stderr|pid|environmentValue|credential|authFile|executablePath|rawError|token)"\s*:/i,
      );
    }
    expect(feasibility).toContain('### R8a5 fresh development result');
    expect(feasibility).toContain('`admission: admitted_with_conditions`');
    expect(decisions).toContain('## D090: Fresh R8a5 Development Gate Is Admitted With Conditions');
  });

  it('records the fresh R8a5 Windows lifecycle evidence without restoring the verdict', () => {
    const records = r8a5LifecyclePaths.map((recordPath) =>
      JSON.parse(readFileSync(recordPath, 'utf8')) as {
        source: string;
        classification: string;
        assertions: Record<string, { value: boolean; source: string }>;
        processAssertions: Record<string, { value: boolean; source: string }>;
        result: { scenario: string; trigger: string };
        timeoutCleanup: null | { classification: string; utilityKillAttempted: boolean };
        lifecycleEvents: {
          initialTrigger: string;
          cleanupRequestCount: number;
          cleanupExecutionCount: number;
        };
        lineage: {
          gitHeadAtRun: string;
          criticalInputsCleanAtRun: boolean;
          packagedArtifactSha256: null;
          evidenceInputs: unknown[];
        };
      },
    );
    const feasibility = readFileSync(feasibilityPath, 'utf8');
    const decisions = readFileSync(decisionsPath, 'utf8');

    expect(records.map((record) => record.result.scenario)).toEqual([
      'app-timeout',
      'explicit-cancel',
      'window-close',
      'app-quit',
    ]);
    for (const record of records) {
      expect(record.source).toBe('real_sdk');
      expect(record.classification).toBe('lifecycle_probe_passed');
      expect(record.result.trigger).toBe(record.result.scenario);
      expect(Object.values(record.assertions).every(
        (assertion) => assertion.value && assertion.source === 'real_sdk',
      )).toBe(true);
      expect(Object.values(record.processAssertions).every(
        (assertion) => assertion.value && assertion.source === 'real_sdk',
      )).toBe(true);
      expect(record.lifecycleEvents.initialTrigger).toBe(record.result.scenario);
      expect(record.lifecycleEvents.cleanupExecutionCount).toBe(1);
      expect(record.lineage).toMatchObject({
        gitHeadAtRun: 'b29c8599ec432eb03d197b05f3e9ccb571511f22',
        criticalInputsCleanAtRun: true,
        packagedArtifactSha256: null,
      });
      expect(record.lineage.evidenceInputs).toHaveLength(10);
      expect(JSON.stringify(record)).not.toMatch(
        /"(?:prompt|responseBody|stdout|stderr|pid|environmentValue|credential|authFile|executablePath|processList|rawError|token)"\s*:/i,
      );
    }
    expect(records[0].timeoutCleanup).toEqual(expect.objectContaining({
      classification: 'graceful',
      utilityKillAttempted: false,
    }));
    expect(records[2].lifecycleEvents.cleanupRequestCount).toBe(2);
    expect(records[3].lifecycleEvents.cleanupRequestCount).toBe(1);
    expect(feasibility).toContain('### R8a5 fresh Windows lifecycle result');
    expect(feasibility).toContain('Fresh lifecycle success authorizes only the next Windows packaged feasibility gate');
    expect(decisions).toContain(
      '## D091: Fresh Windows Lifecycle Gate Passes and Unlocks Packaged Recertification',
    );
  });

  it('binds the fresh Windows packaged result and conditional verdict to exact evidence', () => {
    const packagedText = readFileSync(r8a5PackagedPath, 'utf8');
    const packaged = JSON.parse(packagedText) as {
      source: string;
      classification: string;
      assertions: Record<string, {
        value: boolean;
        source: string;
        evidenceId: string;
        classification: string;
      }>;
      runtime: { platform: string; architecture: string };
      structuredResult: {
        outcome: string;
        authClassification: string;
        finalJsonParsed: boolean;
        strictValidatorAccepted: boolean;
        expectedValueMatched: boolean;
      };
      lineage: {
        gitHeadAtRun: string;
        criticalInputsCleanAtRun: boolean;
        packagedArtifactSha256: string;
        evidenceInputs: unknown[];
      };
    };
    const verdict = JSON.parse(readFileSync(r8a5VerdictPath, 'utf8')) as {
      source: string;
      classification: string;
      verdict: string;
      assertions: Record<string, { value: boolean; source: string }>;
      evidenceInputs: Array<{
        evidenceId: string;
        source: string;
        classification: string;
        sha256: string;
        supports: string[];
      }>;
    };
    const inputPaths = new Map([
      ['block6a-6a5-real-sdk-cwd-git-env-auth-001', r8a5CapabilityAdmittedPath],
      ['block6a-6a6-real-sdk-output-schema-001', r8a5OutputSchemaAdmittedPath],
      ['block6a-6a7-real-sdk-app-timeout-001', r8a5LifecyclePaths[0]],
      ['block6a-6a7-real-sdk-explicit-cancel-001', r8a5LifecyclePaths[1]],
      ['block6a-6a7-real-sdk-window-close-001', r8a5LifecyclePaths[2]],
      ['block6a-6a7-real-sdk-app-quit-001', r8a5LifecyclePaths[3]],
      ['block6a-6a8a-packaged-sdk-windows-001', r8a5PackagedPath],
    ]);

    expect(packaged.source).toBe('packaged_sdk');
    expect(packaged.classification).toBe('packaged_sdk_probe_completed');
    expect(packaged.runtime).toEqual({ platform: 'win32', architecture: 'x64' });
    expect(packaged.structuredResult).toMatchObject({
      outcome: 'success',
      authClassification: 'authenticated',
      finalJsonParsed: true,
      strictValidatorAccepted: true,
      expectedValueMatched: true,
    });
    expect(Object.values(packaged.assertions).every((assertion) => assertion.value)).toBe(true);
    expect(packaged.assertions.apiCredentialEnvironmentExcludedFromUtility.source).toBe(
      'static_manifest',
    );
    expect(packaged.assertions.promptAndSchemaNotPassedInProtocol.source).toBe('static_manifest');
    expect(Object.entries(packaged.assertions)
      .filter(([key]) => ![
        'apiCredentialEnvironmentExcludedFromUtility',
        'promptAndSchemaNotPassedInProtocol',
      ].includes(key))
      .every(([, assertion]) => assertion.source === 'packaged_sdk')).toBe(true);
    expect(packaged.lineage).toMatchObject({
      gitHeadAtRun: 'da756385552d9e2ff83e4baa37cc4e15ce5528ff',
      criticalInputsCleanAtRun: true,
    });
    expect(packaged.lineage.packagedArtifactSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(packaged.lineage.evidenceInputs).toHaveLength(10);
    expect(packagedText).not.toMatch(
      /"(?:prompt|responseBody|stdout|stderr|pid|environmentValue|credential|authFile|executablePath|processList|rawError|token)"\s*:/i,
    );

    expect(verdict.source).toBe('static_manifest');
    expect(verdict.classification).toBe(
      'conditional_go_windows_only_macos_deferred_by_user',
    );
    expect(verdict.verdict).toBe(
      'conditional Go — Windows-only feasibility verified; macOS deferred-by-user',
    );
    expect(Object.values(verdict.assertions).every(
      (assertion) => assertion.value && assertion.source === 'static_manifest',
    )).toBe(true);
    expect(verdict.evidenceInputs).toHaveLength(7);
    for (const input of verdict.evidenceInputs) {
      const inputPath = inputPaths.get(input.evidenceId);
      expect(inputPath).toBeTruthy();
      expect(input.sha256).toBe(
        createHash('sha256').update(readFileSync(inputPath as string)).digest('hex'),
      );
      expect(['real_sdk', 'packaged_sdk']).toContain(input.source);
      expect(input.classification).toBeTruthy();
      expect(input.supports.length).toBeGreaterThan(0);
    }
    expect(readFileSync(feasibilityPath, 'utf8')).toContain(
      '### R8a5 fresh Windows packaged result',
    );
    expect(readFileSync(decisionsPath, 'utf8')).toContain(
      '## D092: Fresh Packaged Evidence Restores Windows-Only Conditional Go',
    );
    expect(readFileSync(feasibilityPath, 'utf8')).toContain('### Fresh full-check status');
    expect(readFileSync(feasibilityPath, 'utf8')).toContain(
      'This record does not claim a fully green repository check',
    );
  });

  it('retains the historical pending-status checkpoint without making it current', () => {
    expect(existsSync(pendingEvidencePath)).toBe(true);
    const pending = JSON.parse(readFileSync(pendingEvidencePath, 'utf8')) as {
      source: string;
      classification: string;
      assertions: Record<string, boolean>;
      historicalAuthority: string;
    };

    expect(pending.source).toBe('static_manifest');
    expect(pending.classification).toBe('windows_conditional_verdict_pending_recertification');
    expect(Object.values(pending.assertions).every(Boolean)).toBe(true);
    expect(pending.historicalAuthority).toBe(
      'block6a-task6a8b-verdict.json remains an expired historical decision record',
    );
    expect(readFileSync(feasibilityPath, 'utf8')).toContain(
      'remains the historical R1–R7 pending-status checkpoint and is no longer the current decision',
    );
  });

  it('records the lineage-bound R8a timeout attempt without upgrading it to accepted evidence', () => {
    const feasibility = readFileSync(feasibilityPath, 'utf8');
    const decisions = readFileSync(decisionsPath, 'utf8');
    const records = [r8aCapabilityAttemptPath, r8aOutputSchemaAttemptPath].map((filePath) =>
      JSON.parse(readFileSync(filePath, 'utf8')) as {
        source: string;
        classification: string;
        failure: {
          reason: string;
          terminationCleanup: Record<string, boolean | string>;
        };
        lineage: {
          gitHeadAtRun: string;
          criticalInputsCleanAtRun: boolean;
          evidenceInputs: unknown[];
        };
      });

    for (const record of records) {
      expect(record.source).toBe('real_sdk');
      expect(record.classification).toBe('probe_infrastructure_failed');
      expect(record.failure.reason).toBe('timeout');
      expect(record.failure.terminationCleanup).toMatchObject({
        classification: 'graceful',
        abortRequested: true,
        abortObserved: true,
        sdkPromiseSettled: true,
        cleanupAcknowledged: true,
        utilityExitObserved: true,
        residualScanCompleted: true,
        utilityResidualAbsent: true,
        cliResidualAbsent: true,
      });
      expect(record.lineage).toMatchObject({
        gitHeadAtRun: '74ec65f4d91990caf03a6723140037374d4ba768',
        criticalInputsCleanAtRun: true,
      });
      expect(record.lineage.evidenceInputs).toHaveLength(6);
      expect(JSON.stringify(record)).not.toMatch(
        /"(?:prompt|stdout|stderr|pid|environmentValue|credential|executablePath)"\s*:/i,
      );
    }
    expect(feasibility).toContain('### R8a 2026-07-20 Windows development recertification attempt');
    expect(feasibility).toContain('did not reach `evidenceAccepted`');
    expect(decisions).toContain('## D082: R8a Development Recertification Attempt Timed Out Fail-Closed');
    expect(feasibility).toContain('### R8a turn-deadline remediation boundary');
    expect(feasibility).toContain(
      'both R8a attempt records remain historical failed-attempt evidence',
    );
    expect(decisions).toContain(
      '## D083: R8a SDK Turn Deadline Is Separate from Utility Session Supervision',
    );
  });

  it('retains the fresh complete R8a evidence while blocking recertification admission', () => {
    const feasibility = readFileSync(feasibilityPath, 'utf8');
    const context = readFileSync(contextPath, 'utf8');
    const decisions = readFileSync(decisionsPath, 'utf8');
    const capability = JSON.parse(readFileSync(r8aCapabilityBlockedPath, 'utf8')) as {
      source: string;
      classification: string;
      scenarios: Array<{
        scenario: string;
        outcome: string;
        authClassification: string;
        utilityCwdMatchedExpected: boolean;
      }>;
      lineage: {
        gitHeadAtRun: string;
        criticalInputsCleanAtRun: boolean;
        packagedArtifactSha256: null;
        evidenceInputs: unknown[];
      };
    };
    const outputSchema = JSON.parse(readFileSync(r8aOutputSchemaBlockedPath, 'utf8')) as {
      source: string;
      classification: string;
      scenarios: Array<{
        scenario: string;
        outcome: string;
        authClassification: string;
      }>;
      lineage: typeof capability.lineage;
    };

    expect(capability.source).toBe('real_sdk');
    expect(capability.classification).toBe('cwd_git_env_auth_probe_completed');
    expect(capability.scenarios.map(({ scenario }) => scenario)).toEqual([
      'default-git-isolated-auth',
      'explicit-git-isolated-auth',
      'explicit-non-git-isolated-auth',
      'skip-non-git-isolated-auth',
      'current-auth-explicit-git',
    ]);
    expect(capability.scenarios.every((scenario) =>
      scenario.outcome === 'runtime_failed'
      && scenario.authClassification === 'unverified'
      && scenario.utilityCwdMatchedExpected
    )).toBe(true);
    expect(outputSchema.source).toBe('real_sdk');
    expect(outputSchema.classification).toBe('output_schema_probe_completed');
    expect(outputSchema.scenarios).toEqual([
      expect.objectContaining({
        scenario: 'valid-minimal',
        outcome: 'runtime_failed',
        authClassification: 'unverified',
      }),
      expect.objectContaining({
        scenario: 'invalid-schema',
        outcome: 'runtime_failed',
        authClassification: 'unverified',
      }),
    ]);
    for (const record of [capability, outputSchema]) {
      expect(record.lineage).toMatchObject({
        gitHeadAtRun: 'e1db3d2454dc568ca591ae7c72d44b83d92e6723',
        criticalInputsCleanAtRun: true,
        packagedArtifactSha256: null,
      });
      expect(record.lineage.evidenceInputs).toHaveLength(6);
      expect(JSON.stringify(record)).not.toMatch(
        /"(?:prompt|responseBody|stdout|stderr|pid|environmentValue|credential|authFile|executablePath|token)"\s*:/i,
      );
    }
    expect(feasibility).toContain(
      '### R8a fresh development recertification result after deadline remediation',
    );
    expect(feasibility).toContain('Admission rejected the complete evidence');
    expect(context).toContain('blocked at the development gate');
    expect(decisions).toContain('## D084: Fresh R8a Development Evidence Is Valid but Not Admitted');
    expect(feasibility).toContain('### R8a3 safe runtime-failure attribution');
    expect(feasibility).toContain('`local_turn_deadline`');
    expect(feasibility).toContain('`sdk_unstructured`');
    expect(feasibility).toContain('future runtime evidence therefore carries eight input ids and hashes');
    expect(decisions).toContain('## D085: Runtime Failure Attribution Is Local and Non-Causal');
  });

  it('records the fresh R8a3 origins without promoting them to causal classifications', () => {
    const feasibility = readFileSync(feasibilityPath, 'utf8');
    const decisions = readFileSync(decisionsPath, 'utf8');
    const capability = JSON.parse(readFileSync(r8a3CapabilityBlockedPath, 'utf8')) as {
      source: string;
      classification: string;
      scenarios: Array<{
        scenario: string;
        outcome: string;
        authClassification: string;
        runtimeFailureOrigin: string;
      }>;
      lineage: {
        gitHeadAtRun: string;
        criticalInputsCleanAtRun: boolean;
        evidenceInputs: unknown[];
      };
    };
    const outputSchema = JSON.parse(readFileSync(r8a3OutputSchemaBlockedPath, 'utf8')) as {
      source: string;
      classification: string;
      scenarios: typeof capability.scenarios;
      lineage: typeof capability.lineage;
    };

    expect(capability.source).toBe('real_sdk');
    expect(capability.classification).toBe('cwd_git_env_auth_probe_completed');
    expect(capability.scenarios.map(({ scenario, runtimeFailureOrigin }) => ({
      scenario,
      runtimeFailureOrigin,
    }))).toEqual([
      { scenario: 'default-git-isolated-auth', runtimeFailureOrigin: 'local_turn_deadline' },
      { scenario: 'explicit-git-isolated-auth', runtimeFailureOrigin: 'local_turn_deadline' },
      { scenario: 'explicit-non-git-isolated-auth', runtimeFailureOrigin: 'sdk_unstructured' },
      { scenario: 'skip-non-git-isolated-auth', runtimeFailureOrigin: 'local_turn_deadline' },
      { scenario: 'current-auth-explicit-git', runtimeFailureOrigin: 'local_turn_deadline' },
    ]);
    expect(outputSchema.source).toBe('real_sdk');
    expect(outputSchema.classification).toBe('output_schema_probe_completed');
    expect(outputSchema.scenarios.map(({ scenario, runtimeFailureOrigin }) => ({
      scenario,
      runtimeFailureOrigin,
    }))).toEqual([
      { scenario: 'valid-minimal', runtimeFailureOrigin: 'local_turn_deadline' },
      { scenario: 'invalid-schema', runtimeFailureOrigin: 'sdk_unstructured' },
    ]);
    for (const record of [capability, outputSchema]) {
      expect(record.scenarios.every((scenario) =>
        scenario.outcome === 'runtime_failed'
        && scenario.authClassification === 'unverified'
      )).toBe(true);
      expect(record.lineage).toMatchObject({
        gitHeadAtRun: 'c7fa67271aac1f0a8b0fc7ec112e4a74080004dd',
        criticalInputsCleanAtRun: true,
      });
      expect(record.lineage.evidenceInputs).toHaveLength(8);
      expect(JSON.stringify(record)).not.toMatch(
        /"(?:prompt|responseBody|stdout|stderr|pid|environmentValue|credential|authFile|executablePath|rawError|token)"\s*:/i,
      );
    }
    expect(feasibility).toContain('### R8a3 fresh development result with safe failure origins');
    expect(feasibility).toContain('`evidenceAccepted: true`');
    expect(feasibility).toContain('`recertificationAdmitted: false`');
    expect(decisions).toContain('## D086: Fresh R8a3 Development Run Remains Blocked with Safe Origins');
  });

  it('commits a sanitized 6A.8b decision summary with explicit expiry conditions', () => {
    expect(existsSync(verdictEvidencePath)).toBe(true);
    const evidenceText = readFileSync(verdictEvidencePath, 'utf8');
    const evidence = JSON.parse(evidenceText) as {
      source: string;
      classification: string;
      assertions: Record<string, boolean>;
      evidenceInputs: Array<{
        evidenceId: string;
        source: string;
        classification: string;
        supports: string[];
      }>;
      expiryConditions: string[];
    };

    expect(evidence.source).toBe('static_manifest');
    expect(evidence.classification).toBe('conditional_go_windows_only_macos_deferred_by_user');
    expect(Object.values(evidence.assertions).every(Boolean)).toBe(true);
    expect(Object.keys(evidence.assertions)).toEqual([
      'authoritySourcesReconciledWithoutProvenanceUpgrade',
      'macosDeferredByUserRecorded',
      'noFallbackAuthorized',
      'noTask13Point2AuthorizationIssued',
      'historicalUnexecutedFactsPreserved',
      'currentAuthorityOverrideRecorded',
      'naturalWriteStormLoginNotClaimed',
      'crossPlatformAndReleaseReadinessNotClaimed',
    ]);
    expect(evidence.evidenceInputs.length).toBeGreaterThanOrEqual(8);
    for (const input of evidence.evidenceInputs) {
      expect(['real_sdk', 'packaged_sdk', 'local_validator_fixture', 'static_manifest']).toContain(input.source);
      expect(input.evidenceId).toBeTruthy();
      expect(input.classification).toBeTruthy();
      expect(input.supports.length).toBeGreaterThan(0);
    }
    expect(evidence.expiryConditions.length).toBeGreaterThanOrEqual(6);
    expect(evidenceText).not.toMatch(/"(?:prompt|stdout|stderr|pid|environmentValue|credential)"\s*:/i);
  });

  it('freezes supply-chain, process ownership, auth, and lifecycle acceptance boundaries', () => {
    const feasibility = readFileSync(feasibilityPath, 'utf8');

    expect(feasibility).toContain('Lockfile may contain all official optional platform records');
    expect(feasibility).toContain('Task 6A.2 must discover and record the actual project-local CLI path');
    expect(feasibility).toContain('Every identity binds PID, parent PID, creation time and executable path; PID alone is never identity');
    expect(feasibility).toContain('freezes those exact identities for that session');
    expect(feasibility).toContain('duplicate PID observation, incomplete chain or multiple attributed CLI candidates fails closed');
    expect(feasibility).toContain('Never terminate a Codex process whose ownership by the current probe is not proven');
    expect(feasibility).toContain('authenticated | login_required | auth_failed | unverified');
    expect(feasibility).toContain('A real success probe is blocked when authenticated state is unavailable');
    expect(feasibility).toContain('window close and app quit are distinct trigger scenarios');
    expect(feasibility).toContain('cleanup executes at most once');
    expect(feasibility).toContain('freezes the complete top-level evidence envelope');
    expect(feasibility).toContain('`prompt`, `stdout`, `stderr`, arbitrary producer fields');
    expect(feasibility).toContain('exact string allowlist rather than a free-text channel');
  });

  it('preserves historical unexecuted facts while naming the new authority as current', () => {
    const context = readFileSync(contextPath, 'utf8');
    const decisions = readFileSync(decisionsPath, 'utf8');
    const feasibility = readFileSync(feasibilityPath, 'utf8');
    const block8aStatus = readFileSync(block8aStatusPath, 'utf8');
    const activeContext = context.slice(0, context.indexOf('Task 12R-A hardens'));

    expect(context).toContain('V1-BLOCK-6A-CODEX-SDK-FEASIBILITY.md');
    expect(context).toContain(
      'current verdict is `conditional Go — Windows-only feasibility verified; macOS deferred-by-user`',
    );
    expect(context).not.toContain('Task 6A.1 establishes `docs/engineering/V1-BLOCK-6A-CODEX-SDK-FEASIBILITY.md` as the current Codex feasibility authority with verdict `pending`');
    expect(activeContext).not.toMatch(/no SDK dependency is installed|no probe has run|no Go\/No-Go decision/i);
    expect(feasibility.match(/^Verdict:/gm)).toHaveLength(1);
    expect(feasibility).toContain(
      'Windows implementation feasibility is now verified under the recorded conditions',
    );
    expect(feasibility).toContain('the fresh R8a5 Windows-only conditional reissue');
    expect(decisions).toContain('## D080: Codex SDK Feasibility Is Conditional Go For Windows Only');
    expect(decisions).toContain('## D081: Current Codex Feasibility Verdict Is Pending Recertification');
    expect(decisions).toContain('D080 remains a historical decision and is expired for the current working tree');
    expect(context).toContain('At the Block 8A checkpoint, 6A feasibility remained unexecuted and unrecorded.');
    expect(block8aStatus).toContain('6A/Codex SDK feasibility remains unexecuted and unrecorded');
    expect(decisions).toContain('The early Codex feasibility gate remains unexecuted and has no Go decision.');
  });
});
