import { auth, db } from "@/config/firebase";
import * as LocalAuthentication from "expo-local-authentication";
import * as Notifications from "expo-notifications";
import { Stack, router, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  AppStateStatus,
  Image,
  LogBox,
  StyleSheet,
  Text,
  View,
} from "react-native";

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

const AuthContext = createContext<{
  user: User | null;
  logout: () => Promise<void>;
}>({
  user: null,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
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
  // SPLASH ANIMATION VALUES
  // ============================================================

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.65)).current;
  const logoTranslateY = useRef(new Animated.Value(25)).current;

  const glowScale = useRef(new Animated.Value(0.75)).current;
  const glowOpacity = useRef(new Animated.Value(0.25)).current;

  const ring1Scale = useRef(new Animated.Value(0.8)).current;
  const ring1Opacity = useRef(new Animated.Value(0.35)).current;

  const ring2Scale = useRef(new Animated.Value(0.65)).current;
  const ring2Opacity = useRef(new Animated.Value(0.2)).current;

  const pulse = useRef(new Animated.Value(0)).current;

  // ============================================================
  // MODERN SPLASH ANIMATION
  // ============================================================

  useEffect(() => {
    let mounted = true;

    async function prepare() {
      try {
        // Short delay before starting the animation
        await new Promise((resolve) => setTimeout(resolve, 350));
      } catch (error) {
        console.warn(error);
      } finally {
        await SplashScreen.hideAsync();

        if (!mounted) return;

        // --------------------------------------------------------
        // LOGO ENTRANCE
        // --------------------------------------------------------

        Animated.parallel([
          Animated.timing(logoOpacity, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),

          Animated.spring(logoScale, {
            toValue: 1,
            friction: 7,
            tension: 45,
            useNativeDriver: true,
          }),

          Animated.timing(logoTranslateY, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start();

        // --------------------------------------------------------
        // CENTER GLOW
        // --------------------------------------------------------

        Animated.loop(
          Animated.sequence([
            Animated.parallel([
              Animated.timing(glowScale, {
                toValue: 1.15,
                duration: 900,
                useNativeDriver: true,
              }),

              Animated.timing(glowOpacity, {
                toValue: 0.42,
                duration: 900,
                useNativeDriver: true,
              }),
            ]),

            Animated.parallel([
              Animated.timing(glowScale, {
                toValue: 0.85,
                duration:1200,
                useNativeDriver: true,
              }),

              Animated.timing(glowOpacity, {
                toValue: 0.2,
                duration: 2300,
                useNativeDriver: true,
              }),
            ]),
          ]),
        ).start();

        // --------------------------------------------------------
        // OUTER RING 1
        // --------------------------------------------------------

        Animated.loop(
          Animated.sequence([
            Animated.parallel([
              Animated.timing(ring1Scale, {
                toValue: 1.5,
                duration: 3200,
                useNativeDriver: true,
              }),

              Animated.timing(ring1Opacity, {
                toValue: 0,
                duration: 3200,
                useNativeDriver: true,
              }),
            ]),

            Animated.parallel([
              Animated.timing(ring1Scale, {
                toValue: 0.8,
                duration: 0,
                useNativeDriver: true,
              }),

              Animated.timing(ring1Opacity, {
                toValue: 0.35,
                duration: 0,
                useNativeDriver: true,
              }),
            ]),
          ]),
        ).start();

        // --------------------------------------------------------
        // OUTER RING 2
        // --------------------------------------------------------

        Animated.loop(
          Animated.sequence([
            Animated.delay(1000),

            Animated.parallel([
              Animated.timing(ring2Scale, {
                toValue: 1.55,
                duration: 700,
                useNativeDriver: true,
              }),

              Animated.timing(ring2Opacity, {
                toValue: 0,
                duration: 2300,
                useNativeDriver: true,
              }),
            ]),

            Animated.parallel([
              Animated.timing(ring2Scale, {
                toValue: 0.65,
                duration: 0,
                useNativeDriver: true,
              }),

              Animated.timing(ring2Opacity, {
                toValue: 0.2,
                duration: 0,
                useNativeDriver: true,
              }),
            ]),
          ]),
        ).start();

        // --------------------------------------------------------
        // LOADING PULSE
        // --------------------------------------------------------

        Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),

            Animated.timing(pulse, {
              toValue: 0,
              duration: 800,
              useNativeDriver: true,
            }),
          ]),
        ).start();

        // --------------------------------------------------------
        // MARK SPLASH AS FINISHED
        //
        // This MUST happen before biometric authentication
        // is allowed to start.
        // --------------------------------------------------------

        setTimeout(() => {
          if (mounted) {
            animationFinishedRef.current = true;
            setIsAnimationFinished(true);
          }
        }, 4500);
      }
    }

    prepare();

    return () => {
      mounted = false;
    };
  }, []);

  // ============================================================
  // LOGOUT
  // ============================================================

  const logout = async () => {
    try {
      await signOut(auth);
      setIsLocked(false);
      router.replace("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // ============================================================
  // BIOMETRIC FAILURE
  // ============================================================

  const handleAuthenticationFailure = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error during sign out:", error);
    } finally {
      setIsLocked(false);
      router.replace("/");
    }
  };

  // ============================================================
  // BIOMETRIC AUTHENTICATION
  // ============================================================

  const authenticateBiometrics = async () => {
    if (isAuthenticating.current) return;

    isAuthenticating.current = true;

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Unlock ExTrack",
          cancelLabel: "Cancel",
          fallbackLabel: "Use Passcode",
          disableDeviceFallback: false,
        });

        if (result.success) {
          setIsLocked(false);
        } else {
          await handleAuthenticationFailure();
        }
      } else {
        setIsLocked(false);
      }
    } catch (error) {
      console.error("Biometric authentication failed:", error);
      await handleAuthenticationFailure();
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
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists() && userSnap.data()?.isBiometricEnabled) {
        // Lock the app before opening authentication
        setIsLocked(true);

        await authenticateBiometrics();
      } else {
        setIsLocked(false);
      }
    } catch (error) {
      console.error("Error fetching biometric preference:", error);
      setIsLocked(false);
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

      await checkAndPromptBiometrics(currentUser);

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
    const inTabsGroup = currentSegment === "(tabs)";

    const isPublicAuthScreen =
      !currentSegment ||
      currentSegment === "index" ||
      currentSegment === "register" ||
      currentSegment === "forgotPass";

    if (!user && inTabsGroup) {
      router.replace("/");
    } else if (user && isPublicAuthScreen) {
      router.replace("/(tabs)/home");
    }
  }, [user, initializing, isLocked, isAnimationFinished, segments]);

  // ============================================================
  // SPLASH / LOCK SCREEN
  // ============================================================

  if (initializing || !isAnimationFinished || isLocked) {
    return (
      <View style={styles.loadingContainer}>
        {/* Ambient background glow */}
        <Animated.View
          style={[
            styles.glow,
            {
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
            },
          ]}
        />

        {/* Expanding ring */}
        <Animated.View
          style={[
            styles.ring,
            {
              opacity: ring1Opacity,
              transform: [{ scale: ring1Scale }],
            },
          ]}
        />

        {/* Second expanding ring */}
        <Animated.View
          style={[
            styles.ring,
            styles.ringSecond,
            {
              opacity: ring2Opacity,
              transform: [{ scale: ring2Scale }],
            },
          ]}
        />

        {/* Logo / Splash Content */}
        {!isAnimationFinished ? (
          <Animated.View
            style={[
              styles.logoWrapper,
              {
                opacity: logoOpacity,
                transform: [
                  { scale: logoScale },
                  { translateY: logoTranslateY },
                ],
              },
            ]}
          >
            <View style={styles.logoGlow}>
              <Image
                source={require("../../assets/images/extrack-logo.png")}
                style={styles.logo}
              />
            </View>

            <Text style={styles.appName}>ExTrack</Text>

            <Text style={styles.tagline}>Track smarter. Live better.</Text>

            {/* Animated loading dots */}
            <Animated.View
              style={[
                styles.loadingDots,
                {
                  opacity: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.45, 1],
                  }),
                },
              ]}
            >
              <View style={styles.dot} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </Animated.View>
          </Animated.View>
        ) : (
          // This is only briefly displayed before the system
          // biometric/passcode prompt appears.
          <ActivityIndicator size="small" color="#60A5FA" />
        )}

        <Text style={styles.version}>PERSONAL FINANCE</Text>
      </View>
    );
  }

  // ============================================================
  // APP
  // ============================================================

  return (
    <AuthContext.Provider value={{ user, logout }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="register" />
        <Stack.Screen name="forgotPass" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </AuthContext.Provider>
  );
}

// ================================================================
// STYLES
// ================================================================

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#03143D",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  glow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#2563EB",
  },

  ring: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1,
    borderColor: "#60A5FA",
  },

  ringSecond: {
    width: 270,
    height: 270,
    borderRadius: 135,
    borderColor: "#3B82F6",
  },

  logoWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },

  logoGlow: {
    width: 150,
    height: 150,
    borderRadius: 75,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(37, 99, 235, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(96, 165, 250, 0.15)",
  },

  logo: {
    width: 115,
    height: 115,
    resizeMode: "contain",
  },

  appName: {
    marginTop: 20,
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  tagline: {
    marginTop: 7,
    color: "#93C5FD",
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.8,
  },

  loadingDots: {
    flexDirection: "row",
    gap: 6,
    marginTop: 24,
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#60A5FA",
  },

  version: {
    position: "absolute",
    bottom: 35,
    color: "rgba(147, 197, 253, 0.45)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 2.5,
  },
});
