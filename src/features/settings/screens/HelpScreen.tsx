import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
ScrollView,
Text,
TouchableOpacity,
View,
useColorScheme
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getThemePreference } from "../../../database";
import { createStyles } from "../styles/HelpScreen.styles";

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
            <Text style={styles.supportTitle}>Make the most of ExTrack</Text>
            <Text style={styles.supportText}>
              Review your activity, explore recorded spending in Insights, and find answers below.
            </Text>
          </View>
        </View>

        <TouchableOpacity accessibilityRole="button" style={styles.contactButton} onPress={() => router.navigate("/ChatSupport")}><Text style={styles.contactButtonText}>Ask the ExTrack assistant</Text></TouchableOpacity>

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
