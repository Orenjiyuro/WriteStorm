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

  it('marks the current implementation pending recertification without erasing the historical verdict', () => {
    expect(existsSync(feasibilityPath)).toBe(true);
    const feasibility = readFileSync(feasibilityPath, 'utf8');
    const verdictLine = feasibility.split(/\r?\n/).find((line) => line.startsWith('Verdict:'));

    expect(verdictLine).toBe(
      'Verdict: `pending recertification — historical Windows-only conditional Go expired for the current working tree; macOS deferred-by-user`',
    );
    expect(feasibility).toContain('Historical Task 6A.8b decision');
    expect(feasibility).toContain('The current implementation is not Windows-feasibility verified');
    expect(feasibility).toContain('Fresh R8 Windows lifecycle and packaged evidence is required');
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

  it('records a static current-status override without rewriting historical runtime evidence', () => {
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
    expect(context).toContain('current status is pending Windows recertification');
    expect(context).not.toContain('Task 6A.1 establishes `docs/engineering/V1-BLOCK-6A-CODEX-SDK-FEASIBILITY.md` as the current Codex feasibility authority with verdict `pending`');
    expect(activeContext).not.toMatch(/no SDK dependency is installed|no probe has run|no Go\/No-Go decision/i);
    expect(feasibility.match(/^Verdict:/gm)).toHaveLength(1);
    expect(feasibility).toContain('No current Windows feasibility verdict may be reissued before R8');
    expect(decisions).toContain('## D080: Codex SDK Feasibility Is Conditional Go For Windows Only');
    expect(decisions).toContain('## D081: Current Codex Feasibility Verdict Is Pending Recertification');
    expect(decisions).toContain('D080 remains a historical decision and is expired for the current working tree');
    expect(context).toContain('At the Block 8A checkpoint, 6A feasibility remained unexecuted and unrecorded.');
    expect(block8aStatus).toContain('6A/Codex SDK feasibility remains unexecuted and unrecorded');
    expect(decisions).toContain('The early Codex feasibility gate remains unexecuted and has no Go decision.');
  });
});
