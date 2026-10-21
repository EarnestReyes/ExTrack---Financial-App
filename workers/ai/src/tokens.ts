import { ApiError, readJSON } from './types';
import type { Env } from './types';

export const AUTH_KEYS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
export const APP_CHECK_KEYS = 'https://firebaseappcheck.googleapis.com/v1/jwks';
type PublicJWK = JsonWebKey & { kid: string; alg?: string };
type KeySet = { keys: PublicJWK[]; until: number; fetched: number };
// Only public signing keys are cached. Security/quota state is never stored here.
const keyCache = new Map<string, KeySet>();
const inflight = new Map<string, Promise<KeySet>>();

function denied(): never { throw new ApiError(401, 'unauthenticated', 'Valid Firebase authentication and App Check tokens are required.'); }
function bytes(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return denied();
  try { return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), char => char.charCodeAt(0)); }
  catch { return denied(); }
}
function object(value: string): Record<string, unknown> {
  try {
    const decoded = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes(value)));
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return denied();
    return decoded;
  } catch { return denied(); }
}
async function keySet(url: string): Promise<KeySet> {
  const pending = inflight.get(url);
  if (pending) return pending;
  const loading = (async () => {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Signing keys unavailable');
    const data = await readJSON(response, 65536) as { keys?: PublicJWK[] };
    if (!Array.isArray(data.keys) || !data.keys.length || data.keys.length > 32) throw new Error('Invalid signing keys');
    const maxAge = Number(response.headers.get('Cache-Control')?.match(/max-age=(\d+)/)?.[1] ?? 300);
    const now = Date.now();
    const entry = { keys: data.keys, fetched: now, until: now + Math.min(Math.max(maxAge, 0), 21600) * 1000 };
    keyCache.set(url, entry);
    return entry;
  })();
  inflight.set(url, loading);
  try { return await loading; } finally { inflight.delete(url); }
}
async function verify(token: string, url: string) {
  if (!token || token.length > 12000) return denied();
  const parts = token.split('.');
  if (parts.length !== 3) return denied();
  const header = object(parts[0]);
  if (header.alg !== 'RS256' || header.typ !== 'JWT' || typeof header.kid !== 'string' || !header.kid || header.kid.length > 128 ||
      ['jku', 'x5u', 'jwk', 'crit', 'b64'].some(key => key in header)) return denied();
  let cached = keyCache.get(url);
  if (!cached || cached.until <= Date.now()) cached = await keySet(url);
  let key = cached.keys.find(item => item.kid === header.kid);
  // Refresh for rotated kids, but do not allow arbitrary kids to flood Google.
  if (!key && Date.now() - cached.fetched >= 60000) {
    cached = await keySet(url); key = cached.keys.find(item => item.kid === header.kid);
  }
  if (!key || key.kty !== 'RSA' || (key.alg && key.alg !== 'RS256') || (key.use && key.use !== 'sig') || !key.n || bytes(key.n).length < 256 || !key.e) return denied();
  const publicKey = await crypto.subtle.importKey('jwk', key, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, bytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!valid) return denied();
  const claims = object(parts[1]);
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || !Number.isSafeInteger(claims.exp) || claims.exp <= now ||
      typeof claims.iat !== 'number' || !Number.isSafeInteger(claims.iat) || claims.iat > now || claims.iat <= 0 || claims.exp <= claims.iat ||
      (claims.nbf !== undefined && (typeof claims.nbf !== 'number' || claims.nbf > now)) || typeof claims.sub !== 'string' || !claims.sub) return denied();
  return claims;
}

export async function verifyFirebaseTokens(request: Request, env: Env) {
  const authorization = request.headers.get('Authorization');
  const appCheck = request.headers.get('X-Firebase-AppCheck');
  if (!authorization?.startsWith('Bearer ') || !appCheck) return denied();
  try {
    const auth = await verify(authorization.slice(7), AUTH_KEYS);
    if (auth.iss !== 'https://securetoken.google.com/' + env.FIREBASE_PROJECT_ID || auth.aud !== env.FIREBASE_PROJECT_ID ||
        String(auth.sub).length > 128 || typeof auth.auth_time !== 'number' || !Number.isSafeInteger(auth.auth_time) || auth.auth_time < 0 || auth.auth_time > Number(auth.iat) ||
        Number(auth.exp) - Number(auth.iat) > 3660 || auth.firebase && (auth.firebase as { tenant?: unknown }).tenant !== undefined) return denied();
    const app = await verify(appCheck, APP_CHECK_KEYS);
    const allowed = env.FIREBASE_APP_IDS.split(',').map(id => id.trim()).filter(Boolean);
    if (app.iss !== 'https://firebaseappcheck.googleapis.com/' + env.FIREBASE_PROJECT_NUMBER ||
        !Array.isArray(app.aud) || !app.aud.includes('projects/' + env.FIREBASE_PROJECT_NUMBER) || !allowed.includes(String(app.sub)) ||
        Number(app.exp) - Number(app.iat) > 7 * 86400) return denied();
    return String(auth.sub);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw error;
    throw new ApiError(503, 'unavailable', 'Token verification unavailable. AI remains off for this request.');
  }
}
