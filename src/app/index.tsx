import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

import { router, useFocusEffect } from 'expo-router';
import { useState, useMemo, useCallback } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { getThemePreference } from '../database';

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

  const handleRegister = () => {
    router.push('/register');
  };

  const handleForgotPassword = () => {
    router.push('/forgotPass');
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {/* LOGO SECTION */}
          <View style={styles.logoSection}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>E</Text>
            </View>
            <Text style={styles.title}>ExTrack</Text>
            <Text style={styles.subtitle}>Personal Finance Tracker</Text>
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
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
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
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
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

// STYLES (Identical theme palette to explore.tsx)
const createStyles = (isDarkMode: boolean) => {
  const backgroundColor = isDarkMode ? '#0f172a' : '#f8fafc';
  const cardColor = isDarkMode ? '#1e293b' : '#ffffff';
  const textColor = isDarkMode ? '#f8fafc' : '#0f172a';
  const secondaryTextColor = isDarkMode ? '#94a3b8' : '#64748b';
  const borderColor = isDarkMode ? '#334155' : '#cbd5e1';
  const inputBgColor = isDarkMode ? '#0f172a' : '#f8fafc';

  return StyleSheet.create({
    keyboardContainer: { flex: 1, backgroundColor },
    scrollContent: { flexGrow: 1 },
    container: {
      flex: 1,
      backgroundColor,
      paddingHorizontal: 25,
      paddingTop: 60,
      paddingBottom: 50,
      justifyContent: 'center',
    },
    logoSection: { alignItems: 'center', marginBottom: 35 },
    logoCircle: {
      width: 75,
      height: 75,
      borderRadius: 38,
      backgroundColor: '#1e3a8a',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 15,
    },
    logoText: { color: 'white', fontSize: 40, fontWeight: 'bold' },
    title: { fontSize: 32, fontWeight: 'bold', color: textColor },
    subtitle: { fontSize: 16, color: secondaryTextColor, marginTop: 4, textAlign: 'center' },
    loginCard: { 
      backgroundColor: cardColor, 
      borderRadius: 18, 
      padding: 22,
      borderWidth: 1,
      borderColor,
    },
    loginTitle: { fontSize: 24, fontWeight: 'bold', color: textColor, marginBottom: 5 },
    loginSubtitle: { fontSize: 14, color: secondaryTextColor, marginBottom: 20 },
    inputLabel: { fontSize: 15, fontWeight: '600', color: textColor, marginBottom: 8, marginTop: 15 },
    input: {
      backgroundColor: inputBgColor,
      borderRadius: 12,
      borderWidth: 1,
      borderColor,
      paddingHorizontal: 16,
      paddingVertical: 16,
      fontSize: 16,
      color: textColor,
    },
    forgotButton: { alignSelf: 'flex-end', marginTop: 12 },
    forgotText: { fontSize: 14, fontWeight: '600', color: '#3b82f6' },
    loginButton: {
      backgroundColor: '#1e3a8a',
      padding: 18,
      borderRadius: 15,
      alignItems: 'center',
      marginTop: 25,
    },
    loginButtonDisabled: { opacity: 0.6 },
    loginButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
    registerContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 22 },
    registerText: { fontSize: 14, color: secondaryTextColor, marginRight: 5 },
    registerLink: { fontSize: 14, fontWeight: 'bold', color: '#3b82f6' },
  });
};