# Android App Check device verification

AI remains disabled. No deployment, billing activation, authentication migration,
or financial data changes are part of this integration. iOS attestation is deferred.

## Dependencies and connectivity

Installed matching `@react-native-firebase/app@27.0.0` and
`@react-native-firebase/app-check@27.0.0`. Their published peers accept Expo >=47;
Expo SDK 57 uses React Native 0.86 and its New Architecture. JavaScript checks do
not establish native build compatibility; the Android build/device checks below
remain required. Packages include generated native code; npm lifecycle scripts
were intentionally skipped during installation.

The npm failure came from HTTP_PROXY/HTTPS_PROXY/ALL_PROXY pointing to
127.0.0.1:9, plus npm offline mode. Direct HTTPS to registry.npmjs.org succeeded.
Installation used process-local proxy removal, offline=false and a writable cache
at node_modules/.cache/npm. Permanent npm/environment settings were not changed;
strict SSL remained enabled. Do not disable SSL or use a mirror to work around this.

## Firebase Console preparation (manual)

1. Use the existing project `extrack-f16fe` and Android app `com.extrack.app`.
   Its google-services.json already matches that package/project.
2. In Project settings, register the SHA-256 fingerprint of each build signing
   certificate used for testing. Production Play builds use the Play App Signing
   certificate, which can differ from the upload/development certificate.
3. In App Check, register that Android app with Play Integrity. In Play Console,
   link the Play Integrity API to this same Google Cloud project. Check integrity,
   app recognition and licensing requirements for your chosen distribution path;
   do not relax production checks just to make a sideloaded build pass.
4. For debug testing only, register the device-generated debug secret in this
   app's App Check debug-token list. Treat it as a secret: do not paste it into
   source, Expo public variables, screenshots, support messages or shared logs.
   Revoke it after testing. Debug tokens are accepted by Firebase as trusted
   tokens, so they must not be distributed in production.
5. Do not change Auth/Firestore enforcement settings for this test. The Worker
   separately verifies both tokens and its app allowlist. No Blaze is required
   for this client integration. Existing Play developer account/distribution
   requirements must be satisfied separately; no account purchase is authorized.

## Physical Android device: debug attestation

1. Install Android Studio/SDK and a compatible JDK; enable USB debugging on a
   Google Play services device. Confirm it appears in `adb devices`.
2. Temporarily set these **non-secret development flags** in your local .env:

   ```dotenv
   EXPO_PUBLIC_ANDROID_APP_CHECK_DEBUG_ENABLED=true
   EXPO_PUBLIC_ANDROID_APP_CHECK_DIAGNOSTICS_ENABLED=true
   ```

   Leave FREE_AI_RELEASE_ENABLED, SUPPORT_CHAT_ENABLED, AI_INSIGHTS_ENABLED and
   WORKER_AI_VERIFIED unset/false (their full names begin EXPO_PUBLIC_). Server
   AI_ENABLED and AI_FREE_TIER_VERIFIED also stay false.
3. Run `npx expo run:android --device` to build/install a fresh native development
   client, then `npx expo start --dev-client --clear` if Metro is not already running.
   Expo Go cannot provide these native modules. Do not use prebuild --clean.
4. Inspect local `adb logcat -s DebugAppCheckProvider` privately for the generated
   debug secret and register it as described above. Restart the application.
5. The app's opt-in diagnostic prints only acquisition success/failure, never
   tokens. Success means native acquisition and JS instance registration worked;
   it does **not** mean the Worker verified that token. Sign in normally and
   confirm offline transactions/insights still work. No Gemini request is made.
6. Remove the two diagnostic/debug flags and revoke the debug secret when finished.

## Production Play Integrity and Worker acceptance

Use an already authorized Play internal testing track for a correctly signed
build installed through Play. Never assume a USB-installed APK passes the
production recognition/licensing policy. The production build must have the
debug flag absent/false; setting it true in a release fails closed.

Before any AI rollout, verify a real signed-in user's Firebase ID token and the
native App Check token against the Worker verifier, including missing, expired,
wrong-project and wrong-app rejection. Do not copy credentials to shell command
arguments or logs. Current deployed AI endpoints return 503 while activation is
disabled **before** token verification, so a 503 is not evidence of attestation.
A separately reviewed non-Gemini staging verification harness/endpoint is needed
for that acceptance step; this change does not deploy or add one. Never enable
AI just to test tokens. Keep all activation flags disabled until this step and
real-device refresh/offline/error/account-switch tests pass.

## Bridge behavior

Android initialization is lazy and shared across simultaneous requests. It checks
that the native and existing JS apps belong to the same project/sender, without
replacing JS Auth or Firestore. Native tokens supply real JWT expiry to the JS
CustomProvider; JS owns automatic refresh and forces fresh native acquisition.
The JS AppCheck instance is registered through registerWorkerAppCheck. Failed
initialization can be retried; missing/expired attestation never bypasses Worker
checks or falls back to a different AI transport. No debug secret is bundled.

References: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/),
[RNFirebase App Check](https://rnfirebase.io/app-check/usage),
[Play Integrity setup](https://firebase.google.com/docs/app-check/android/play-integrity-provider),
[Android debug provider](https://firebase.google.com/docs/app-check/android/debug-provider).
