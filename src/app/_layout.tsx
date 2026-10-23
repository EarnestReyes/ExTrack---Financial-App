import { registerWorkerAppCheck } from "../services/ai/supportService";
import { auth, db } from "@/services/firebase/client";
import * as LocalAuthentication from "expo-local-authentication";
import * as Notifications from "expo-notifications";
import { Stack, router, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
AppState,
AppStateStatus,
LogBox,
} from "react-native";
import { BrandSplash } from "../components/ui/brand-splash";
import { AuthContext } from "../contexts/AuthContext";

// Keep native splash screen visible while loading resources
SplashScreen.preventAutoHideAsync();

LogBox.ignoreLogs([
  "expo-notifications: Android Push notifications",
  "`expo-notifications` functionality is not fully supported in Expo Go",
]);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
});

export default function RootLayout() {
  useEffect(() => {
    if (!__DEV__ || process.env.EXPO_PUBLIC_ANDROID_APP_CHECK_DIAGNOSTICS_ENABLED !== 'true') return;
    // Opt-in device diagnostics work with every AI activation flag disabled.
    void import('../services/firebase/workerAppCheck').then(async ({ initializeWorkerAppCheck }) => {
      const instance = await initializeWorkerAppCheck();
      registerWorkerAppCheck(instance);
      console.info('Device App Check acquired. Worker verification is still required.');
    }).catch(() => {
      console.info('Device App Check unavailable. AI remains disabled.');
    });
  }, []);
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    if (!__DEV__ || !user || process.env.EXPO_PUBLIC_WORKER_TOKEN_VERIFICATION_ENABLED !== 'true') return;
    let active = true;
    void import('../services/firebase/verifyWorkerTokens').then(({ verifyWorkerTokens }) => verifyWorkerTokens())
      .then((ok) => { if (active) console.info(ok ? 'Worker token verification passed.' : 'Worker token verification failed. AI remains disabled.'); })
      .catch(() => { if (active) console.info('Worker token verification failed. AI remains disabled.'); });
    return () => { active = false; };
  }, [user?.uid]);
  const [initializing, setInitializing] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [isAnimationFinished, setIsAnimationFinished] = useState(false);

  const segments = useSegments();
  const appState = useRef(AppState.currentState);
  const isAuthenticating = useRef(false);

  // IMPORTANT:
  // This ref lets the Firebase auth listener know whether
  // the splash animation has already finished.
  const animationFinishedRef = useRef(false);

  const notificationListener = useRef<Notifications.EventSubscription | null>(
    null,
  );

  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  // ============================================================
  // LOGOUT
  // ============================================================

  const logout = async () => {
    try {
      await signOut(auth);
      setIsLocked(false);
      router.replace("/");
    } catch (error) {
      throw new Error("Unable to sign out. Please try again.");
    }
  };

  // ============================================================
  // BIOMETRIC FAILURE
  // ============================================================

  const handleAuthenticationFailure = async () => {
    setIsLocked(true);
    try {
      await signOut(auth);
      if (!auth.currentUser) {
        setIsLocked(false);
        router.replace("/");
      }
    } catch {
      // A failed sign-out must never unlock the still-authenticated account.
      setIsLocked(true);
    }
  };

  // ============================================================
  // BIOMETRIC AUTHENTICATION
  // ============================================================

  const authenticateBiometrics = async (expectedUid: string) => {
    if (isAuthenticating.current) return;

    isAuthenticating.current = true;

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (auth.currentUser?.uid !== expectedUid) return;
      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Unlock ExTrack",
          cancelLabel: "Cancel",
          fallbackLabel: "Use Passcode",
          disableDeviceFallback: false,
        });

        if (auth.currentUser?.uid !== expectedUid) return;
        if (result.success) {
          setIsLocked(false);
        } else {
          await handleAuthenticationFailure();
        }
      } else {
        await handleAuthenticationFailure();
      }
    } catch (error) {

      if (auth.currentUser?.uid === expectedUid) await handleAuthenticationFailure();
    } finally {
      isAuthenticating.current = false;
    }
  };

  // ============================================================
  // CHECK BIOMETRIC PREFERENCE
  // ============================================================

  const checkAndPromptBiometrics = async (currentUser: User) => {
    try {
      const userDocRef = doc(db, "users", currentUser.uid);
      setIsLocked(true);
      const userSnap = await getDoc(userDocRef);
      if (auth.currentUser?.uid !== currentUser.uid) return;

      if (userSnap.exists() && userSnap.data()?.isBiometricEnabled) {
        // Lock the app before opening authentication
        setIsLocked(true);

        await authenticateBiometrics(currentUser.uid);
      } else {
        setIsLocked(false);
      }
    } catch (error) {

      if (auth.currentUser?.uid === currentUser.uid) await handleAuthenticationFailure();
    }
  };

  // ============================================================
  // WAIT FOR SPLASH ANIMATION
  // ============================================================

  const waitForSplashAnimation = () => {
    return new Promise<void>((resolve) => {
      // Animation already finished
      if (animationFinishedRef.current) {
        resolve();
        return;
      }

      // Wait until the animation marks itself as finished
      const interval = setInterval(() => {
        if (animationFinishedRef.current) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  };

  // ============================================================
  // AUTH LISTENER
  //
  // IMPORTANT:
  // Firebase may restore the user's session immediately when
  // the app launches. We DO NOT authenticate immediately.
  //
  // We first wait for:
  //
  // Native Splash
  //       ↓
  // Custom animation
  //       ↓
  // Animation finished
  //       ↓
  // Biometric / password prompt
  //
  // ============================================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) setInitializing(true);

      // --------------------------------------------------------
      // No logged-in user
      // --------------------------------------------------------

      if (!currentUser) {
        setIsLocked(false);
        setInitializing(false);
        return;
      }

      // --------------------------------------------------------
      // USER IS LOGGED IN
      //
      // DO NOT SHOW PASSWORD / BIOMETRIC YET.
      //
      // First wait for the splash animation.
      // --------------------------------------------------------

      await waitForSplashAnimation();

      // Tiny transition delay so the animation does not
      // abruptly switch into the system authentication prompt.
      await new Promise((resolve) => setTimeout(resolve, 150));

      // --------------------------------------------------------
      // ONLY NOW CHECK BIOMETRIC AUTHENTICATION
      // --------------------------------------------------------

      if (auth.currentUser?.uid !== currentUser.uid) return;
      await checkAndPromptBiometrics(currentUser);
      if (auth.currentUser?.uid !== currentUser.uid) return;
      setInitializing(false);
    });

    return unsubscribe;
  }, []);

  // ============================================================
  // APP STATE / RE-AUTH
  // ============================================================

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === "active" &&
          user
        ) {
          await checkAndPromptBiometrics(user);
        }

        appState.current = nextAppState;
      },
    );

    return () => subscription.remove();
  }, [user]);

  // ============================================================
  // NOTIFICATION CLEANUP
  // ============================================================

  useEffect(() => {
    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  // ============================================================
  // NAVIGATION GUARD
  // ============================================================

  useEffect(() => {
    if (initializing || isLocked || !isAnimationFinished) return;

    const currentSegment = segments[0] as string | undefined;


    const isPublicAuthScreen =
      !currentSegment ||
      currentSegment === "index" ||
      currentSegment === "register" ||
      currentSegment === "forgotPass";

    if (!user && !isPublicAuthScreen) {
      router.replace("/");
    } else if (user && isPublicAuthScreen) {
      router.replace("/(tabs)/home");
    }
  }, [user, initializing, isLocked, isAnimationFinished, segments]);

  // ============================================================
  // SPLASH / LOCK SCREEN
  // ============================================================

  if (initializing || !isAnimationFinished || isLocked) {
    return <BrandSplash locked={isLocked || (isAnimationFinished && initializing)} onComplete={() => {
      animationFinishedRef.current = true;
      setIsAnimationFinished(true);
    }} />;
  }

  // ============================================================
  // APP
  // ============================================================

  return (
    <AuthContext.Provider value={{ user, logout }}>
      <Stack key={user?.uid || "signed-out"} screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="index" />
          <Stack.Screen name="register" />
          <Stack.Screen name="forgotPass" />
        </Stack.Protected>
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="statements" />
          <Stack.Screen name="help" />
          <Stack.Screen name="ChatSupport" />
        </Stack.Protected>
      </Stack>
    </AuthContext.Provider>
  );
}

