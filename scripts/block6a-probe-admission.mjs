const deniedMessage = 'Block 6A recertification result was not admitted.';

const approvedSyntheticInputSha256 =
  '59a9268039bb5bad326151cbe27320c64c89cbf5b054035978c432a4ce5c4a26';
const approvedSyntheticExpectedSha256 =
  '6fe7aac1e4d9ae4aec0a14e6bfd46af4ee18892c247a2d0aecfa5091f017afab';

const commonEvidenceKeys = [
  'schemaVersion',
  'evidenceId',
  'task',
  'source',
  'recordedAt',
  'commandName',
  'classification',
  'versions',
  'assertions',
  'limitations',
  'lineage',
];
const developmentEvidenceKeys = [...commonEvidenceKeys, 'scenarios'];
const lifecycleEvidenceKeys = [
  ...commonEvidenceKeys,
  'processAssertions',
  'result',
  'timeoutCleanup',
  'lifecycleEvents',
];
const packagedEvidenceKeys = [
  ...commonEvidenceKeys,
  'syntheticBoundary',
  'runtime',
  'structuredResult',
];
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

const lifecycleAssertionKeys = [
  'triggerMatchedScenario',
  'abortRequested',
  'abortObserved',
  'sdkPromiseSettled',
  'cleanupAcknowledged',
  'timeoutSupervisorObserved',
  'timeoutUtilityExitObserved',
  'timeoutCleanupClassified',
  'cleanupExecutedOnce',
];
const lifecycleProcessAssertionKeys = [
  'utilityProcessAttributed',
  'cliObservedBeforeTrigger',
  'cliOwnedByUtilityParentChain',
  'pidCreationTimeExecutablePathBound',
  'observedParentRelationshipBound',
  'ownershipFrozenForSession',
  'residualScanCompleted',
  'utilityResidualAbsent',
  'cliResidualAbsent',
];
const packagedAssertionKeys = [
  'packagedProbeGateAccepted',
  'appIsPackaged',
  'windowsX64Runtime',
  'approvedSyntheticInputHashMatched',
  'approvedSyntheticExpectedHashMatched',
  'resultPathDerivedFromValidatedRunIdUnderOsTemp',
  'packagedSdkImportConstructAndCliExecutionProvedByTurn',
  'structuredTurnSucceeded',
  'structuredAuthAuthenticated',
  'structuredFinalJsonParsed',
  'structuredValidatorAccepted',
  'structuredExpectedValueMatched',
  'structuredCleanupAcknowledged',
  'workspaceOutsidePackagedResources',
  'apiCredentialEnvironmentExcludedFromUtility',
  'promptAndSchemaNotPassedInProtocol',
];
const r2EnvironmentEvidenceId = 'block6a-remediation-r2-environment-boundary-001';
const r6ProvenanceEvidenceId = 'block6a-remediation-r6-assertion-provenance-001';
const requiredLineageEvidenceIds = [
  'block6a-remediation-r2-environment-boundary-001',
  'block6a-remediation-r4a-process-ownership-001',
  'block6a-remediation-r4b-safe-termination-001',
  'block6a-remediation-r5-error-classification-001',
  'block6a-remediation-r6-assertion-provenance-001',
  'block6a-remediation-r7-evidence-lineage-001',
];
const staticAssertion = (evidenceId, classification) => ({
  source: 'static_manifest', evidenceId, classification,
});
const runtimeAssertion = (source, evidenceId, classification) => ({
  source, evidenceId, classification,
});
const capabilityAssertionProvenance = {
  probeRootOutsideSourceRepository: staticAssertion(r6ProvenanceEvidenceId, 'local_probe_boundary_observed'),
  workspacesOutsideLibraryRoot: staticAssertion(r6ProvenanceEvidenceId, 'local_probe_boundary_observed'),
  workspacesOutsidePackagedResources: staticAssertion(r6ProvenanceEvidenceId, 'local_probe_boundary_observed'),
  apiCredentialEnvironmentExcludedFromUtility: staticAssertion(r2EnvironmentEvidenceId, 'utility_environment_boundary_frozen'),
  syntheticInputNotPassedInProtocol: staticAssertion(r6ProvenanceEvidenceId, 'typed_protocol_boundary_frozen'),
  scenarioCount: runtimeAssertion('real_sdk', 'block6a-6a5-real-sdk-cwd-git-env-auth-001', 'cwd_git_env_auth_probe_completed'),
};
const outputSchemaAssertionProvenance = {
  probeRootOutsideSourceRepository: staticAssertion(r6ProvenanceEvidenceId, 'local_probe_boundary_observed'),
  workspaceIsTemporaryGitRepository: staticAssertion(r6ProvenanceEvidenceId, 'local_probe_boundary_observed'),
  apiCredentialEnvironmentExcludedFromUtility: staticAssertion(r2EnvironmentEvidenceId, 'utility_environment_boundary_frozen'),
  promptAndSchemaNotPassedInProtocol: staticAssertion(r6ProvenanceEvidenceId, 'typed_protocol_boundary_frozen'),
  scenarioCount: runtimeAssertion('real_sdk', 'block6a-6a6-real-sdk-output-schema-001', 'output_schema_probe_completed'),
};

export function admitBlock6aProbeResults(mode, results) {
  const evaluation = evaluateBlock6aProbeResults(mode, results);
  if (!evaluation.recertificationAdmitted) deny();
  return evaluation.results;
}

export function evaluateBlock6aProbeResults(mode, results) {
  if (!Array.isArray(results)) deny();

  let blockers = [];
  if (mode === 'dev') blockers = validateDevelopmentResults(results);
  else if (mode === 'lifecycle') admitLifecycleResults(results);
  else if (mode === 'packaged') admitPackagedResults(results);
  else deny();

  return {
    evidenceAccepted: true,
    recertificationAdmitted: blockers.length === 0,
    blockers,
    results: results.map((result) => ({
      task: result.task,
      source: result.source,
      classification: result.classification,
    })),
  };
}

function validateDevelopmentResults(results) {
  if (results.length !== 2) deny();
  const capability = exactResult(
    results,
    '6A.5',
    'real_sdk',
    'cwd_git_env_auth_probe_completed',
  );
  requireEvidenceEnvelope(capability, {
    evidenceId: 'block6a-6a5-real-sdk-cwd-git-env-auth-001',
    commandName: 'block6a-electron-utility-cwd-git-env-auth-probe',
    versionKeys: ['electron', 'nodeRuntime', 'codexSdk'],
    topLevelKeys: developmentEvidenceKeys,
    limitations: capabilityLimitations,
    packagedArtifactRequired: false,
  });
  requireExactAssertionProvenance(capability.assertions, capabilityAssertionProvenance);
  requireExactScenarioSet(capability.scenarios, [
    'default-git-isolated-auth',
    'explicit-git-isolated-auth',
    'explicit-non-git-isolated-auth',
    'skip-non-git-isolated-auth',
    'current-auth-explicit-git',
  ]);

  requireUnverifiedCapabilityScenario(
    exactScenario(capability.scenarios, 'default-git-isolated-auth'),
    false,
    false,
  );
  requireUnverifiedCapabilityScenario(
    exactScenario(capability.scenarios, 'explicit-git-isolated-auth'),
    true,
    false,
  );
  requireExactScenario(
    exactScenario(capability.scenarios, 'explicit-non-git-isolated-auth'),
    {
      scenario: 'explicit-non-git-isolated-auth',
      utilityCwdMatchedExpected: true,
      explicitWorkingDirectoryRequested: true,
      skipGitRepoCheck: false,
      envPolicy: 'explicit_allowlist_no_api_credentials',
      outcome: 'runtime_failed',
      authClassification: 'unverified',
      finalResponseMatched: null,
    },
  );
  requireUnverifiedCapabilityScenario(
    exactScenario(capability.scenarios, 'skip-non-git-isolated-auth'),
    true,
    true,
  );
  const currentAuth = exactScenario(capability.scenarios, 'current-auth-explicit-git');
  const authenticatedCapabilitySucceeded = currentAuth.outcome === 'success'
    && currentAuth.authClassification === 'authenticated';
  if (authenticatedCapabilitySucceeded) {
    requireExactScenario(currentAuth, {
      scenario: 'current-auth-explicit-git',
      utilityCwdMatchedExpected: true,
      explicitWorkingDirectoryRequested: true,
      skipGitRepoCheck: false,
      envPolicy: 'explicit_allowlist_no_api_credentials',
      outcome: 'success',
      authClassification: 'authenticated',
      finalResponseMatched: true,
    });
  } else {
    requireUnverifiedCapabilityScenario(currentAuth, true, false);
  }

  const outputSchema = exactResult(
    results,
    '6A.6',
    'real_sdk',
    'output_schema_probe_completed',
  );
  requireEvidenceEnvelope(outputSchema, {
    evidenceId: 'block6a-6a6-real-sdk-output-schema-001',
    commandName: 'block6a-electron-utility-output-schema-probe',
    versionKeys: ['electron', 'nodeRuntime', 'codexSdk'],
    topLevelKeys: developmentEvidenceKeys,
    limitations: outputSchemaLimitations,
    packagedArtifactRequired: false,
  });
  requireExactAssertionProvenance(outputSchema.assertions, outputSchemaAssertionProvenance);
  requireExactScenarioSet(outputSchema.scenarios, ['valid-minimal', 'invalid-schema']);
  const validOutputSchema = exactScenario(outputSchema.scenarios, 'valid-minimal');
  const authenticatedOutputSchemaSucceeded = validOutputSchema.outcome === 'success'
    && validOutputSchema.authClassification === 'authenticated';
  if (authenticatedOutputSchemaSucceeded) {
    requireExactScenario(validOutputSchema, {
      scenario: 'valid-minimal',
      outcome: 'success',
      authClassification: 'authenticated',
      finalJsonParsed: true,
      strictValidatorAccepted: true,
      expectedValueMatched: true,
      invalidSchemaRejectedBySdk: false,
    });
  } else {
    requireExactScenario(validOutputSchema, {
      scenario: 'valid-minimal',
      outcome: 'runtime_failed',
      authClassification: 'unverified',
      finalJsonParsed: null,
      strictValidatorAccepted: null,
      expectedValueMatched: null,
      invalidSchemaRejectedBySdk: false,
    });
  }
  requireExactScenario(exactScenario(outputSchema.scenarios, 'invalid-schema'), {
    scenario: 'invalid-schema',
    outcome: 'invalid_schema_rejected',
    authClassification: 'unverified',
    finalJsonParsed: null,
    strictValidatorAccepted: null,
    expectedValueMatched: null,
    invalidSchemaRejectedBySdk: true,
  });
  return [
    'git_auth_structured_classification_unavailable',
    ...(!authenticatedCapabilitySucceeded || !authenticatedOutputSchemaSucceeded
      ? ['authenticated_sdk_success_unavailable']
      : []),
  ];
}

function admitLifecycleResults(results) {
  const scenarios = ['app-timeout', 'explicit-cancel', 'window-close', 'app-quit'];
  if (results.length !== scenarios.length) deny();
  requireExactScenarioSet(results.map((entry) => ({ scenario: entry?.result?.scenario })), scenarios);

  for (const scenario of scenarios) {
    const result = results.find((entry) => entry?.result?.scenario === scenario);
    requireExactIdentity(result, '6A.7', 'real_sdk', 'lifecycle_probe_passed');
    requireEvidenceEnvelope(result, {
      evidenceId: `block6a-6a7-real-sdk-${scenario}-001`,
      commandName: `block6a-electron-lifecycle-${scenario}-probe`,
      versionKeys: ['electron', 'nodeRuntime', 'codexSdk'],
      topLevelKeys: lifecycleEvidenceKeys,
      limitations: lifecycleLimitations,
      packagedArtifactRequired: false,
    });
    requireExactAssertionProvenance(
      result.assertions,
      Object.fromEntries(lifecycleAssertionKeys.map((key) => [
        key,
        runtimeAssertion('real_sdk', result.evidenceId, 'lifecycle_probe_passed'),
      ])),
    );
    requireExactAssertionProvenance(
      result.processAssertions,
      Object.fromEntries(lifecycleProcessAssertionKeys.map((key) => [
        key,
        runtimeAssertion('real_sdk', result.evidenceId, 'owned_process_observation_completed'),
      ])),
    );
    requireExactScenario(result.result, {
      scenario,
      trigger: scenario,
      outcome: 'aborted',
      authClassification: 'unverified',
      abortRequested: true,
      abortObserved: true,
      sdkPromiseSettled: true,
    });
    requireLifecycleEvents(result.lifecycleEvents, scenario);

    if (scenario === 'app-timeout') requireTimeoutCleanup(result.timeoutCleanup);
    else if (result.timeoutCleanup !== null) deny();
  }
}

function admitPackagedResults(results) {
  if (results.length !== 1) deny();
  const result = results[0];
  requireExactIdentity(
    result,
    '6A.8a',
    'packaged_sdk',
    'packaged_sdk_probe_completed',
  );
  requireEvidenceEnvelope(result, {
    evidenceId: 'block6a-6a8a-packaged-sdk-windows-001',
    commandName: 'writestorm-packaged-codex-sdk-probe',
    versionKeys: ['electron', 'nodeRuntime', 'codexSdk', 'codexCli', 'platformPackage'],
    topLevelKeys: packagedEvidenceKeys,
    limitations: packagedLimitations,
    packagedArtifactRequired: true,
  });
  const packagedAssertionProvenance = Object.fromEntries(packagedAssertionKeys.map((key) => [
    key,
    key === 'apiCredentialEnvironmentExcludedFromUtility'
      ? staticAssertion(r2EnvironmentEvidenceId, 'utility_environment_boundary_frozen')
      : key === 'promptAndSchemaNotPassedInProtocol'
        ? staticAssertion(r6ProvenanceEvidenceId, 'typed_protocol_boundary_frozen')
        : runtimeAssertion(
            'packaged_sdk',
            'block6a-6a8a-packaged-sdk-windows-001',
            'packaged_sdk_probe_completed',
          ),
  ]));
  requireExactAssertionProvenance(result.assertions, packagedAssertionProvenance);
  requireExactScenario(result.syntheticBoundary, {
    inputSha256: approvedSyntheticInputSha256,
    expectedSha256: approvedSyntheticExpectedSha256,
    resultPathPolicy: 'os_temp_validated_uuid_v4',
  });
  requireExactScenario(result.runtime, { platform: 'win32', architecture: 'x64' });
  requireExactScenario(result.structuredResult, {
    scenario: 'valid-minimal',
    outcome: 'success',
    authClassification: 'authenticated',
    finalJsonParsed: true,
    strictValidatorAccepted: true,
    expectedValueMatched: true,
    invalidSchemaRejectedBySdk: false,
  });
  if (result.versions.codexCli !== '0.144.6'
    || result.versions.platformPackage !== '0.144.6-win32-x64') deny();
}

function requireEvidenceEnvelope(result, expected) {
  if (!isRecord(result)) deny();
  requireExactKeys(result, expected.topLevelKeys);
  if (result.schemaVersion !== 1
    || result.evidenceId !== expected.evidenceId
    || result.commandName !== expected.commandName
    || !isIsoTimestamp(result.recordedAt)
    || !isRecord(result.versions)) deny();
  requireExactKeys(result.versions, expected.versionKeys);
  requireExactStringArray(result.limitations, expected.limitations);
  requireEvidenceLineage(result.lineage, expected.packagedArtifactRequired);
  if (Object.values(result.versions).some((value) => typeof value !== 'string' || value.length === 0)
    || result.versions.codexSdk !== '0.144.6') deny();
}

function requireEvidenceLineage(lineage, packagedArtifactRequired) {
  if (!isRecord(lineage)) deny();
  requireExactKeys(lineage, [
    'gitHeadAtRun',
    'criticalInputsCleanAtRun',
    'packageLockSha256',
    'runtimeBoundarySha256',
    'packagedArtifactSha256',
    'evidenceInputs',
  ]);
  if (!/^[0-9a-f]{40}$/.test(lineage.gitHeadAtRun)
    || lineage.criticalInputsCleanAtRun !== true
    || !isSha256(lineage.packageLockSha256)
    || !isSha256(lineage.runtimeBoundarySha256)
    || (packagedArtifactRequired
      ? !isSha256(lineage.packagedArtifactSha256)
      : lineage.packagedArtifactSha256 !== null)
    || !Array.isArray(lineage.evidenceInputs)
    || lineage.evidenceInputs.length !== requiredLineageEvidenceIds.length) deny();
  lineage.evidenceInputs.forEach((entry, index) => {
    if (!isRecord(entry)) deny();
    requireExactKeys(entry, ['evidenceId', 'sha256']);
    if (entry.evidenceId !== requiredLineageEvidenceIds[index] || !isSha256(entry.sha256)) deny();
  });
}

function isSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

function requireExactStringArray(actual, expected) {
  if (!Array.isArray(actual)
    || actual.length !== expected.length
    || actual.some((value, index) => value !== expected[index])) deny();
}

function requireUnverifiedCapabilityScenario(
  scenario,
  explicitWorkingDirectoryRequested,
  skipGitRepoCheck,
) {
  requireExactScenario(scenario, {
    scenario: scenario.scenario,
    utilityCwdMatchedExpected: true,
    explicitWorkingDirectoryRequested,
    skipGitRepoCheck,
    envPolicy: 'explicit_allowlist_no_api_credentials',
    outcome: 'runtime_failed',
    authClassification: 'unverified',
    finalResponseMatched: null,
  });
}

function requireLifecycleEvents(events, scenario) {
  if (!isRecord(events)) deny();
  requireExactKeys(events, [
    'initialTrigger',
    'cleanupRequestCount',
    'cleanupExecutionCount',
    'hiddenWindowUsed',
    'windowCloseObserved',
    'windowAllClosedObserved',
    'beforeQuitObserved',
  ]);
  const windowClose = scenario === 'window-close';
  const appQuit = scenario === 'app-quit';
  if (events.initialTrigger !== scenario
    || !Number.isInteger(events.cleanupRequestCount)
    || events.cleanupRequestCount < 1
    || events.cleanupExecutionCount !== 1
    || events.hiddenWindowUsed !== (windowClose || appQuit)
    || events.windowCloseObserved !== windowClose
    || events.windowAllClosedObserved !== windowClose
    || events.beforeQuitObserved !== (windowClose || appQuit)) deny();
}

function requireTimeoutCleanup(cleanup) {
  if (!isRecord(cleanup)) deny();
  requireExactKeys(cleanup, [
    'classification',
    'abortRequested',
    'abortObserved',
    'sdkPromiseSettled',
    'cleanupAcknowledged',
    'utilityExitObserved',
    'utilityKillOwnershipProven',
    'utilityKillAttempted',
    'residualScanCompleted',
    'utilityResidualAbsent',
    'cliResidualAbsent',
  ]);
  const killStateAccepted = cleanup.classification === 'graceful'
    ? cleanup.utilityKillOwnershipProven === false && cleanup.utilityKillAttempted === false
    : cleanup.classification === 'forced'
      && cleanup.utilityKillOwnershipProven === true
      && cleanup.utilityKillAttempted === true;
  if (!killStateAccepted
    || cleanup.abortRequested !== true
    || cleanup.abortObserved !== true
    || cleanup.sdkPromiseSettled !== true
    || cleanup.cleanupAcknowledged !== true
    || cleanup.utilityExitObserved !== true
    || cleanup.residualScanCompleted !== true
    || cleanup.utilityResidualAbsent !== true
    || cleanup.cliResidualAbsent !== true) deny();
}

function exactResult(results, task, source, classification) {
  const matches = results.filter((result) => isRecord(result)
    && result.task === task
    && result.source === source
    && result.classification === classification);
  if (matches.length !== 1) deny();
  return matches[0];
}

function requireExactIdentity(result, task, source, classification) {
  if (!isRecord(result)
    || result.task !== task
    || result.source !== source
    || result.classification !== classification) deny();
}

function requireExactAssertionProvenance(assertions, expectedByKey) {
  if (!isRecord(assertions)) deny();
  const expectedKeys = Object.keys(expectedByKey);
  requireExactKeys(assertions, expectedKeys);
  for (const key of expectedKeys) {
    const assertion = assertions[key];
    const expected = expectedByKey[key];
    if (!isRecord(assertion)) deny();
    requireExactKeys(assertion, ['value', 'source', 'evidenceId', 'classification']);
    if (assertion.value !== true
      || assertion.source !== expected.source
      || assertion.evidenceId !== expected.evidenceId
      || assertion.classification !== expected.classification) deny();
  }
}

function requireExactScenarioSet(scenarios, expectedNames) {
  if (!Array.isArray(scenarios) || scenarios.length !== expectedNames.length) deny();
  const actualNames = scenarios.map((scenario) => isRecord(scenario) ? scenario.scenario : undefined);
  if (actualNames.some((name) => typeof name !== 'string')
    || new Set(actualNames).size !== expectedNames.length
    || expectedNames.some((name) => !actualNames.includes(name))) deny();
}

function exactScenario(scenarios, name) {
  if (!Array.isArray(scenarios)) deny();
  const matches = scenarios.filter((scenario) => isRecord(scenario) && scenario.scenario === name);
  if (matches.length !== 1) deny();
  return matches[0];
}

function requireExactScenario(actual, expected) {
  if (!isRecord(actual)) deny();
  requireExactKeys(actual, Object.keys(expected));
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) deny();
  }
}

function requireExactKeys(record, expectedKeys) {
  const actualKeys = Object.keys(record).sort();
  const sortedExpected = [...expectedKeys].sort();
  if (actualKeys.length !== sortedExpected.length
    || actualKeys.some((key, index) => key !== sortedExpected[index])) deny();
}

function isIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deny() {
  throw new Error(deniedMessage);
}
