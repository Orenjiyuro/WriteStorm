const windowsRuntimeAuthProxyKeys = [
  'ALL_PROXY',
  'APPDATA',
  'CODEX_HOME',
  'COMSPEC',
  'HOME',
  'HOMEDRIVE',
  'HOMEPATH',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'LOCALAPPDATA',
  'NODE_EXTRA_CA_CERTS',
  'NO_PROXY',
  'PATH',
  'PATHEXT',
  'SSL_CERT_DIR',
  'SSL_CERT_FILE',
  'SYSTEMDRIVE',
  'SYSTEMROOT',
  'TEMP',
  'TMP',
  'USERDOMAIN',
  'USERNAME',
  'USERPROFILE',
  'WINDIR',
] as const;

export const CODEX_CLI_BASE_ENVIRONMENT_KEYS = windowsRuntimeAuthProxyKeys;

export const CODEX_UTILITY_ENVIRONMENT_KEYS = [
  ...windowsRuntimeAuthProxyKeys,
  'WRITESTORM_CODEX_SYNTHETIC_EXPECTED',
  'WRITESTORM_CODEX_SYNTHETIC_INPUT',
] as const;

export const CODEX_SDK_0_144_6_ENVIRONMENT_OVERLAY = {
  alwaysInjectedKeys: ['CODEX_INTERNAL_ORIGINATOR_OVERRIDE'],
  apiKeyOptionConditionalKeys: ['CODEX_API_KEY'],
  automaticResolutionMutatedKeys: ['PATH'],
} as const;

export function createCodexUtilityEnvironment(
  inherited: NodeJS.ProcessEnv,
): Record<string, string> {
  return selectEnvironment(inherited, CODEX_UTILITY_ENVIRONMENT_KEYS);
}

export function buildCodexCliEnvironment(
  inherited: NodeJS.ProcessEnv,
  options: {
    readonly authMode: 'current' | 'isolated-empty';
    readonly isolatedCodexHome?: string;
  },
): Record<string, string> {
  const environment = selectEnvironment(inherited, CODEX_CLI_BASE_ENVIRONMENT_KEYS);
  if (options.authMode === 'isolated-empty') {
    if (!options.isolatedCodexHome) {
      throw new Error('An isolated CODEX_HOME is required for the isolated auth probe.');
    }
    environment.CODEX_HOME = options.isolatedCodexHome;
  }
  return environment;
}

function selectEnvironment(
  inherited: NodeJS.ProcessEnv,
  admittedKeys: readonly string[],
): Record<string, string> {
  const canonicalByLowercase = new Map(
    admittedKeys.map((key) => [key.toLowerCase(), key] as const),
  );
  const environment: Record<string, string> = {};
  for (const [key, value] of Object.entries(inherited)) {
    const canonicalKey = canonicalByLowercase.get(key.toLowerCase());
    if (!canonicalKey || value === undefined || canonicalKey in environment) continue;
    environment[canonicalKey] = value;
  }
  return environment;
}
