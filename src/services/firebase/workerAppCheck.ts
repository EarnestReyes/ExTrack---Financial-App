import type { AppCheck } from 'firebase/app-check';

/** Android resolves workerAppCheck.android.ts; iOS remains deliberately unconfigured. */
export async function initializeWorkerAppCheck(): Promise<AppCheck> {
  throw new Error('Native App Check is not configured on this platform.');
}
