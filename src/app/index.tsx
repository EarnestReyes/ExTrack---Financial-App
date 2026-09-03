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
import { useState } from 'react';

export default function LoginScreen() {

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

  const [password, setPassword] = useState('');


  // ==============================
  // LOGIN
  // ==============================

  const handleLogin = () => {
  router.replace('/home');
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
              LOGIN CARD
          ========================== */}

          <View style={styles.loginCard}>

            <Text style={styles.loginTitle}>
              Welcome Back
            </Text>

            <Text style={styles.loginSubtitle}>
              Log in to continue to ExTrack
            </Text>


            {/* ==========================
                EMAIL
            ========================== */}

            <Text style={styles.inputLabel}>
              Email
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


            {/* ==========================
                PASSWORD
            ========================== */}

            <Text style={styles.inputLabel}>
              Password
            </Text>

            <TextInput
              style={styles.input}

              value={password}

              onChangeText={setPassword}

              placeholder="Enter your password"

              placeholderTextColor={
                isDarkMode
                  ? '#777777'
                  : '#999999'
              }

              secureTextEntry

              autoCapitalize="none"
            />


            {/* ==========================
                FORGOT PASSWORD
            ========================== */}

            <TouchableOpacity
              style={styles.forgotButton}
              onPress={() => {
                console.log(
                  'Forgot password'
                );
              }}
            >

              <Text style={styles.forgotText}>
                Forgot Password?
              </Text>

            </TouchableOpacity>


            {/* ==========================
                LOGIN BUTTON
            ========================== */}

            <TouchableOpacity
              style={styles.loginButton}

              onPress={handleLogin}
            >

              <Text style={styles.loginButtonText}>
                LOG IN
              </Text>

            </TouchableOpacity>


            {/* ==========================
                REGISTER
            ========================== */}

            <View style={styles.registerContainer}>

              <Text style={styles.registerText}>
                Don't have an account?
              </Text>

              <TouchableOpacity
                onPress={() => {
                  console.log(
                    'Go to Register'
                  );
                }}
              >

                <Text style={styles.registerLink}>
                  Register
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
      ? '#121212'
      : '#f5f5f5';

  const cardColor =
    isDarkMode
      ? '#1e1e1e'
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
    // LOGIN CARD
    // =========================

    loginCard: {
      backgroundColor:
        cardColor,

      borderRadius: 18,

      padding: 22,
    },

    loginTitle: {
      fontSize: 24,

      fontWeight: 'bold',

      color: textColor,

      marginBottom: 5,
    },

    loginSubtitle: {
      fontSize: 14,

      color: secondaryTextColor,

      marginBottom: 20,
    },


    // =========================
    // INPUTS
    // =========================

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
    // FORGOT PASSWORD
    // =========================

    forgotButton: {
      alignSelf: 'flex-end',

      marginTop: 12,
    },

    forgotText: {
      fontSize: 14,

      fontWeight: '600',

      color: '#1e3a8a',
    },


    // =========================
    // LOGIN BUTTON
    // =========================

    loginButton: {
      backgroundColor:
        '#1e3a8a',

      padding: 18,

      borderRadius: 15,

      alignItems: 'center',

      marginTop: 25,
    },

    loginButtonText: {
      color: 'white',

      fontSize: 16,

      fontWeight: 'bold',
    },


    // =========================
    // REGISTER
    // =========================

    registerContainer: {
      flexDirection: 'row',

      justifyContent: 'center',

      alignItems: 'center',

      marginTop: 22,
    },

    registerText: {
      fontSize: 14,

      color: secondaryTextColor,

      marginRight: 5,
    },

    registerLink: {
      fontSize: 14,

      fontWeight: 'bold',

      color: '#1e3a8a',
    },

  });
};

