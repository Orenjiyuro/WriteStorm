const deniedMessage = 'Block 6A recertification result was not admitted.';

export function admitBlock6aProbeResults(mode, results) {
  if (!Array.isArray(results)) deny();

  if (mode === 'dev') admitDevelopmentResults(results);
  else if (mode === 'lifecycle') admitLifecycleResults(results);
  else if (mode === 'packaged') admitPackagedResults(results);
  else deny();

  return results.map((result) => ({
    task: result.task,
    source: result.source,
    classification: result.classification,
  }));
}

function admitDevelopmentResults(results) {
  if (results.length !== 2) deny();
  const capability = exactResult(
    results,
    '6A.5',
    'real_sdk',
    'cwd_git_env_auth_probe_completed',
  );
  const outputSchema = exactResult(
    results,
    '6A.6',
    'real_sdk',
    'output_schema_probe_completed',
  );
  requireAllAssertions(capability);
  requireAllAssertions(outputSchema);

  const currentAuth = exactScenario(capability.scenarios, 'current-auth-explicit-git');
  if (currentAuth.outcome !== 'success'
    || currentAuth.authClassification !== 'authenticated'
    || currentAuth.finalResponseMatched !== true) deny();

  const valid = exactScenario(outputSchema.scenarios, 'valid-minimal');
  if (valid.outcome !== 'success'
    || valid.authClassification !== 'authenticated'
    || valid.finalJsonParsed !== true
    || valid.strictValidatorAccepted !== true
    || valid.expectedValueMatched !== true) deny();
  const invalid = exactScenario(outputSchema.scenarios, 'invalid-schema');
  if (invalid.outcome !== 'invalid_schema_rejected'
    || invalid.invalidSchemaRejectedBySdk !== true) deny();
}

function admitLifecycleResults(results) {
  const expectedScenarios = new Set([
    'app-timeout',
    'explicit-cancel',
    'window-close',
    'app-quit',
  ]);
  if (results.length !== expectedScenarios.size) deny();

  for (const result of results) {
    requireExactIdentity(result, '6A.7', 'real_sdk', 'lifecycle_probe_passed');
    requireAllAssertions(result);
    if (!isRecord(result.result)
      || !expectedScenarios.delete(result.result.scenario)
      || result.result.outcome !== 'aborted'
      || result.result.abortRequested !== true
      || result.result.abortObserved !== true
      || result.result.sdkPromiseSettled !== true) deny();
    if (result.result.scenario === 'app-timeout') {
      const cleanup = result.timeoutCleanup;
      if (!isRecord(cleanup)
        || cleanup.classification !== 'graceful'
        || cleanup.abortRequested !== true
        || cleanup.abortObserved !== true
        || cleanup.sdkPromiseSettled !== true
        || cleanup.cleanupAcknowledged !== true
        || cleanup.utilityExitObserved !== true) deny();
    }
  }
  if (expectedScenarios.size !== 0) deny();
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
  requireAllAssertions(result);
  for (const assertion of [
    'packagedProbeGateAccepted',
    'appIsPackaged',
    'windowsX64Runtime',
    'packagedSdkImportConstructAndCliExecutionProvedByTurn',
    'structuredTurnSucceeded',
    'structuredAuthAuthenticated',
    'structuredValidatorAccepted',
    'structuredCleanupAcknowledged',
  ]) {
    if (result.assertions[assertion] !== true) deny();
  }
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

function requireAllAssertions(result) {
  if (!isRecord(result.assertions)) deny();
  const values = Object.values(result.assertions);
  if (values.length === 0 || values.some((value) => value !== true)) deny();
}

function exactScenario(scenarios, name) {
  if (!Array.isArray(scenarios)) deny();
  const matches = scenarios.filter((scenario) => isRecord(scenario) && scenario.scenario === name);
  if (matches.length !== 1) deny();
  return matches[0];
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deny() {
  throw new Error(deniedMessage);
}
