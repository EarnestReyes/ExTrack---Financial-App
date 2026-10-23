import { getToken } from 'firebase/app-check';
import { auth } from './client';
import { initializeWorkerAppCheck } from './workerAppCheck';

/** Opt-in development diagnostic. Tokens stay in memory and are never logged. */
export async function verifyWorkerTokens(): Promise<boolean> {
  if (!__DEV__ || process.env.EXPO_PUBLIC_WORKER_TOKEN_VERIFICATION_ENABLED !== 'true') return false;
  const base = process.env.EXPO_PUBLIC_AI_WORKER_URL ?? '';
  if (!/^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev\/?$/.test(base)) return false;
  const user = auth.currentUser;
  if (!user) return false;
  try {
    const idToken = await user.getIdToken(true);
    const instance = await initializeWorkerAppCheck();
    const attestation = await getToken(instance, true);
    if (!attestation.token || auth.currentUser?.uid !== user.uid) return false;
    const response = await fetch(base.replace(/\/$/, '') + '/verifyTokens', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: 'Bearer ' + idToken, 'X-Firebase-AppCheck': attestation.token },
    });
    if (response.status !== 200 || auth.currentUser?.uid !== user.uid) return false;
    const result = await response.json();
    return result?.ok === true;
  } catch {
    return false;
  }
}
