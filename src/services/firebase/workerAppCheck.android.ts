import { CustomProvider, initializeAppCheck, type AppCheck } from 'firebase/app-check';
import { app } from './client';
import { androidAttestationProvider, nativeTokenForJS } from './appCheckPolicy';

let initialization: Promise<AppCheck> | undefined;

export function initializeWorkerAppCheck(): Promise<AppCheck> {
  if (initialization) return initialization;
  initialization = initialize().catch(() => {
    initialization = undefined;
    // No tokens, native diagnostic details, or debug secrets enter app logs/errors.
    throw new Error('Device attestation unavailable. Offline features remain available.');
  });
  return initialization;
}

async function initialize(): Promise<AppCheck> {
  const providerName = androidAttestationProvider(
    __DEV__, process.env.EXPO_PUBLIC_ANDROID_APP_CHECK_DEBUG_ENABLED === 'true',
  );
  // Lazy loading keeps Expo Go/missing native modules from interrupting authentication.
  const nativeAppSDK: typeof import('@react-native-firebase/app') = require('@react-native-firebase/app');
  const nativeSDK: typeof import('@react-native-firebase/app-check') = require('@react-native-firebase/app-check');
  const nativeApp = nativeAppSDK.getApp();
  if (!app.options.projectId || !app.options.messagingSenderId ||
      nativeApp.options.projectId !== app.options.projectId ||
      nativeApp.options.messagingSenderId !== app.options.messagingSenderId ||
      !nativeApp.options.appId?.startsWith(`1:${app.options.messagingSenderId}:android:`)) {
    throw new Error('Native Firebase project mismatch.');
  }
  const provider = new nativeSDK.ReactNativeFirebaseAppCheckProvider();
  // Omitting debugToken lets the native SDK generate a device-local debug secret.
  // Register it privately in Firebase Console; never place it in Expo public env.
  provider.configure({ android: { provider: providerName } });
  const nativeCheck = nativeSDK.initializeAppCheck(nativeApp, {
    provider, isTokenAutoRefreshEnabled: false,
  });
  const acquire = async () => nativeTokenForJS((await nativeSDK.getToken(nativeCheck, true)).token);
  // Verify native acquisition before installing the JS provider. Failure can be retried.
  let initialToken: ReturnType<typeof nativeTokenForJS> | undefined = await acquire();
  return initializeAppCheck(app, {
    provider: new CustomProvider({ getToken: async () => {
      const first = initialToken;
      initialToken = undefined;
      return first && first.expireTimeMillis > Date.now() + 30000 ? first : acquire();
    } }),
    // One refresh owner: JS refresh obtains a fresh native token through CustomProvider.
    isTokenAutoRefreshEnabled: true,
  });
}
