/** Debug attestation is an explicit development-only choice, never a production fallback. */
export function androidAttestationProvider(development: boolean, debugEnabled: boolean) {
  if (debugEnabled && !development) throw new Error('Debug attestation is forbidden in release builds.');
  return development && debugEnabled ? 'debug' as const : 'playIntegrity' as const;
}

/** Expiry is cache metadata only. The Worker independently verifies the signed JWT. */
export function nativeTokenForJS(token: string, now = Date.now()) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) throw new Error();
    const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')));
    const expireTimeMillis = claims.exp * 1000;
    if (typeof claims.exp !== 'number' || !Number.isFinite(expireTimeMillis) || expireTimeMillis <= now + 30000) throw new Error();
    return { token, expireTimeMillis };
  } catch {
    throw new Error('Device attestation token is unavailable or expired.');
  }
}
