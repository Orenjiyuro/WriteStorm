import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  admitBlock6aProbeResults,
  evaluateBlock6aProbeResults,
} from '../../scripts/block6a-probe-admission.mjs';

const versions = {
  electron: '43.0.0',
  nodeRuntime: '24.17.0',
  codexSdk: '0.144.6',
};
const r2EvidenceId = 'block6a-remediation-r2-environment-boundary-001';
const r6EvidenceId = 'block6a-remediation-r6-assertion-provenance-001';

function assertion(source: string, evidenceId: string, classification: string) {
  return { value: true, source, evidenceId, classification };
}

function lineage(packaged: boolean) {
  return {
    gitHeadAtRun: '1'.repeat(40),
    criticalInputsCleanAtRun: true,
    packageLockSha256: 'a'.repeat(64),
    runtimeBoundarySha256: 'b'.repeat(64),
    packagedArtifactSha256: packaged ? 'c'.repeat(64) : null,
    evidenceInputs: [
      'block6a-remediation-r2-environment-boundary-001',
      'block6a-remediation-r4a-process-ownership-001',
      'block6a-remediation-r4b-safe-termination-001',
      'block6a-remediation-r5-error-classification-001',
      'block6a-remediation-r6-assertion-provenance-001',
      'block6a-remediation-r7-evidence-lineage-001',
      'block6a-remediation-r8a-turn-deadline-001',
      'block6a-remediation-r8a3-runtime-failure-origin-001',
    ].map((evidenceId, index) => ({
      evidenceId,
      sha256: String(index + 1).repeat(64),
    })),
  };
}

const capabilityLimitations = [
  'No prompt, path, environment value, credential, PID or raw SDK error is retained.',
  'The current-auth scenario classifies the existing state but does not create or modify login state.',
  'WriteStorm has no product login UI in Task 6A.5.',
  'Unstructured SDK or CLI failures are retained only as runtime_failed / unverified and block recertification.',
];
const outputSchemaLimitations = [
  'No prompt, response body, path, environment value, credential, PID or raw SDK error is retained.',
  'The invalid schema scenario proves the installed SDK plain-object guard, not a remote model-generated invalid object.',
  'Missing-field and extra-field behavior is recorded separately as local_validator_fixture.',
];
const lifecycleLimitations = [
  'Process identities are used ephemerally and no path, PID, process list, prompt or raw SDK error is retained.',
  'The observer correlates only exact utility ancestry, start time and the project-local CLI executable path.',
  'No CLI process is terminated directly; an unowned Codex process is never touched.',
];
const packagedLimitations = [
  'No prompt, response body, path, environment value, credential, PID or raw SDK error is retained.',
  'This is Windows x64 packaged runtime evidence only.',
  'A separate packaged manifest-inspection command timed out; executable provenance is instead established by the real SDK turn plus the package guard.',
  'macOS packaged runtime remains deferred-by-user.',
];

const packagedSuccess = {
  schemaVersion: 1,
  evidenceId: 'block6a-6a8a-packaged-sdk-windows-001',
  task: '6A.8a',
  source: 'packaged_sdk',
  recordedAt: '2026-07-19T08:17:33.626Z',
  commandName: 'writestorm-packaged-codex-sdk-probe',
  classification: 'packaged_sdk_probe_completed',
  versions: {
    ...versions,
    codexCli: '0.144.6',
    platformPackage: '0.144.6-win32-x64',
  },
  assertions: {
    packagedProbeGateAccepted: assertion('packaged_sdk', 'block6a-6a8a-packaged-sdk-windows-001', 'packaged_sdk_probe_completed'),
    appIsPackaged: assertion('packaged_sdk', 'block6a-6a8a-packaged-sdk-windows-001', 'packaged_sdk_probe_completed'),
    windowsX64Runtime: assertion('packaged_sdk', 'block6a-6a8a-packaged-sdk-windows-001', 'packaged_sdk_probe_completed'),
    approvedSyntheticInputHashMatched: assertion('packaged_sdk', 'block6a-6a8a-packaged-sdk-windows-001', 'packaged_sdk_probe_completed'),
    approvedSyntheticExpectedHashMatched: assertion('packaged_sdk', 'block6a-6a8a-packaged-sdk-windows-001', 'packaged_sdk_probe_completed'),
    resultPathDerivedFromValidatedRunIdUnderOsTemp: assertion('packaged_sdk', 'block6a-6a8a-packaged-sdk-windows-001', 'packaged_sdk_probe_completed'),
    packagedSdkImportConstructAndCliExecutionProvedByTurn: assertion('packaged_sdk', 'block6a-6a8a-packaged-sdk-windows-001', 'packaged_sdk_probe_completed'),
    structuredTurnSucceeded: assertion('packaged_sdk', 'block6a-6a8a-packaged-sdk-windows-001', 'packaged_sdk_probe_completed'),
    structuredAuthAuthenticated: assertion('packaged_sdk', 'block6a-6a8a-packaged-sdk-windows-001', 'packaged_sdk_probe_completed'),
    structuredFinalJsonParsed: assertion('packaged_sdk', 'block6a-6a8a-packaged-sdk-windows-001', 'packaged_sdk_probe_completed'),
    structuredValidatorAccepted: assertion('packaged_sdk', 'block6a-6a8a-packaged-sdk-windows-001', 'packaged_sdk_probe_completed'),
    structuredExpectedValueMatched: assertion('packaged_sdk', 'block6a-6a8a-packaged-sdk-windows-001', 'packaged_sdk_probe_completed'),
    structuredCleanupAcknowledged: assertion('packaged_sdk', 'block6a-6a8a-packaged-sdk-windows-001', 'packaged_sdk_probe_completed'),
    workspaceOutsidePackagedResources: assertion('packaged_sdk', 'block6a-6a8a-packaged-sdk-windows-001', 'packaged_sdk_probe_completed'),
    apiCredentialEnvironmentExcludedFromUtility: assertion('static_manifest', r2EvidenceId, 'utility_environment_boundary_frozen'),
    promptAndSchemaNotPassedInProtocol: assertion('static_manifest', r6EvidenceId, 'typed_protocol_boundary_frozen'),
  },
  syntheticBoundary: {
    inputSha256: '59a9268039bb5bad326151cbe27320c64c89cbf5b054035978c432a4ce5c4a26',
    expectedSha256: '6fe7aac1e4d9ae4aec0a14e6bfd46af4ee18892c247a2d0aecfa5091f017afab',
    resultPathPolicy: 'os_temp_validated_uuid_v4',
  },
  runtime: { platform: 'win32', architecture: 'x64' },
  structuredResult: {
    scenario: 'valid-minimal',
    outcome: 'success',
    authClassification: 'authenticated',
    runtimeFailureOrigin: null,
    finalJsonParsed: true,
    strictValidatorAccepted: true,
    expectedValueMatched: true,
    invalidSchemaRejectedBySdk: false,
  },
  limitations: packagedLimitations,
  lineage: lineage(true),
};

const capabilityScenarios = [
  {
    scenario: 'default-git-isolated-auth',
    utilityCwdMatchedExpected: true,
    explicitWorkingDirectoryRequested: false,
    skipGitRepoCheck: false,
    envPolicy: 'explicit_allowlist_no_api_credentials',
    outcome: 'runtime_failed',
    authClassification: 'unverified',
    runtimeFailureOrigin: 'sdk_unstructured',
    finalResponseMatched: null,
  },
  {
    scenario: 'explicit-git-isolated-auth',
    utilityCwdMatchedExpected: true,
    explicitWorkingDirectoryRequested: true,
    skipGitRepoCheck: false,
    envPolicy: 'explicit_allowlist_no_api_credentials',
    outcome: 'runtime_failed',
    authClassification: 'unverified',
    runtimeFailureOrigin: 'sdk_unstructured',
    finalResponseMatched: null,
  },
  {
    scenario: 'explicit-non-git-isolated-auth',
    utilityCwdMatchedExpected: true,
    explicitWorkingDirectoryRequested: true,
    skipGitRepoCheck: false,
    envPolicy: 'explicit_allowlist_no_api_credentials',
    outcome: 'runtime_failed',
    authClassification: 'unverified',
    runtimeFailureOrigin: 'sdk_unstructured',
    finalResponseMatched: null,
  },
  {
    scenario: 'skip-non-git-isolated-auth',
    utilityCwdMatchedExpected: true,
    explicitWorkingDirectoryRequested: true,
    skipGitRepoCheck: true,
    envPolicy: 'explicit_allowlist_no_api_credentials',
    outcome: 'runtime_failed',
    authClassification: 'unverified',
    runtimeFailureOrigin: 'sdk_unstructured',
    finalResponseMatched: null,
  },
  {
    scenario: 'current-auth-explicit-git',
    utilityCwdMatchedExpected: true,
    explicitWorkingDirectoryRequested: true,
    skipGitRepoCheck: false,
    envPolicy: 'explicit_allowlist_no_api_credentials',
    outcome: 'success',
    authClassification: 'authenticated',
    runtimeFailureOrigin: null,
    finalResponseMatched: true,
  },
];

const devSuccess = [
  {
    schemaVersion: 1,
    evidenceId: 'block6a-6a5-real-sdk-cwd-git-env-auth-001',
    task: '6A.5',
    source: 'real_sdk',
    recordedAt: '2026-07-19T08:12:30.877Z',
    commandName: 'block6a-electron-utility-cwd-git-env-auth-probe',
    classification: 'cwd_git_env_auth_probe_completed',
    versions,
    assertions: {
      probeRootOutsideSourceRepository: assertion('static_manifest', r6EvidenceId, 'local_probe_boundary_observed'),
      workspacesOutsideLibraryRoot: assertion('static_manifest', r6EvidenceId, 'local_probe_boundary_observed'),
      workspacesOutsidePackagedResources: assertion('static_manifest', r6EvidenceId, 'local_probe_boundary_observed'),
      apiCredentialEnvironmentExcludedFromUtility: assertion('static_manifest', r2EvidenceId, 'utility_environment_boundary_frozen'),
      syntheticInputNotPassedInProtocol: assertion('static_manifest', r6EvidenceId, 'typed_protocol_boundary_frozen'),
      scenarioCount: assertion('real_sdk', 'block6a-6a5-real-sdk-cwd-git-env-auth-001', 'cwd_git_env_auth_probe_completed'),
    },
    scenarios: capabilityScenarios,
    limitations: capabilityLimitations,
    lineage: lineage(false),
  },
  {
    schemaVersion: 1,
    evidenceId: 'block6a-6a6-real-sdk-output-schema-001',
    task: '6A.6',
    source: 'real_sdk',
    recordedAt: '2026-07-19T08:12:39.621Z',
    commandName: 'block6a-electron-utility-output-schema-probe',
    classification: 'output_schema_probe_completed',
    versions,
    assertions: {
      probeRootOutsideSourceRepository: assertion('static_manifest', r6EvidenceId, 'local_probe_boundary_observed'),
      workspaceIsTemporaryGitRepository: assertion('static_manifest', r6EvidenceId, 'local_probe_boundary_observed'),
      apiCredentialEnvironmentExcludedFromUtility: assertion('static_manifest', r2EvidenceId, 'utility_environment_boundary_frozen'),
      promptAndSchemaNotPassedInProtocol: assertion('static_manifest', r6EvidenceId, 'typed_protocol_boundary_frozen'),
      scenarioCount: assertion('real_sdk', 'block6a-6a6-real-sdk-output-schema-001', 'output_schema_probe_completed'),
    },
    scenarios: [
      {
        scenario: 'valid-minimal',
        outcome: 'success',
        authClassification: 'authenticated',
        runtimeFailureOrigin: null,
        finalJsonParsed: true,
        strictValidatorAccepted: true,
        expectedValueMatched: true,
        invalidSchemaRejectedBySdk: false,
      },
      {
        scenario: 'invalid-schema',
        outcome: 'invalid_schema_rejected',
        authClassification: 'unverified',
        runtimeFailureOrigin: null,
        finalJsonParsed: null,
        strictValidatorAccepted: null,
        expectedValueMatched: null,
        invalidSchemaRejectedBySdk: true,
      },
    ],
    limitations: outputSchemaLimitations,
    lineage: lineage(false),
  },
];

const lifecycleSuccess = [
  'app-timeout',
  'explicit-cancel',
  'window-close',
  'app-quit',
].map((scenario) => ({
  schemaVersion: 1,
  evidenceId: `block6a-6a7-real-sdk-${scenario}-001`,
  task: '6A.7',
  source: 'real_sdk',
  recordedAt: '2026-07-19T07:36:15.640Z',
  commandName: `block6a-electron-lifecycle-${scenario}-probe`,
  classification: 'lifecycle_probe_passed',
  versions,
  assertions: {
    triggerMatchedScenario: assertion('real_sdk', `block6a-6a7-real-sdk-${scenario}-001`, 'lifecycle_probe_passed'),
    abortRequested: assertion('real_sdk', `block6a-6a7-real-sdk-${scenario}-001`, 'lifecycle_probe_passed'),
    abortObserved: assertion('real_sdk', `block6a-6a7-real-sdk-${scenario}-001`, 'lifecycle_probe_passed'),
    sdkPromiseSettled: assertion('real_sdk', `block6a-6a7-real-sdk-${scenario}-001`, 'lifecycle_probe_passed'),
    cleanupAcknowledged: assertion('real_sdk', `block6a-6a7-real-sdk-${scenario}-001`, 'lifecycle_probe_passed'),
    timeoutSupervisorObserved: assertion('real_sdk', `block6a-6a7-real-sdk-${scenario}-001`, 'lifecycle_probe_passed'),
    timeoutUtilityExitObserved: assertion('real_sdk', `block6a-6a7-real-sdk-${scenario}-001`, 'lifecycle_probe_passed'),
    timeoutCleanupClassified: assertion('real_sdk', `block6a-6a7-real-sdk-${scenario}-001`, 'lifecycle_probe_passed'),
    cleanupExecutedOnce: assertion('real_sdk', `block6a-6a7-real-sdk-${scenario}-001`, 'lifecycle_probe_passed'),
  },
  processAssertions: {
    utilityProcessAttributed: assertion('real_sdk', `block6a-6a7-real-sdk-${scenario}-001`, 'owned_process_observation_completed'),
    cliObservedBeforeTrigger: assertion('real_sdk', `block6a-6a7-real-sdk-${scenario}-001`, 'owned_process_observation_completed'),
    cliOwnedByUtilityParentChain: assertion('real_sdk', `block6a-6a7-real-sdk-${scenario}-001`, 'owned_process_observation_completed'),
    pidCreationTimeExecutablePathBound: assertion('real_sdk', `block6a-6a7-real-sdk-${scenario}-001`, 'owned_process_observation_completed'),
    observedParentRelationshipBound: assertion('real_sdk', `block6a-6a7-real-sdk-${scenario}-001`, 'owned_process_observation_completed'),
    ownershipFrozenForSession: assertion('real_sdk', `block6a-6a7-real-sdk-${scenario}-001`, 'owned_process_observation_completed'),
    residualScanCompleted: assertion('real_sdk', `block6a-6a7-real-sdk-${scenario}-001`, 'owned_process_observation_completed'),
    utilityResidualAbsent: assertion('real_sdk', `block6a-6a7-real-sdk-${scenario}-001`, 'owned_process_observation_completed'),
    cliResidualAbsent: assertion('real_sdk', `block6a-6a7-real-sdk-${scenario}-001`, 'owned_process_observation_completed'),
  },
  result: {
    scenario,
    trigger: scenario,
    outcome: 'aborted',
    authClassification: 'unverified',
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
    utilityKillOwnershipProven: false,
    utilityKillAttempted: false,
    residualScanCompleted: true,
    utilityResidualAbsent: true,
    cliResidualAbsent: true,
  } : null,
  lifecycleEvents: {
    initialTrigger: scenario,
    cleanupRequestCount: scenario === 'window-close' ? 2 : 1,
    cleanupExecutionCount: 1,
    hiddenWindowUsed: scenario === 'window-close' || scenario === 'app-quit',
    windowCloseObserved: scenario === 'window-close',
    windowAllClosedObserved: scenario === 'window-close',
    beforeQuitObserved: scenario === 'window-close' || scenario === 'app-quit',
  },
  limitations: lifecycleLimitations,
  lineage: lineage(false),
}));

describe('Block 6A recertification result admission', () => {
  it('admits only the complete packaged success contract', () => {
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
      assertions: {
        ...packagedSuccess.assertions,
        structuredTurnSucceeded: {
          ...packagedSuccess.assertions.structuredTurnSucceeded,
          value: false,
        },
      },
    }],
    ['missing assertion', {
      ...packagedSuccess,
      assertions: Object.fromEntries(
        Object.entries(packagedSuccess.assertions)
          .filter(([key]) => key !== 'approvedSyntheticInputHashMatched'),
      ),
    }],
    ['extra assertion', {
      ...packagedSuccess,
      assertions: { ...packagedSuccess.assertions, unrelatedProducerClaim: true },
    }],
    ['missing synthetic boundary', { ...packagedSuccess, syntheticBoundary: undefined }],
    ['wrong input fingerprint', {
      ...packagedSuccess,
      syntheticBoundary: { ...packagedSuccess.syntheticBoundary, inputSha256: '0'.repeat(64) },
    }],
    ['uncontrolled result path policy', {
      ...packagedSuccess,
      syntheticBoundary: { ...packagedSuccess.syntheticBoundary, resultPathPolicy: 'caller_controlled' },
    }],
    ['missing runtime', { ...packagedSuccess, runtime: undefined }],
    ['missing lineage', { ...packagedSuccess, lineage: undefined }],
    ['dirty critical inputs', {
      ...packagedSuccess,
      lineage: { ...packagedSuccess.lineage, criticalInputsCleanAtRun: false },
    }],
    ['artifact hash missing', {
      ...packagedSuccess,
      lineage: { ...packagedSuccess.lineage, packagedArtifactSha256: null },
    }],
    ['missing structured result', { ...packagedSuccess, structuredResult: undefined }],
    ['prompt field', { ...packagedSuccess, prompt: 'must-not-be-retained' }],
    ['stdout field', { ...packagedSuccess, stdout: 'must-not-be-retained' }],
    ['stderr field', { ...packagedSuccess, stderr: 'must-not-be-retained' }],
    ['arbitrary top-level field', { ...packagedSuccess, arbitraryExtra: true }],
    ['invented limitation', {
      ...packagedSuccess,
      limitations: [...packagedSuccess.limitations, 'producer supplied text'],
    }],
  ])('fails closed for packaged %s', (_label, result) => {
    expect(() => admitBlock6aProbeResults('packaged', [result])).toThrow(
      'Block 6A recertification result was not admitted.',
    );
  });

  it('rejects a missing or extra packaged result', () => {
    expect(() => admitBlock6aProbeResults('packaged', [])).toThrow();
    expect(() => admitBlock6aProbeResults('packaged', [packagedSuccess, packagedSuccess])).toThrow();
  });

  it('accepts complete unverified development evidence but blocks recertification', () => {
    expect(evaluateBlock6aProbeResults('dev', devSuccess)).toEqual({
      evidenceAccepted: true,
      recertificationAdmitted: false,
      blockers: [
        'git_auth_structured_classification_unavailable',
        'sdk_unstructured_runtime_failure',
      ],
      results: [
        {
          task: '6A.5',
          source: 'real_sdk',
          classification: 'cwd_git_env_auth_probe_completed',
        },
        {
          task: '6A.6',
          source: 'real_sdk',
          classification: 'output_schema_probe_completed',
        },
      ],
    });
    expect(() => admitBlock6aProbeResults('dev', devSuccess)).toThrow(
      'Block 6A recertification result was not admitted.',
    );
  });

  it('retains an unavailable authenticated run as evidence and adds a closed blocker', () => {
    const unavailable = structuredClone(devSuccess);
    Object.assign(unavailable[0].scenarios[4], {
      outcome: 'runtime_failed',
      authClassification: 'unverified',
      runtimeFailureOrigin: 'sdk_unstructured',
      finalResponseMatched: null,
    });
    Object.assign(unavailable[1].scenarios[0], {
      outcome: 'runtime_failed',
      authClassification: 'unverified',
      runtimeFailureOrigin: 'sdk_unstructured',
      finalJsonParsed: null,
      strictValidatorAccepted: null,
      expectedValueMatched: null,
      invalidSchemaRejectedBySdk: false,
    });

    expect(evaluateBlock6aProbeResults('dev', unavailable)).toMatchObject({
      evidenceAccepted: true,
      recertificationAdmitted: false,
      blockers: [
        'git_auth_structured_classification_unavailable',
        'authenticated_sdk_success_unavailable',
        'sdk_unstructured_runtime_failure',
      ],
    });
    expect(() => admitBlock6aProbeResults('dev', unavailable)).toThrow();
  });

  it('retains a local invalid-schema deadline as evidence with exact blockers', () => {
    const unavailable = structuredClone(devSuccess);
    Object.assign(unavailable[1].scenarios[1], {
      outcome: 'runtime_failed',
      authClassification: 'unverified',
      runtimeFailureOrigin: 'local_turn_deadline',
      finalJsonParsed: null,
      strictValidatorAccepted: null,
      expectedValueMatched: null,
      invalidSchemaRejectedBySdk: false,
    });

    expect(evaluateBlock6aProbeResults('dev', unavailable)).toMatchObject({
      evidenceAccepted: true,
      recertificationAdmitted: false,
      blockers: [
        'git_auth_structured_classification_unavailable',
        'output_schema_guard_unavailable',
        'local_sdk_turn_deadline_exceeded',
        'sdk_unstructured_runtime_failure',
      ],
    });
  });

  it('makes an accepted-but-blocked evaluation exit non-zero in the repository runner', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../../scripts/run-block6a-probes.mjs'),
      'utf8',
    );
    expect(source).toContain('evaluateBlock6aProbeResults(mode, results)');
    expect(source).toContain('if (!evaluation.recertificationAdmitted) process.exitCode = 1;');
  });

  it('requires every exact capability and outputSchema scenario', () => {

    const missingCapabilityScenario = structuredClone(devSuccess);
    missingCapabilityScenario[0].scenarios = missingCapabilityScenario[0].scenarios.slice(1);
    expect(() => evaluateBlock6aProbeResults('dev', missingCapabilityScenario)).toThrow();

    const extraCapabilityScenario = structuredClone(devSuccess);
    (extraCapabilityScenario[0].scenarios as Array<Record<string, unknown>>).push({
      ...extraCapabilityScenario[0].scenarios[0],
      scenario: 'producer-invented-scenario',
    });
    expect(() => evaluateBlock6aProbeResults('dev', extraCapabilityScenario)).toThrow();

    const missingOutputScenario = structuredClone(devSuccess);
    missingOutputScenario[1].scenarios = missingOutputScenario[1].scenarios.slice(0, 1);
    expect(() => evaluateBlock6aProbeResults('dev', missingOutputScenario)).toThrow();
  });

  it('requires the frozen development assertion keys and scenario semantics', () => {
    const missingAssertion = structuredClone(devSuccess);
    delete (missingAssertion[0].assertions as Record<string, unknown>)
      .probeRootOutsideSourceRepository;
    expect(() => evaluateBlock6aProbeResults('dev', missingAssertion)).toThrow();

    const extraAssertion = structuredClone(devSuccess);
    Object.assign(extraAssertion[1].assertions, { unrelatedProducerClaim: true });
    expect(() => evaluateBlock6aProbeResults('dev', extraAssertion)).toThrow();

    const wrongAssertionSource = structuredClone(devSuccess);
    wrongAssertionSource[0].assertions.scenarioCount.source = 'static_manifest';
    expect(() => evaluateBlock6aProbeResults('dev', wrongAssertionSource)).toThrow();

    const wrongAssertionEvidence = structuredClone(devSuccess);
    wrongAssertionEvidence[1]!.assertions.promptAndSchemaNotPassedInProtocol!.evidenceId =
      'producer-invented-evidence';
    expect(() => evaluateBlock6aProbeResults('dev', wrongAssertionEvidence)).toThrow();

    const legacyBooleanAssertion = structuredClone(devSuccess);
    (legacyBooleanAssertion[0].assertions as Record<string, unknown>).scenarioCount = true;
    expect(() => evaluateBlock6aProbeResults('dev', legacyBooleanAssertion)).toThrow();

    const changedRuntimeHash = structuredClone(devSuccess);
    changedRuntimeHash[0].lineage.runtimeBoundarySha256 = 'not-a-hash';
    expect(() => evaluateBlock6aProbeResults('dev', changedRuntimeHash)).toThrow();

    const missingFailureOrigin = structuredClone(devSuccess);
    delete (missingFailureOrigin[0].scenarios[0] as Record<string, unknown>)
      .runtimeFailureOrigin;
    expect(() => evaluateBlock6aProbeResults('dev', missingFailureOrigin)).toThrow();

    const inventedFailureOrigin = structuredClone(devSuccess);
    inventedFailureOrigin[0].scenarios[0].runtimeFailureOrigin = 'producer-invented-origin';
    expect(() => evaluateBlock6aProbeResults('dev', inventedFailureOrigin)).toThrow();

    const successWithFailureOrigin = structuredClone(devSuccess);
    successWithFailureOrigin[0].scenarios[4].runtimeFailureOrigin = 'sdk_unstructured';
    expect(() => evaluateBlock6aProbeResults('dev', successWithFailureOrigin)).toThrow();

    const blocked = structuredClone(devSuccess);
    Object.assign(blocked[0].scenarios[4], {
      outcome: 'login_required',
      authClassification: 'login_required',
      finalResponseMatched: null,
    });
    expect(() => evaluateBlock6aProbeResults('dev', blocked)).toThrow();

    const sensitiveTopLevel = structuredClone(devSuccess);
    Object.assign(sensitiveTopLevel[0], { stdout: 'must-not-be-retained' });
    expect(() => evaluateBlock6aProbeResults('dev', sensitiveTopLevel)).toThrow();
  });

  it('requires all four lifecycle scenarios with process attribution and residual checks', () => {
    expect(admitBlock6aProbeResults('lifecycle', lifecycleSuccess)).toHaveLength(4);
    expect(() => admitBlock6aProbeResults('lifecycle', lifecycleSuccess.slice(0, 3))).toThrow();

    const missingProcessAssertions = structuredClone(lifecycleSuccess);
    (missingProcessAssertions[0] as Record<string, unknown>).processAssertions = undefined;
    expect(() => admitBlock6aProbeResults('lifecycle', missingProcessAssertions)).toThrow();

    const missingFrozenIdentity = structuredClone(lifecycleSuccess);
    delete (missingFrozenIdentity[0].processAssertions as Record<string, unknown>)
      .pidCreationTimeExecutablePathBound;
    expect(() => admitBlock6aProbeResults('lifecycle', missingFrozenIdentity)).toThrow();

    const residualNotAbsent = structuredClone(lifecycleSuccess);
    residualNotAbsent[1].processAssertions.cliResidualAbsent.value = false;
    expect(() => admitBlock6aProbeResults('lifecycle', residualNotAbsent)).toThrow();

    const timeoutMissingResidualScan = structuredClone(lifecycleSuccess);
    delete (timeoutMissingResidualScan[0].timeoutCleanup as Record<string, unknown>)
      .residualScanCompleted;
    expect(() => admitBlock6aProbeResults('lifecycle', timeoutMissingResidualScan)).toThrow();

    const inventedAssertion = structuredClone(lifecycleSuccess);
    Object.assign(inventedAssertion[2].assertions, { unrelatedProducerClaim: true });
    expect(() => admitBlock6aProbeResults('lifecycle', inventedAssertion)).toThrow();

    const wrongInitialTrigger = structuredClone(lifecycleSuccess);
    wrongInitialTrigger[3].lifecycleEvents.initialTrigger = 'window-close';
    expect(() => admitBlock6aProbeResults('lifecycle', wrongInitialTrigger)).toThrow();

    const sensitiveTopLevel = structuredClone(lifecycleSuccess);
    Object.assign(sensitiveTopLevel[1], { prompt: 'must-not-be-retained' });
    expect(() => admitBlock6aProbeResults('lifecycle', sensitiveTopLevel)).toThrow();
  });
});
