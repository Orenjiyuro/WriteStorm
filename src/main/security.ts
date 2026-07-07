export type SecurityPolicyOptions = {
  devServerUrl?: string;
};

export function createContentSecurityPolicy(options: SecurityPolicyOptions = {}): string {
  const connectSources = ["'self'"];

  if (options.devServerUrl) {
    const devOrigin = safeOrigin(options.devServerUrl);
    if (devOrigin) {
      connectSources.push(devOrigin);
    }
  }

  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${connectSources.join(' ')}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

export function shouldUseHeaderContentSecurityPolicy(devServerUrl?: string): boolean {
  return Boolean(devServerUrl);
}

export function isAllowedExternalUrl(
  targetUrl: string,
  allowedOrigins: ReadonlySet<string> = new Set(),
): boolean {
  const parsed = safeUrl(targetUrl);

  return parsed?.protocol === 'https:' && allowedOrigins.has(parsed.origin);
}

export function shouldAllowNavigation(targetUrl: string, currentUrl: string): boolean {
  const target = safeUrl(targetUrl);
  const current = safeUrl(currentUrl);

  if (!target) {
    return false;
  }

  if (!current) {
    return isInitialAppLoad(target);
  }

  if (current.href === 'about:blank') {
    return isInitialAppLoad(target);
  }

  if (target.protocol === 'file:' || current.protocol === 'file:') {
    return target.href === current.href;
  }

  if (isAppProtocol(target.protocol) || isAppProtocol(current.protocol)) {
    return isSameAppOrigin(target, current);
  }

  return target.origin === current.origin;
}

function isInitialAppLoad(target: URL): boolean {
  return (
    isAppProtocol(target.protocol) ||
    (target.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(target.hostname))
  );
}

export function isTrustedSenderUrl(
  senderUrl: string,
  trustedDevServerOrigins: ReadonlySet<string> = new Set(),
): boolean {
  const parsed = safeUrl(senderUrl);

  if (!parsed) {
    return false;
  }

  return isTrustedAppSender(parsed) || trustedDevServerOrigins.has(parsed.origin);
}

function isAppProtocol(protocol: string): boolean {
  return protocol === 'file:' || protocol === 'writestorm:';
}

function isTrustedAppSender(parsed: URL): boolean {
  return parsed.protocol === 'writestorm:' && parsed.host === 'app';
}

function isSameAppOrigin(target: URL, current: URL): boolean {
  return target.protocol === current.protocol && target.host === current.host;
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function safeOrigin(value: string): string | null {
  return safeUrl(value)?.origin ?? null;
}
