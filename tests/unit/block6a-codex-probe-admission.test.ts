import { describe, expect, it } from 'vitest';

import { admitBlock6aProbeResults } from '../../scripts/block6a-probe-admission.mjs';

const packagedSuccess = {
  task: '6A.8a',
  source: 'packaged_sdk',
  classification: 'packaged_sdk_probe_completed',
  assertions: {
    packagedProbeGateAccepted: true,
    appIsPackaged: true,
    windowsX64Runtime: true,
    packagedSdkImportConstructAndCliExecutionProvedByTurn: true,
    structuredTurnSucceeded: true,
    structuredAuthAuthenticated: true,
    structuredValidatorAccepted: true,
    structuredCleanupAcknowledged: true,
  },
};

const devSuccess = [
  {
    task: '6A.5',
    source: 'real_sdk',
    classification: 'cwd_git_env_auth_probe_completed',
    assertions: { scenarioCount: true, apiCredentialEnvironmentExcludedFromUtility: true },
    scenarios: [{
      scenario: 'current-auth-explicit-git',
      outcome: 'success',
      authClassification: 'authenticated',
      finalResponseMatched: true,
    }],
  },
  {
    task: '6A.6',
    source: 'real_sdk',
    classification: 'output_schema_probe_completed',
    assertions: { scenarioCount: true, promptAndSchemaNotPassedInProtocol: true },
    scenarios: [
      {
        scenario: 'valid-minimal',
        outcome: 'success',
        authClassification: 'authenticated',
        finalJsonParsed: true,
        strictValidatorAccepted: true,
        expectedValueMatched: true,
      },
      {
        scenario: 'invalid-schema',
        outcome: 'invalid_schema_rejected',
        invalidSchemaRejectedBySdk: true,
      },
    ],
  },
];

const lifecycleSuccess = [
  'app-timeout',
  'explicit-cancel',
  'window-close',
  'app-quit',
].map((scenario) => ({
  task: '6A.7',
  source: 'real_sdk',
  classification: 'lifecycle_probe_passed',
  assertions: { abortObserved: true, utilityResidualAbsent: true, cliResidualAbsent: true },
  result: {
    scenario,
    outcome: 'aborted',
    abortRequested: true,
    abortObserved: true,
    sdkPromiseSettled: true,
  },
  timeoutCleanup: scenario === 'app-timeout' ? {
    classification: 'graceful',
    abortRequested: true,
    abortObserved: true,
    sdkPromiseSettled: true,
    cleanupAcknowledged: true,
    utilityExitObserved: true,
  } : null,
}));

describe('Block 6A recertification result admission', () => {
  it('admits only the exact packaged success contract', () => {
    expect(admitBlock6aProbeResults('packaged', [packagedSuccess])).toEqual([
      {
        task: '6A.8a',
        source: 'packaged_sdk',
        classification: 'packaged_sdk_probe_completed',
      },
    ]);
  });

  it.each([
    ['blocked classification', { ...packagedSuccess, classification: 'packaged_sdk_probe_blocked' }],
    ['unknown classification', { ...packagedSuccess, classification: 'completed_with_warning' }],
    ['wrong source', { ...packagedSuccess, source: 'static_manifest' }],
    ['false assertion', {
      ...packagedSuccess,
      assertions: { ...packagedSuccess.assertions, structuredTurnSucceeded: false },
    }],
    ['missing assertions', { ...packagedSuccess, assertions: undefined }],
  ])('fails closed for %s', (_label, result) => {
    expect(() => admitBlock6aProbeResults('packaged', [result])).toThrow(
      'Block 6A recertification result was not admitted.',
    );
  });

  it('rejects a missing or extra packaged result', () => {
    expect(() => admitBlock6aProbeResults('packaged', [])).toThrow();
    expect(() => admitBlock6aProbeResults('packaged', [packagedSuccess, packagedSuccess])).toThrow();
  });

  it('requires a real authenticated dev success instead of admitting a completed wrapper', () => {
    expect(admitBlock6aProbeResults('dev', devSuccess)).toHaveLength(2);
    const blocked = structuredClone(devSuccess);
    Object.assign(blocked[0].scenarios[0], {
      outcome: 'login_required',
      authClassification: 'login_required',
      finalResponseMatched: null,
    });
    expect(() => admitBlock6aProbeResults('dev', blocked)).toThrow(
      'Block 6A recertification result was not admitted.',
    );
  });

  it('requires all four exact lifecycle successes', () => {
    expect(admitBlock6aProbeResults('lifecycle', lifecycleSuccess)).toHaveLength(4);
    expect(() => admitBlock6aProbeResults('lifecycle', lifecycleSuccess.slice(0, 3))).toThrow();
    const blocked = structuredClone(lifecycleSuccess);
    blocked[0].classification = 'lifecycle_probe_blocked';
    expect(() => admitBlock6aProbeResults('lifecycle', blocked)).toThrow();
  });
});
