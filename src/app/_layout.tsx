import React, { useState, createContext, useContext } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import AppTabs from '@/components/app-tabs';
import IndexScreen from './index'; // Import your index/login component directly

// Create a small Auth context to share the logout function
const AuthContext = createContext({ logout: () => {} });
export const useAuth = () => useContext(AuthContext);

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  const logout = () => {
    setIsLoggedIn(false);
  };

  return (
    <AuthContext.Provider value={{ logout }}>
      {isLoggedIn ? (
        // Renders your tabs when logged in
        <AppTabs />
      ) : (
        // Renders index/login directly when logged out
        <IndexScreen />
      )}
    </AuthContext.Provider>
  );
}