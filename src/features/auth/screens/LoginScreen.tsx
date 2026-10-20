import { BrandMark } from "../../../components/ui/brand-mark";
import {
ActivityIndicator,
Alert,
KeyboardAvoidingView,
Platform,
ScrollView,
Text,
TextInput,
TouchableOpacity,
useColorScheme,
View
} from 'react-native';
import { createStyles } from "../styles/LoginScreen.styles";

import { authenticateUser } from "@/services/biometrics/biometricService";

import { auth } from '@/services/firebase/client';
import { router, useFocusEffect } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useCallback, useMemo, useState } from 'react';
import { getThemePreference } from '../../../database';

export default function LoginScreen() {
  const systemColorScheme = useColorScheme();

  // Initialize state directly from stored preference to prevent layout flickers
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = getThemePreference();
    if (savedTheme !== null) {
      return savedTheme === 'dark';
    }
    return systemColorScheme === 'dark';
  });

  // Re-sync when navigating back to screen
  useFocusEffect(
    useCallback(() => {
      const savedTheme = getThemePreference();
      if (savedTheme !== null) {
        setIsDarkMode(savedTheme === 'dark');
      } else {
        setIsDarkMode(systemColorScheme === 'dark');
      }
    }, [systemColorScheme])
  );

  // Memoize stylesheet matching explore.tsx color values
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      alert('Please fill in both email and password.');
      return;
    }

    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, cleanEmail, password);
      router.replace('/(tabs)/home');


    } catch (error: any) {
      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          alert('Invalid email or password.');

          break;
        case 'auth/invalid-email':
          alert('Please enter a valid email address.');

          break;
        default:
          alert(`Login failed: ${error.message}`);


          break;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    // Check if user is currently logged in via Firebase session or credentials
    if (auth.currentUser) {
      setLoading(true);
      const success = await authenticateUser("Log in to ExTrack using Biometrics");
      setLoading(false);

      if (success) {
        router.replace('/(tabs)/home');
      } else {
        Alert.alert("Authentication Failed", "Biometric verification failed or was canceled.");
      }
    } else {
      // If no active session, run biometric verification first then require standard login fallback
      setLoading(true);
      const success = await authenticateUser("Verify identity for ExTrack");
      setLoading(false);

      if (success && email.trim() && password) {
        handleLogin();
      } else if (success) {
        Alert.alert("Biometrics Verified", "Please enter your email and password to complete authentication.");

      }
    }
  };

  const handleRegister = () => {
    router.push('/register');


  };

  const handleForgotPassword = () => {
    router.push('/forgotPass');


  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {/* LOGO SECTION */}
          <View style={styles.logoSection}>
            <BrandMark />
            <Text style={styles.title}>ExTrack</Text>
            <Text style={styles.subtitle}>A clearer view of your money.</Text>
          </View>

          {/* LOGIN CARD */}
          <View style={styles.loginCard}>
            <Text style={styles.loginTitle}>Welcome Back</Text>
            <Text style={styles.loginSubtitle}>Log in to continue to ExTrack</Text>

            {/* EMAIL INPUT */}
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              accessibilityLabel="Email address"
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor={isDarkMode ? "#A5B3C8" : "#52647C"}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            {/* PASSWORD INPUT */}
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              accessibilityLabel="Password"
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={isDarkMode ? "#A5B3C8" : "#52647C"}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
            />

            {/* FORGOT PASSWORD */}
            <TouchableOpacity
              style={styles.forgotButton}
              onPress={handleForgotPassword}
              disabled={loading}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* LOGIN BUTTON */}
            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.loginButtonText}>LOG IN</Text>
              )}
            </TouchableOpacity>

            {/* REGISTER LINK */}
            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Don't have an account?</Text>
              <TouchableOpacity onPress={handleRegister} disabled={loading}>
                <Text style={styles.registerLink}>Register</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}