import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';
import { getThemePreference } from '../database';

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  visible,
  onClose,
}) => {
  const systemColorScheme = useColorScheme();

  // Initialize theme state from database preference
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const savedTheme = getThemePreference();
    if (savedTheme !== null) {
      return savedTheme === 'dark';
    }
    return systemColorScheme === 'dark';
  });

  // Re-sync theme preference when the modal opens
  const syncTheme = useCallback(() => {
    const savedTheme = getThemePreference();
    if (savedTheme !== null) {
      setIsDarkMode(savedTheme === 'dark');
    } else {
      setIsDarkMode(systemColorScheme === 'dark');
    }
  }, [systemColorScheme]);

  // Memoize stylesheet matching app color values
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Pre-fill email with currently logged-in user's email if available
  useEffect(() => {
    if (visible) {
      const currentUserEmail = auth?.currentUser?.email;
      if (currentUserEmail) {
        setEmail(currentUserEmail);
      }
    } else {
      // Reset state on close
      setEmailSent(false);
      setLoading(false);
    }
  }, [visible]);

  const isValidEmail = (emailStr: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailStr.trim());
  };

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

      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email address.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'The email address format is invalid.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many attempts. Please try again later.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your internet connection.';
          break;
        default:
          errorMessage = error.message || errorMessage;
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onShow={syncTheme}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={styles.backdropClickable}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.content}>
          <View style={styles.dragHandle} />

          <View style={styles.header}>
            <View style={styles.headerTextGroup}>
              <Text style={styles.title}>Change Password</Text>
              <Text style={styles.subtitle}>
                Send a reset link to your email address
              </Text>
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={styles.description}>
              {emailSent
                ? `We sent a reset link to ${email}. Check your inbox and follow the instructions.`
                : 'Enter your registered email address below to receive a secure password reset link.'}
            </Text>

            {!emailSent ? (
              <>
                <Text style={styles.inputLabel}>Email Address</Text>
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
                  <ActivityIndicator color="#3b82f6" />
                ) : (
                  <Text style={styles.resendText}>
                    Didn't receive email? Resend link
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default ChangePasswordModal;

const createStyles = (isDarkMode: boolean) => {
  const cardColor = isDarkMode ? '#1e293b' : '#ffffff';
  const textColor = isDarkMode ? '#f8fafc' : '#0f172a';
  const secondaryTextColor = isDarkMode ? '#94a3b8' : '#64748b';
  const borderColor = isDarkMode ? '#334155' : '#cbd5e1';
  const overlayBg = isDarkMode ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.65)';
  const dragHandleBg = isDarkMode ? '#475569' : '#e2e8f0';
  const closeBtnBg = isDarkMode ? '#334155' : '#f8fafc';
  const inputBg = isDarkMode ? '#0f172a' : '#f8fafc';

  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: overlayBg,
    },
    backdropClickable: {
      ...StyleSheet.absoluteFill,
    },
    content: {
      backgroundColor: cardColor,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: Platform.OS === 'ios' ? 40 : 24,
      maxHeight: '80%',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: -10 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 24,
      borderWidth: 1,
      borderColor,
    },
    dragHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: dragHandleBg,
      alignSelf: 'center',
      marginBottom: 16,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    headerTextGroup: {
      flex: 1,
      marginRight: 12,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: textColor,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 13,
      fontWeight: '500',
      color: secondaryTextColor,
      marginTop: 2,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: closeBtnBg,
      borderColor,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeText: {
      fontSize: 14,
      fontWeight: '700',
      color: secondaryTextColor,
    },
    scrollContent: {
      paddingBottom: 20,
    },
    description: {
      fontSize: 14,
      color: secondaryTextColor,
      lineHeight: 20,
      marginBottom: 12,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: textColor,
      marginBottom: 8,
      marginTop: 12,
    },
    input: {
      backgroundColor: inputBg,
      borderRadius: 14,
      borderWidth: 1,
      borderColor,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      color: textColor,
    },
    primaryButton: {
      backgroundColor: '#1e3a8a',
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: 'center',
      marginTop: 20,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    primaryButtonText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    resendButton: {
      alignItems: 'center',
      marginTop: 12,
      paddingVertical: 12,
    },
    resendText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#3b82f6',
    },
  });
};