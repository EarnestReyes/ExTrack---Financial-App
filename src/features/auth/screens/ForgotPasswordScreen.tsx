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
import { createStyles } from "../styles/ForgotPasswordScreen.styles";

import { router } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { auth } from '../../../services/firebase/client';

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





  }, []);

  // ==============================
  // HANDLERS
  // ==============================

  const handleSendResetEmail = async () => {
    const trimmedEmail = email.trim().toLowerCase();




    if (!trimmedEmail) {

      Alert.alert('Error', 'Please enter your email address.');
      return;
    }

    if (!isValidEmail(trimmedEmail)) {

      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);


      await sendPasswordResetEmail(auth, trimmedEmail);


      setEmailSent(true);
      Alert.alert(
        'Email Sent',
        `A password reset link has been sent to ${trimmedEmail}. Please check your inbox or spam folder.`
      );
    } catch (error: any) {





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
            <BrandMark />

            <Text style={styles.title}>ExTrack</Text>

            <Text style={styles.subtitle}>A clearer view of your money.</Text>
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
              accessibilityLabel="Email address"
                  onChangeText={(text) => {
                    setEmail(text);

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