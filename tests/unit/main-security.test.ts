import { describe, expect, it } from 'vitest';
import {
  createContentSecurityPolicy,
  isAllowedExternalUrl,
  isTrustedSenderUrl,
  shouldAllowNavigation,
  shouldUseHeaderContentSecurityPolicy,
} from '../../src/main/security';

describe('main process security policy', () => {
  it('creates a restrictive content security policy', () => {
    const policy = createContentSecurityPolicy();

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).not.toContain('unsafe-inline');
    expect(policy).not.toContain('unsafe-eval');
  });

  it('uses CSP headers only for dev server pages', () => {
    expect(shouldUseHeaderContentSecurityPolicy()).toBe(false);
    expect(shouldUseHeaderContentSecurityPolicy('http://localhost:5173')).toBe(true);
  });

  it('only allows explicitly allowlisted HTTPS external URLs', () => {
    const allowedOrigins = new Set(['https://docs.writestorm.local']);

    expect(isAllowedExternalUrl('https://docs.writestorm.local/guide', allowedOrigins)).toBe(true);
    expect(isAllowedExternalUrl('http://docs.writestorm.local/guide', allowedOrigins)).toBe(false);
    expect(isAllowedExternalUrl('https://example.com/guide', allowedOrigins)).toBe(false);
    expect(isAllowedExternalUrl('not a url', allowedOrigins)).toBe(false);
  });

  it('blocks cross-origin navigation while allowing same-origin app navigation', () => {
    expect(shouldAllowNavigation('file:///app/index.html', '')).toBe(true);
    expect(shouldAllowNavigation('file:///app/index.html', 'about:blank')).toBe(true);
    expect(shouldAllowNavigation('writestorm://app/index.html', '')).toBe(true);
    expect(shouldAllowNavigation('http://localhost:5173', '')).toBe(true);
    expect(shouldAllowNavigation('http://localhost:5173', 'about:blank')).toBe(true);
    expect(shouldAllowNavigation('file:///app/index.html', 'file:///app/index.html')).toBe(true);
    expect(shouldAllowNavigation('writestorm://app/settings', 'writestorm://app/index.html')).toBe(true);
    expect(shouldAllowNavigation('writestorm://other/index.html', 'writestorm://app/index.html')).toBe(false);
    expect(shouldAllowNavigation('http://localhost:5173/settings', 'http://localhost:5173')).toBe(true);
    expect(shouldAllowNavigation('https://example.com', 'http://localhost:5173')).toBe(false);
  });

  it('trusts only the app protocol host and configured dev-server sender URLs', () => {
    expect(isTrustedSenderUrl('file:///app/index.html')).toBe(false);
    expect(isTrustedSenderUrl('writestorm://app/index.html')).toBe(true);
    expect(isTrustedSenderUrl('writestorm://other/index.html')).toBe(false);
    expect(isTrustedSenderUrl('http://localhost:5173', new Set(['http://localhost:5173']))).toBe(true);
    expect(isTrustedSenderUrl('https://example.com', new Set(['http://localhost:5173']))).toBe(false);
  });
});
