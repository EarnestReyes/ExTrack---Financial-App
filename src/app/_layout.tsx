import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { LogBox, View, ActivityIndicator } from 'react-native';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import * as Notifications from 'expo-notifications';
import { auth } from '@/config/firebase';

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
  const segments = useSegments();

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (initializing) setInitializing(false);
    });
    return unsubscribe;
  }, []);

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
    if (initializing) return;

    // Cast segment to string | undefined to prevent TS2367 type error
    const currentSegment = segments[0] as string | undefined;
    const inTabsGroup = currentSegment === '(tabs)';

    // Expo Router returns undefined or empty route string for root index.tsx
    const isPublicAuthScreen =
      !currentSegment ||
      currentSegment === 'index' ||
      currentSegment === 'register' ||
      currentSegment === 'forgotPass';

    if (!user && inTabsGroup) {
      // Unauthenticated user in protected area -> redirect to login
      router.replace('/');
    } else if (user && isPublicAuthScreen) {
      // Authenticated user on auth pages -> redirect to home/explore tab
      router.replace('/(tabs)/home'); 
    }
  }, [user, initializing, segments]);

  const logout = async () => {
    try {
      await signOut(auth);
      router.replace('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
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