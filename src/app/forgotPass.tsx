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
  Alert,
} from 'react-native';

import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase'; 

export default function ForgotPasswordScreen() {
  // ==============================
  // THEME
  // ==============================

  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const styles = createStyles(isDarkMode);

  // ==============================
  // STATES
  // ==============================

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Helper function to validate basic email syntax
  const isValidEmail = (emailStr: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailStr.trim());
  };

  // ==============================
  // FIREBASE INIT CHECK
  // ==============================

  useEffect(() => {
    console.log('--- FORGOT PASSWORD SCREEN MOUNTED ---');
    console.log('[DEBUG] Auth instance present:', !!auth);
    console.log('[DEBUG] Configured App Name:', auth?.app?.name || 'UNKNOWN');
    console.log('[DEBUG] Configured API Key loaded:', !!auth?.app?.options?.apiKey);
    console.log('[DEBUG] Project ID:', auth?.app?.options?.projectId || 'MISSING');
  }, []);

  // ==============================
  // HANDLERS
  // ==============================

  const handleSendResetEmail = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    console.log('\n--- PASSWORD RESET REQUEST INITIATED ---');
    console.log('[DEBUG] Target Email:', trimmedEmail);

    if (!trimmedEmail) {
      console.warn('[WARN] Validation failed: Empty email input.');
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      console.warn('[WARN] Validation failed: Invalid email format.');
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);
      console.log('[DEBUG] Sending request to Firebase Auth...');

      await sendPasswordResetEmail(auth, trimmedEmail);

      console.log('[SUCCESS] Reset email request completed successfully!');
      setEmailSent(true);
      Alert.alert(
        'Email Sent',
        `A password reset link has been sent to ${trimmedEmail}. Please check your inbox or spam folder.`
      );
    } catch (error: any) {
      console.error('--- FIREBASE RESET ERROR DETECTED ---');
      console.error('[ERROR CODE]:', error.code);
      console.error('[ERROR MESSAGE]:', error.message);
      console.error('[FULL ERROR OBJECT]:', JSON.stringify(error, null, 2));

      let errorMessage = 'Failed to send password reset email.';

      // Map Firebase Error Codes to user-friendly messages
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email address in Firebase.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'The email address format is invalid.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many attempts. Please try again later.';
          break;
        case 'auth/invalid-api-key':
        case 'auth/api-key-not-valid':
          errorMessage = 'Invalid Firebase API Key. Verify your .env configuration.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your internet connection.';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'Email/Password authentication is disabled in Firebase Console.';
          break;
        case 'auth/unauthorized-domain':
          errorMessage = 'This domain is not authorized in your Firebase console settings.';
          break;
        default:
          errorMessage = error.message || errorMessage;
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
      console.log('--- PASSWORD RESET PROCESS COMPLETED ---\n');
    }
  };

  // ==============================
  // SCREEN
  // ==============================

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
          {/* ==========================
              LOGO / APP NAME
          ========================== */}

          <View style={styles.logoSection}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>E</Text>
            </View>

            <Text style={styles.title}>ExTrack</Text>

            <Text style={styles.subtitle}>Personal Finance Tracker</Text>
          </View>

          {/* ==========================
              FORGOT PASSWORD CARD
          ========================== */}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Reset Password</Text>

            <Text style={styles.cardSubtitle}>
              {emailSent
                ? `We sent a reset link to ${email}. Check your inbox and follow the instructions to update your password.`
                : 'Enter your registered email address to receive a password reset link.'}
            </Text>

            {/* ==========================
                EMAIL INPUT & ACTION
            ========================== */}

            {!emailSent ? (
              <>
                <Text style={styles.inputLabel}>Email Address</Text>

                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    console.log('[DEBUG] Email Input Changed:', text);
                  }}
                  placeholder="Enter your email"
                  placeholderTextColor={isDarkMode ? '#777777' : '#999999'}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />

                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.buttonDisabled]}
                  onPress={handleSendResetEmail}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>SEND RESET LINK</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.resendButton}
                onPress={handleSendResetEmail}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#1e3a8a" />
                ) : (
                  <Text style={styles.resendText}>Didn't receive email? Resend link</Text>
                )}
              </TouchableOpacity>
            )}

            {/* ==========================
                LOGIN NAVIGATION
            ========================== */}

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Remember your password?</Text>

              <TouchableOpacity
                onPress={() => {
                  console.log('[DEBUG] Navigating back to Login screen...');
                  router.push('/');
                }}
                disabled={loading}
              >
                <Text style={styles.loginLink}>Log In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ==================================================
// STYLES
// ==================================================

const createStyles = (isDarkMode: boolean) => {
  const backgroundColor = isDarkMode ? '#0f172a' : '#f5f5f5';
  const cardColor = isDarkMode ? '#1e293b' : 'white';
  const textColor = isDarkMode ? '#ffffff' : '#333333';
  const secondaryTextColor = isDarkMode ? '#aaaaaa' : 'gray';
  const borderColor = isDarkMode ? '#333333' : '#dddddd';

  return StyleSheet.create({
    keyboardContainer: {
      flex: 1,
      backgroundColor: backgroundColor,
    },
    scrollContent: {
      flexGrow: 1,
    },
    container: {
      flex: 1,
      backgroundColor: backgroundColor,
      paddingHorizontal: 25,
      paddingTop: 60,
      paddingBottom: 50,
      justifyContent: 'center',
    },
    logoSection: {
      alignItems: 'center',
      marginBottom: 35,
    },
    logoCircle: {
      width: 75,
      height: 75,
      borderRadius: 38,
      backgroundColor: '#1e3a8a',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 15,
    },
    logoText: {
      color: 'white',
      fontSize: 40,
      fontWeight: 'bold',
    },
    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: textColor,
    },
    subtitle: {
      fontSize: 16,
      color: secondaryTextColor,
      marginTop: 4,
      textAlign: 'center',
    },
    card: {
      backgroundColor: cardColor,
      borderRadius: 18,
      padding: 22,
    },
    cardTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: textColor,
      marginBottom: 5,
    },
    cardSubtitle: {
      fontSize: 14,
      color: secondaryTextColor,
      marginBottom: 20,
      lineHeight: 20,
    },
    inputLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: textColor,
      marginBottom: 8,
      marginTop: 15,
    },
    input: {
      backgroundColor: cardColor,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: borderColor,
      paddingHorizontal: 16,
      paddingVertical: 16,
      fontSize: 16,
      color: textColor,
    },
    primaryButton: {
      backgroundColor: '#1e3a8a',
      padding: 18,
      borderRadius: 15,
      alignItems: 'center',
      marginTop: 25,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    primaryButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
    },
    resendButton: {
      alignItems: 'center',
      marginTop: 10,
      paddingVertical: 10,
    },
    resendText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#1e3a8a',
    },
    loginContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 22,
    },
    loginText: {
      fontSize: 14,
      color: secondaryTextColor,
      marginRight: 5,
    },
    loginLink: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#1e3a8a',
    },
  });
};