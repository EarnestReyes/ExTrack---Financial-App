import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    Alert,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getThemePreference } from "../database";

const faqs = [
  {
    question: "How are transactions stored?",
    answer:
      "Transactions are saved locally on this device and are available from the dashboard and Statements & Documents page.",
  },
  {
    question: "How do I edit or delete a transaction?",
    answer:
      "Tap a transaction on the dashboard, then choose Edit transaction or Delete transaction from the action menu.",
  },
  {
    question: "Why is my chart empty?",
    answer:
      "The charts follow the selected time period. Switch between Week, Month, and Year, or add a transaction inside the selected period.",
  },
  {
    question: "How do I enable Face ID or biometrics?",
    answer:
      "Open Preferences & Security and enable Face ID / Biometrics. Your device must have biometric hardware and an enrolled face or fingerprint.",
  },
];

export default function HelpScreen() {
  const router = useRouter();
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === "dark");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const styles = createStyles(isDarkMode);

  useFocusEffect(
    useCallback(() => {
      const savedTheme = getThemePreference();
      setIsDarkMode(
        savedTheme ? savedTheme === "dark" : systemColorScheme === "dark",
      );
    }, [systemColorScheme]),
  );

  const contactSupport = async () => {
    const supportUrl = "mailto:support@extrack.app?subject=ExTrack%20Support";
    const canOpen = await Linking.canOpenURL(supportUrl);
    if (canOpen) {
      await Linking.openURL(supportUrl);
    } else {
      Alert.alert(
        "Support unavailable",
        "Please contact your app administrator for assistance.",
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityLabel="Go back"
          >
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>HELP CENTER</Text>
            <Text style={styles.title}>Help & Support</Text>
            <Text style={styles.subtitle}>
              Answers and guidance for using ExTrack.
            </Text>
          </View>
        </View>

        <View style={styles.supportCard}>
          <View style={styles.supportIcon}>
            <Text style={styles.supportIconText}>?</Text>
          </View>
          <View style={styles.supportCopy}>
            <Text style={styles.supportTitle}>Need a hand?</Text>
            <Text style={styles.supportText}>
              Tell us what went wrong and include the screen or action where you
              noticed it.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.contactButton}
            onPress={contactSupport}
          >
            <Text style={styles.contactButtonText}>Contact</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Frequently asked questions</Text>
        <View style={styles.faqList}>
          {faqs.map((faq, index) => {
            const isExpanded = expandedFaq === index;
            return (
              <View key={faq.question} style={styles.faqItem}>
                <TouchableOpacity
                  style={styles.faqQuestion}
                  onPress={() => setExpandedFaq(isExpanded ? null : index)}
                  accessibilityLabel={`${isExpanded ? "Collapse" : "Expand"} ${faq.question}`}
                >
                  <Text style={styles.questionText}>{faq.question}</Text>
                  <Text style={styles.questionIcon}>
                    {isExpanded ? "−" : "+"}
                  </Text>
                </TouchableOpacity>
                {isExpanded ? (
                  <Text style={styles.answerText}>{faq.answer}</Text>
                ) : null}
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Quick checks</Text>
        <View style={styles.checkList}>
          <View style={styles.checkRow}>
            <Text style={styles.checkMark}>✓</Text>
            <Text style={styles.checkText}>
              Use the latest app build after installing native features.
            </Text>
          </View>
          <View style={styles.checkRow}>
            <Text style={styles.checkMark}>✓</Text>
            <Text style={styles.checkText}>
              Confirm your device has internet access for profile and account
              updates.
            </Text>
          </View>
          <View style={styles.checkRow}>
            <Text style={styles.checkMark}>✓</Text>
            <Text style={styles.checkText}>
              Make sure Face ID or a fingerprint is enrolled in device settings.
            </Text>
          </View>
        </View>

        <Text style={styles.version}>ExTrack support • Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: isDarkMode ? "#0f172a" : "#f8fafc" },
    content: { padding: 20, paddingBottom: 36 },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 22,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDarkMode ? "#334155" : "#e2e8f0",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    backIcon: {
      color: isDarkMode ? "#e2e8f0" : "#334155",
      fontSize: 28,
      lineHeight: 30,
    },
    headerCopy: { flex: 1 },
    eyebrow: {
      color: "#2563eb",
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1.2,
      marginBottom: 4,
    },
    title: {
      color: isDarkMode ? "#f8fafc" : "#0f172a",
      fontSize: 24,
      fontWeight: "800",
    },
    subtitle: {
      color: isDarkMode ? "#94a3b8" : "#64748b",
      fontSize: 13,
      lineHeight: 19,
      marginTop: 4,
    },
    supportCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#0f172a",
      borderRadius: 18,
      padding: 16,
      marginBottom: 24,
    },
    supportIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "#2563eb",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    supportIconText: { color: "#ffffff", fontSize: 20, fontWeight: "800" },
    supportCopy: { flex: 1, marginRight: 10 },
    supportTitle: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
    supportText: {
      color: "#cbd5e1",
      fontSize: 11,
      lineHeight: 16,
      marginTop: 3,
    },
    contactButton: {
      backgroundColor: isDarkMode ? "#dbeafe" : "#ffffff",
      borderRadius: 9,
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    contactButtonText: { color: "#1d4ed8", fontSize: 12, fontWeight: "800" },
    sectionTitle: {
      color: isDarkMode ? "#f8fafc" : "#0f172a",
      fontSize: 16,
      fontWeight: "800",
      marginBottom: 10,
    },
    faqList: {
      backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
      borderRadius: 15,
      borderWidth: 1,
      borderColor: isDarkMode ? "#334155" : "#e2e8f0",
      marginBottom: 22,
    },
    faqItem: {
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? "#334155" : "#e2e8f0",
      paddingHorizontal: 14,
    },
    faqQuestion: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 15,
    },
    questionText: {
      color: isDarkMode ? "#f8fafc" : "#0f172a",
      fontSize: 13,
      fontWeight: "700",
      flex: 1,
      marginRight: 12,
    },
    questionIcon: { color: "#2563eb", fontSize: 21, fontWeight: "400" },
    answerText: {
      color: isDarkMode ? "#cbd5e1" : "#64748b",
      fontSize: 12,
      lineHeight: 18,
      paddingBottom: 15,
    },
    checkList: {
      backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
      borderRadius: 15,
      borderWidth: 1,
      borderColor: isDarkMode ? "#334155" : "#e2e8f0",
      padding: 14,
    },
    checkRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 12,
    },
    checkMark: {
      color: "#16a34a",
      fontSize: 15,
      fontWeight: "800",
      marginRight: 9,
    },
    checkText: {
      color: isDarkMode ? "#cbd5e1" : "#475569",
      fontSize: 12,
      lineHeight: 18,
      flex: 1,
    },
    version: {
      color: "#94a3b8",
      fontSize: 11,
      textAlign: "center",
      marginTop: 24,
    },
  });
