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
} from 'react-native';

import { router } from 'expo-router';
import { useState, useRef } from 'react';

export default function ForgotPasswordScreen() {

  // ==============================
  // THEME
  // ==============================

  const colorScheme = useColorScheme();

  const isDarkMode = colorScheme === 'dark';

  const styles = createStyles(isDarkMode);


  // ==============================
  // STATES & REFS
  // ==============================

  const [email, setEmail] = useState('');

  const [step, setStep] = useState<'request' | 'verify'>('request');

  const [otp, setOtp] = useState(['', '', '', '', '', '']);

  const inputRefs = useRef<Array<TextInput | null>>([]);


  // ==============================
  // HANDLERS
  // ==============================

  const handleSendOTP = () => {
    if (!email) {
      alert('Please enter your email address.');
      return;
    }

    // TODO: Trigger Firebase email OTP request here
    setStep('verify');
  };

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Auto-advance focus to the next input box
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    // Focus previous input box on backspace if current cell is empty
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = () => {
    const enteredCode = otp.join('');

    if (enteredCode.length < 6) {
      alert('Please enter the full 6-digit verification code.');
      return;
    }

    // TODO: Verify OTP against Firebase here
    alert('Code verified! You may now reset your password.');
    router.replace('/');
  };


  // ==============================
  // SCREEN
  // ==============================

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >

      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }

        showsVerticalScrollIndicator={false}

        keyboardShouldPersistTaps="handled"
      >

        <View style={styles.container}>

          {/* ==========================
              LOGO / APP NAME
          ========================== */}

          <View style={styles.logoSection}>

            <View style={styles.logoCircle}>

              <Text style={styles.logoText}>
                E
              </Text>

            </View>

            <Text style={styles.title}>
              ExTrack
            </Text>

            <Text style={styles.subtitle}>
              Personal Finance Tracker
            </Text>

          </View>


          {/* ==========================
              FORGOT PASSWORD CARD
          ========================== */}

          <View style={styles.card}>

            <Text style={styles.cardTitle}>
              {step === 'request' ? 'Reset Password' : 'Enter OTP'}
            </Text>

            <Text style={styles.cardSubtitle}>
              {step === 'request'
                ? 'Enter your registered email address to receive a verification code.'
                : `Enter the 6-digit code sent to ${email}`}
            </Text>


            {/* ==========================
                STEP 1: EMAIL INPUT
            ========================== */}

            {step === 'request' ? (
              <>

                <Text style={styles.inputLabel}>
                  Email Address
                </Text>

                <TextInput
                  style={styles.input}

                  value={email}

                  onChangeText={setEmail}

                  placeholder="Enter your email"

                  placeholderTextColor={
                    isDarkMode
                      ? '#777777'
                      : '#999999'
                  }

                  keyboardType="email-address"

                  autoCapitalize="none"

                  autoCorrect={false}
                />

                <TouchableOpacity
                  style={styles.primaryButton}

                  onPress={handleSendOTP}
                >

                  <Text style={styles.primaryButtonText}>
                    SEND CODE
                  </Text>

                </TouchableOpacity>

              </>
            ) : (


            /* ==========================
                STEP 2: OTP INPUT
            ========================== */

              <>

                <Text style={styles.inputLabel}>
                  Verification Code
                </Text>

                <View style={styles.otpContainer}>

                  {otp.map((digit, index) => (

                    <TextInput
                      key={index}

                    ref={(ref) => {
                    inputRefs.current[index] = ref;
                    }}

                      style={styles.otpBox}

                      value={digit}

                      onChangeText={(text) => handleOtpChange(text, index)}

                      onKeyPress={(e) => handleKeyPress(e, index)}

                      keyboardType="number-pad"

                      maxLength={1}

                      selectTextOnFocus
                    />

                  ))}

                </View>

                <TouchableOpacity
                  style={styles.primaryButton}

                  onPress={handleVerifyOTP}
                >

                  <Text style={styles.primaryButtonText}>
                    VERIFY & CONTINUE
                  </Text>

                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.resendButton}

                  onPress={() => setStep('request')}
                >

                  <Text style={styles.resendText}>
                    Change Email or Resend Code
                  </Text>

                </TouchableOpacity>

              </>
            )}


            {/* ==========================
                LOGIN NAVIGATION
            ========================== */}

            <View style={styles.loginContainer}>

              <Text style={styles.loginText}>
                Remember your password?
              </Text>

              <TouchableOpacity
                onPress={() => {
                  router.push('/');
                }}
              >

                <Text style={styles.loginLink}>
                  Log In
                </Text>

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

const createStyles = (
  isDarkMode: boolean
) => {

  const backgroundColor =
    isDarkMode
      ? '#0f172a'
      : '#f5f5f5';

  const cardColor =
    isDarkMode
      ? '#1e293b'
      : 'white';

  const textColor =
    isDarkMode
      ? '#ffffff'
      : '#333333';

  const secondaryTextColor =
    isDarkMode
      ? '#aaaaaa'
      : 'gray';

  const borderColor =
    isDarkMode
      ? '#333333'
      : '#dddddd';


  return StyleSheet.create({

    // =========================
    // MAIN SCREEN
    // =========================

    keyboardContainer: {
      flex: 1,

      backgroundColor:
        backgroundColor,
    },

    scrollContent: {
      flexGrow: 1,
    },

    container: {
      flex: 1,

      backgroundColor:
        backgroundColor,

      paddingHorizontal: 25,

      paddingTop: 60,

      paddingBottom: 50,

      justifyContent: 'center',
    },


    // =========================
    // LOGO
    // =========================

    logoSection: {
      alignItems: 'center',

      marginBottom: 35,
    },

    logoCircle: {
      width: 75,

      height: 75,

      borderRadius: 38,

      backgroundColor:
        '#1e3a8a',

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


    // =========================
    // CARD & INPUTS
    // =========================

    card: {
      backgroundColor:
        cardColor,

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
      backgroundColor:
        cardColor,

      borderRadius: 12,

      borderWidth: 1,

      borderColor:
        borderColor,

      paddingHorizontal: 16,

      paddingVertical: 16,

      fontSize: 16,

      color: textColor,
    },


    // =========================
    // OTP INPUT FIELDS
    // =========================

    otpContainer: {
      flexDirection: 'row',

      justifyContent: 'space-between',

      marginTop: 10,

      marginBottom: 10,
    },

    otpBox: {
      width: 44,

      height: 52,

      borderRadius: 10,

      borderWidth: 1,

      borderColor:
        borderColor,

      backgroundColor:
        cardColor,

      textAlign: 'center',

      fontSize: 20,

      fontWeight: 'bold',

      color: textColor,
    },


    // =========================
    // BUTTONS
    // =========================

    primaryButton: {
      backgroundColor:
        '#1e3a8a',

      padding: 18,

      borderRadius: 15,

      alignItems: 'center',

      marginTop: 25,
    },

    primaryButtonText: {
      color: 'white',

      fontSize: 16,

      fontWeight: 'bold',
    },

    resendButton: {
      alignItems: 'center',

      marginTop: 18,
    },

    resendText: {
      fontSize: 14,

      fontWeight: '600',

      color: '#1e3a8a',
    },


    // =========================
    // NAVIGATION
    // =========================

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