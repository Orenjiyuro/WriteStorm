import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const productDesignPath = 'docs/product/write-storm-product-design.md';
const technicalDesignPath = 'docs/engineering/TECHNICAL_DESIGN.md';
const contextPath = 'docs/engineering/CONTEXT.md';
const decisionsPath = 'docs/engineering/DECISIONS.md';
const feasibilityPath = 'docs/engineering/V1-BLOCK-6A-CODEX-SDK-FEASIBILITY.md';
const block8aStatusPath = 'docs/engineering/V1-BLOCK-8A-STATUS.md';
const verdictEvidencePath = 'docs/engineering/evidence/block6a-task6a8b-verdict.json';

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

  it('records the Windows-only conditional Go without claiming cross-platform completion', () => {
    expect(existsSync(feasibilityPath)).toBe(true);
    const feasibility = readFileSync(feasibilityPath, 'utf8');

    expect(feasibility).toContain('Verdict: `conditional Go — Windows-only feasibility verified; macOS deferred-by-user`');
    expect(feasibility).not.toContain('Verdict: `pending`');
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

  it('commits a sanitized 6A.8b decision summary with explicit expiry conditions', () => {
    expect(existsSync(verdictEvidencePath)).toBe(true);
    const evidenceText = readFileSync(verdictEvidencePath, 'utf8');
    const evidence = JSON.parse(evidenceText) as {
      source: string;
      classification: string;
      assertions: Record<string, boolean>;
      expiryConditions: string[];
    };

    expect(evidence.source).toBe('static_manifest');
    expect(evidence.classification).toBe('conditional_go_windows_only_macos_deferred_by_user');
    expect(Object.values(evidence.assertions).every(Boolean)).toBe(true);
    expect(evidence.expiryConditions.length).toBeGreaterThanOrEqual(6);
    expect(evidenceText).not.toMatch(/"(?:prompt|stdout|stderr|pid|environmentValue|credential)"\s*:/i);
  });

  it('freezes supply-chain, process ownership, auth, and lifecycle acceptance boundaries', () => {
    const feasibility = readFileSync(feasibilityPath, 'utf8');

    expect(feasibility).toContain('Lockfile may contain all official optional platform records');
    expect(feasibility).toContain('Task 6A.2 must discover and record the actual project-local CLI path');
    expect(feasibility).toContain('utility PID, parent PID chain, process start time, and project-local executable path');
    expect(feasibility).toContain('Never terminate a Codex process whose ownership by the current probe is not proven');
    expect(feasibility).toContain('authenticated | login_required | auth_failed | unverified');
    expect(feasibility).toContain('A real success probe is blocked when authenticated state is unavailable');
    expect(feasibility).toContain('window close and app quit are distinct trigger scenarios');
    expect(feasibility).toContain('cleanup executes at most once');
  });

  it('preserves historical unexecuted facts while naming the new authority as current', () => {
    const context = readFileSync(contextPath, 'utf8');
    const decisions = readFileSync(decisionsPath, 'utf8');
    const feasibility = readFileSync(feasibilityPath, 'utf8');
    const block8aStatus = readFileSync(block8aStatusPath, 'utf8');
    const activeContext = context.slice(0, context.indexOf('Task 12R-A hardens'));

    expect(context).toContain('V1-BLOCK-6A-CODEX-SDK-FEASIBILITY.md');
    expect(context).toContain('current verdict is conditional Go for Windows-only feasibility');
    expect(context).not.toContain('Task 6A.1 establishes `docs/engineering/V1-BLOCK-6A-CODEX-SDK-FEASIBILITY.md` as the current Codex feasibility authority with verdict `pending`');
    expect(activeContext).not.toMatch(/no SDK dependency is installed|no probe has run|no Go\/No-Go decision/i);
    expect(feasibility.match(/^Verdict:/gm)).toHaveLength(1);
    expect(feasibility).not.toContain('No Windows feasibility verdict');
    expect(decisions).toContain('## D080: Codex SDK Feasibility Is Conditional Go For Windows Only');
    expect(context).toContain('At the Block 8A checkpoint, 6A feasibility remained unexecuted and unrecorded.');
    expect(block8aStatus).toContain('6A/Codex SDK feasibility remains unexecuted and unrecorded');
    expect(decisions).toContain('The early Codex feasibility gate remains unexecuted and has no Go decision.');
  });
});
