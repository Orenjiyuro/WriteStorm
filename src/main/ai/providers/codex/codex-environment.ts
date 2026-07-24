export const CODEX_UTILITY_ENVIRONMENT_KEYS = [
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

export type CodexUtilityEnvironment = Readonly<Record<string, string>>;

export function createCodexUtilityEnvironment(
  inherited: NodeJS.ProcessEnv,
): CodexUtilityEnvironment {
  const canonicalByLowercase = new Map(
    CODEX_UTILITY_ENVIRONMENT_KEYS.map((key) => [key.toLowerCase(), key] as const),
  );
  const environment: Record<string, string> = {};
  for (const [key, value] of Object.entries(inherited)) {
    const canonicalKey = canonicalByLowercase.get(key.toLowerCase());
    if (!canonicalKey || value === undefined || canonicalKey in environment) continue;
    environment[canonicalKey] = value;
  }
  return Object.freeze(environment);
}

export function isCodexUtilityEnvironmentAllowlisted(
  environment: NodeJS.ProcessEnv,
): boolean {
  const admitted = new Set(
    CODEX_UTILITY_ENVIRONMENT_KEYS.map((key) => key.toLowerCase()),
  );
  const electronRuntimeKeys = new Set([
    'electron_run_as_node',
    'node_channel_fd',
    'node_channel_serialization_mode',
  ]);
  return Object.entries(environment).every(([key, value]) => (
    value === undefined
    || admitted.has(key.toLowerCase())
    || electronRuntimeKeys.has(key.toLowerCase())
  ));
}
