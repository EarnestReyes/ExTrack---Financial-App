import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useColorScheme,
    View,
} from "react-native";

import DateTimePicker, {
    DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useMemo, useState } from "react";

import { auth, db } from "@/config/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

export default function RegisterScreen() {
  // ==============================
  // THEME
  // ==============================
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);

  // ==============================
  // STATES
  // ==============================
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [address, setAddress] = useState("");
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // ==============================
  // DATE PICKER HANDLER
  // ==============================
    const handleDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
    ) => {
    // On Android, dismiss picker when an action occurs (set or dismissed)
    if (Platform.OS === "android") {
        setShowDatePicker(false);
    }
    
    // Only update date if the user tapped "OK" / selected a date
    if (event.type === "set" && selectedDate) {
        setBirthday(selectedDate);
    }
    };

    const formatDate = (date: Date | null) => {
    if (!date) return "";
    
    // Extract local date components to avoid UTC off-by-one timezone shift
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
    const day = String(date.getDate()).padStart(2, "0");
    
    return `${year}-${month}-${day}`; // Format: YYYY-MM-DD
    };

    const handleMobileNumberChange = (text: string) => {
    // 1. Remove all non-numeric characters
    let digits = text.replace(/\D/g, "");

    // 2. Normalize 63 prefix to leading 0
    if (digits.startsWith("63")) {
        digits = "0" + digits.slice(2);
    }

    // 3. Ensure local format starts with 09
    if (digits.length > 0 && !digits.startsWith("0")) {
        digits = "0" + digits;
    }
    if (digits.length > 1 && !digits.startsWith("09")) {
        digits = "09" + digits.slice(2);
    }

    // 4. Cap strictly at 11 digits (e.g., 09629090803)
    const truncated = digits.slice(0, 11);

    if (truncated.length === 0) {
        setMobileNumber("");
        return;
    }

    // 5. Extract the 10 digits following leading '0'
    const body = truncated.slice(1); // e.g. "9629090803"
    
    // 6. Format into groups: +63 XXX XXX XXXX
    let formatted = "+63";
    if (body.length > 0) {
        formatted += " " + body.slice(0, 3);
    }
    if (body.length > 3) {
        formatted += " " + body.slice(3, 6);
    }
    if (body.length > 6) {
        formatted += " " + body.slice(6, 10);
    }

    setMobileNumber(formatted);
    };

  // ==============================
  // LOCATION HANDLER
  // ==============================
  const handleAddressFocus = async () => {
    // If address is already typed or being fetched, avoid re-triggering prompt
    if (address.trim() !== "" || fetchingLocation) return;

    Alert.alert(
      "Location Access",
      "Would you like us to automatically detect your current address using GPS?",
      [
        {
          text: "No, enter manually",
          style: "cancel",
        },
        {
          text: "Use My Location",
          onPress: async () => {
            try {
              setFetchingLocation(true);
              const { status } =
                await Location.requestForegroundPermissionsAsync();

              if (status !== "granted") {
                Alert.alert(
                  "Permission Denied",
                  "Location access was denied. Please enter your address manually.",
                );
                return;
              }

              const currentLocation = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
              });

              const [reverseGeocode] = await Location.reverseGeocodeAsync({
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
              });

              if (reverseGeocode) {
                const formattedAddress = [
                  reverseGeocode.streetNumber,
                  reverseGeocode.street,
                  reverseGeocode.district,
                  reverseGeocode.city,
                  reverseGeocode.region,
                  reverseGeocode.country,
                ]
                  .filter(Boolean)
                  .join(", ");

                setAddress(formattedAddress || "Location obtained");
              }
            } catch (error) {
              console.error("Location Error:", error);
              Alert.alert(
                "Error",
                "Unable to fetch location. Please type manually.",
              );
            } finally {
              setFetchingLocation(false);
            }
          },
        },
      ],
    );
  };

  // ==============================
  // REGISTER HANDLER
  // ==============================
  const handleRegister = async () => {
    const cleanName = fullName.trim();
    const cleanMobile = mobileNumber.trim();
    const cleanAddress = address.trim();
    const cleanEmail = email.trim();
    const formattedBirthday = formatDate(birthday);

    // Strict Validation: ALL Fields Required
    if (
      !cleanName ||
      !cleanMobile ||
      !formattedBirthday ||
      !cleanAddress ||
      !cleanEmail ||
      !password ||
      !confirmPassword
    ) {
      Alert.alert(
        "Required Fields Missing",
        "Please fill in all fields to register.",
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Validation Error", "Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      // 1. Auth Creation
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password,
      );
      const user = userCredential.user;

      // 2. Profile Update
      await updateProfile(user, { displayName: cleanName });

      // 3. Firestore Document Creation
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        fullName: cleanName,
        mobileNumber: cleanMobile,
        birthday: formattedBirthday,
        address: cleanAddress,
        email: cleanEmail,
        createdAt: new Date().toISOString(),
      });

      router.replace("/(tabs)/home");
    } catch (error: any) {
      console.error("Registration Error:", error.code);

      switch (error.code) {
        case "auth/weak-password":
          Alert.alert(
            "Weak Password",
            "Password should be at least 6 characters.",
          );
          break;
        case "auth/email-already-in-use":
          Alert.alert(
            "Email In Use",
            "This email address is already registered.",
          );
          break;
        case "auth/invalid-email":
          Alert.alert("Invalid Email", "Please enter a valid email address.");
          break;
        case "auth/network-request-failed":
          Alert.alert(
            "Network Error",
            "Please check your internet connection.",
          );
          break;
        default:
          Alert.alert("Registration Failed", error.message);
          break;
      }
    } finally {
      setLoading(false);
    }
  };

  // ==============================
  // RENDER
  // ==============================
  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {/* LOGO / APP NAME */}
          <View style={styles.logoSection}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>E</Text>
            </View>
            <Text style={styles.title}>ExTrack</Text>
            <Text style={styles.subtitle}>Personal Finance Tracker</Text>
          </View>

          {/* REGISTER CARD */}
          <View style={styles.registerCard}>
            <Text style={styles.registerTitle}>Create Account</Text>
            <Text style={styles.registerSubtitle}>
              Sign up to start tracking your finances
            </Text>

            {/* FULL NAME */}
            <Text style={styles.inputLabel}>Full Name *</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={(text) => setFullName(text.replace(/[0-9]/g, ""))}
              placeholder="Enter your full name"
              placeholderTextColor={isDarkMode ? "#777777" : "#999999"}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!loading}
            />

            {/* MOBILE NUMBER */}
            <Text style={styles.inputLabel}>Mobile Number *</Text>
            <TextInput
                style={styles.input}
                value={mobileNumber}
                onChangeText={handleMobileNumberChange}
                placeholder="+63 962 909 0803"
                placeholderTextColor={isDarkMode ? "#777777" : "#999999"}
                keyboardType="phone-pad"
                maxLength={17} // Fits: "+63 962 909 0803"
                editable={!loading}
            />

            {/* BIRTHDAY */}
            <Text style={styles.inputLabel}>Birthday *</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => !loading && setShowDatePicker(true)}
            >
              <View pointerEvents="none">
                <TextInput
                  style={styles.input}
                  value={formatDate(birthday)}
                  placeholder="Select your birthday"
                  placeholderTextColor={isDarkMode ? "#777777" : "#999999"}
                  editable={false}
                />
              </View>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={birthday || new Date(2000, 0, 1)}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                maximumDate={new Date()}
                onChange={handleDateChange}
              />
            )}

            {Platform.OS === "ios" && showDatePicker && (
              <TouchableOpacity
                style={styles.datePickerDoneButton}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.datePickerDoneText}>Done</Text>
              </TouchableOpacity>
            )}

            {/* ADDRESS */}
            <View style={styles.labelWithBadge}>
              <Text style={styles.inputLabel}>Address *</Text>
              {fetchingLocation && (
                <ActivityIndicator
                  size="small"
                  color="#1e3a8a"
                  style={styles.loaderInline}
                />
              )}
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={address}
              onChangeText={setAddress}
              onFocus={handleAddressFocus}
              placeholder="Tap to fetch location or enter address"
              placeholderTextColor={isDarkMode ? "#777777" : "#999999"}
              multiline
              numberOfLines={2}
              editable={!loading && !fetchingLocation}
            />

            {/* EMAIL */}
            <Text style={styles.inputLabel}>Email *</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor={isDarkMode ? "#777777" : "#999999"}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            {/* PASSWORD */}
            <Text style={styles.inputLabel}>Password *</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={isDarkMode ? "#777777" : "#999999"}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            {/* CONFIRM PASSWORD */}
            <Text style={styles.inputLabel}>Confirm Password *</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm your password"
              placeholderTextColor={isDarkMode ? "#777777" : "#999999"}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            {/* REGISTER BUTTON */}
            <TouchableOpacity
              style={[
                styles.registerButton,
                loading && styles.registerButtonDisabled,
              ]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.registerButtonText}>SIGN UP</Text>
              )}
            </TouchableOpacity>

            {/* LOGIN NAVIGATION */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account?</Text>
              <TouchableOpacity
                onPress={() => router.push("/")}
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
  const backgroundColor = isDarkMode ? "#0f172a" : "#f5f5f5";
  const cardColor = isDarkMode ? "#1e293b" : "white";
  const textColor = isDarkMode ? "#ffffff" : "#333333";
  const secondaryTextColor = isDarkMode ? "#aaaaaa" : "gray";
  const borderColor = isDarkMode ? "#333333" : "#dddddd";

  return StyleSheet.create({
    keyboardContainer: {
      flex: 1,
      backgroundColor,
    },
    scrollContent: {
      flexGrow: 1,
    },
    container: {
      flex: 1,
      backgroundColor,
      paddingHorizontal: 25,
      paddingTop: 60,
      paddingBottom: 50,
      justifyContent: "center",
    },
    logoSection: {
      alignItems: "center",
      marginBottom: 35,
    },
    logoCircle: {
      width: 75,
      height: 75,
      borderRadius: 38,
      backgroundColor: "#1e3a8a",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 15,
    },
    logoText: {
      color: "white",
      fontSize: 40,
      fontWeight: "bold",
    },
    title: {
      fontSize: 32,
      fontWeight: "bold",
      color: textColor,
    },
    subtitle: {
      fontSize: 16,
      color: secondaryTextColor,
      marginTop: 4,
      textAlign: "center",
    },
    registerCard: {
      backgroundColor: cardColor,
      borderRadius: 18,
      padding: 22,
    },
    registerTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: textColor,
      marginBottom: 5,
    },
    registerSubtitle: {
      fontSize: 14,
      color: secondaryTextColor,
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: textColor,
      marginBottom: 8,
      marginTop: 15,
    },
    labelWithBadge: {
      flexDirection: "row",
      alignItems: "center",
    },
    loaderInline: {
      marginLeft: 8,
      marginTop: 8,
    },
    input: {
      backgroundColor: cardColor,
      borderRadius: 12,
      borderWidth: 1,
      borderColor,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: textColor,
    },
    textArea: {
      minHeight: 70,
      textAlignVertical: "top",
    },
    datePickerDoneButton: {
      alignSelf: "flex-end",
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    datePickerDoneText: {
      color: "#1e3a8a",
      fontWeight: "bold",
      fontSize: 16,
    },
    registerButton: {
      backgroundColor: "#1e3a8a",
      padding: 18,
      borderRadius: 15,
      alignItems: "center",
      marginTop: 25,
    },
    registerButtonDisabled: {
      opacity: 0.6,
    },
    registerButtonText: {
      color: "white",
      fontSize: 16,
      fontWeight: "bold",
    },
    loginContainer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: 22,
    },
    loginText: {
      fontSize: 14,
      color: secondaryTextColor,
      marginRight: 5,
    },
    loginLink: {
      fontSize: 14,
      fontWeight: "bold",
      color: "#1e3a8a",
    },
  });
};
