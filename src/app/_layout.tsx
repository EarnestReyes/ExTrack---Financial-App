import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { LogBox, View, ActivityIndicator, AppState, AppStateStatus, StyleSheet } from 'react-native';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import * as Notifications from 'expo-notifications';
import * as LocalAuthentication from 'expo-local-authentication';
import { auth, db } from '@/config/firebase';

LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  '`expo-notifications` functionality is not fully supported in Expo Go',
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

const AuthContext = createContext<{ user: User | null; logout: () => Promise<void> }>({
  user: null,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [isLocked, setIsLocked] = useState(false);

  const segments = useSegments();
  const appState = useRef(AppState.currentState);
  const isAuthenticating = useRef(false);

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  // Helper to trigger biometric prompt
  const authenticateBiometrics = async () => {
    if (isAuthenticating.current) return;
    isAuthenticating.current = true;

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock ExTrack',
          cancelLabel: 'Cancel',
          fallbackLabel: 'Use Passcode',
          disableDeviceFallback: false,
        });

        if (result.success) {
          setIsLocked(false);
        } else {
          setIsLocked(true);
        }
      } else {
        setIsLocked(false);
      }
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      setIsLocked(true);
    } finally {
      isAuthenticating.current = false;
    }
  };

  // Helper to check Firestore preference before locking
  const checkAndPromptBiometrics = async (currentUser: User) => {
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists() && userSnap.data()?.isBiometricEnabled) {
        setIsLocked(true);
        await authenticateBiometrics();
      } else {
        setIsLocked(false);
      }
    } catch (error) {
      console.error('Error fetching biometric preference:', error);
      setIsLocked(false);
    }
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await checkAndPromptBiometrics(currentUser);
      } else {
        setIsLocked(false);
      }
      if (initializing) setInitializing(false);
    });
    return unsubscribe;
  }, []);

  // AppState Listener (Background/Foreground Re-Auth)
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      async (nextAppState: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === 'active' &&
          user
        ) {
          await checkAndPromptBiometrics(user);
        }
        appState.current = nextAppState;
      }
    );

    return () => subscription.remove();
  }, [user]);

  // Clean up notifications listeners
  useEffect(() => {
    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [user]);

  // Clean Navigation Guard Check
  useEffect(() => {
    if (initializing || isLocked) return;

    const currentSegment = segments[0] as string | undefined;
    const inTabsGroup = currentSegment === '(tabs)';

    const isPublicAuthScreen =
      !currentSegment ||
      currentSegment === 'index' ||
      currentSegment === 'register' ||
      currentSegment === 'forgotPass';

    if (!user && inTabsGroup) {
      router.replace('/');
    } else if (user && isPublicAuthScreen) {
      router.replace('/(tabs)/home');
    }
  }, [user, initializing, isLocked, segments]);

  const logout = async () => {
    try {
      await signOut(auth);
      setIsLocked(false);
      router.replace('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (initializing || isLocked) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
});