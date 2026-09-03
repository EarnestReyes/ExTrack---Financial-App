import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useColorScheme,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    fetchTransactionsFromDB,
    getThemePreference,
    TransactionItem,
} from "../database";

type StatementPeriod = "This Month" | "This Year" | "All Time";

const parseTransactionDate = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export default function StatementsScreen() {
  const router = useRouter();
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === "dark");
  const [period, setPeriod] = useState<StatementPeriod>("This Month");
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const styles = createStyles(isDarkMode);

  useFocusEffect(
    useCallback(() => {
      const savedTheme = getThemePreference();
      setIsDarkMode(
        savedTheme ? savedTheme === "dark" : systemColorScheme === "dark",
      );
      setTransactions(fetchTransactionsFromDB());
    }, [systemColorScheme]),
  );

  const now = new Date();
  const filteredTransactions = transactions.filter((transaction) => {
    if (period === "All Time") return true;
    const transactionDate = parseTransactionDate(transaction.date);
    if (period === "This Year")
      return transactionDate.getFullYear() === now.getFullYear();
    return (
      transactionDate.getFullYear() === now.getFullYear() &&
      transactionDate.getMonth() === now.getMonth()
    );
  });

  const incoming = filteredTransactions
    .filter((transaction) => transaction.type === "Income")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const outgoing = filteredTransactions
    .filter((transaction) => transaction.type === "Expense")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const netChange = incoming - outgoing;

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
            <Text style={styles.eyebrow}>ACCOUNT RECORDS</Text>
            <Text style={styles.title}>Statements & Documents</Text>
            <Text style={styles.subtitle}>
              Review your financial activity in one place.
            </Text>
          </View>
        </View>

        <View style={styles.periodRow}>
          {(["This Month", "This Year", "All Time"] as const).map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.periodButton,
                period === option && styles.periodButtonActive,
              ]}
              onPress={() => setPeriod(option)}
            >
              <Text
                style={[
                  styles.periodText,
                  period === option && styles.periodTextActive,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.cardLabel}>{period} summary</Text>
          <Text style={styles.netAmount}>
            PHP{" "}
            {Math.abs(netChange).toLocaleString("en-PH", {
              minimumFractionDigits: 2,
            })}
          </Text>
          <Text
            style={[
              styles.netCaption,
              netChange >= 0 ? styles.income : styles.expense,
            ]}
          >
            {netChange >= 0 ? "Positive net change" : "Negative net change"}
          </Text>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.cardLabel}>Incoming</Text>
              <Text style={styles.income}>
                +PHP {incoming.toLocaleString()}
              </Text>
            </View>
            <View style={styles.summaryRight}>
              <Text style={styles.cardLabel}>Outgoing</Text>
              <Text style={styles.expense}>
                -PHP {outgoing.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent statement activity</Text>
          <Text style={styles.countText}>
            {filteredTransactions.length} records
          </Text>
        </View>

        {filteredTransactions.length > 0 ? (
          filteredTransactions.map((transaction) => (
            <View key={transaction.id} style={styles.transactionRow}>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionName}>{transaction.name}</Text>
                <Text style={styles.transactionMeta}>
                  {transaction.category} • {transaction.date} •{" "}
                  {transaction.time}
                </Text>
              </View>
              <Text
                style={
                  transaction.type === "Income" ? styles.income : styles.expense
                }
              >
                {transaction.type === "Income" ? "+" : "-"}PHP{" "}
                {transaction.amount.toLocaleString()}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No records for this period</Text>
            <Text style={styles.emptyText}>
              Transactions you add will appear here automatically.
            </Text>
          </View>
        )}

        <View style={styles.documentNote}>
          <Text style={styles.documentIcon}>▤</Text>
          <View style={styles.documentCopy}>
            <Text style={styles.documentTitle}>Digital records</Text>
            <Text style={styles.documentText}>
              Your statement activity is stored locally and updates whenever you
              add, edit, or delete a transaction.
            </Text>
          </View>
        </View>
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
    periodRow: {
      flexDirection: "row",
      backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
      borderRadius: 11,
      padding: 4,
      borderWidth: 1,
      borderColor: isDarkMode ? "#334155" : "#e2e8f0",
      marginBottom: 16,
    },
    periodButton: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 9,
      borderRadius: 8,
    },
    periodButtonActive: { backgroundColor: "#2563eb" },
    periodText: {
      color: isDarkMode ? "#94a3b8" : "#64748b",
      fontSize: 11,
      fontWeight: "700",
    },
    periodTextActive: { color: "#ffffff" },
    summaryCard: {
      backgroundColor: "#0f172a",
      borderRadius: 18,
      padding: 18,
      marginBottom: 24,
    },
    cardLabel: { color: "#94a3b8", fontSize: 12, fontWeight: "600" },
    netAmount: {
      color: "#ffffff",
      fontSize: 28,
      fontWeight: "800",
      marginTop: 5,
    },
    netCaption: { fontSize: 12, fontWeight: "700", marginTop: 3 },
    summaryDivider: {
      height: 1,
      backgroundColor: "#334155",
      marginVertical: 16,
    },
    summaryRow: { flexDirection: "row", justifyContent: "space-between" },
    summaryRight: { alignItems: "flex-end" },
    income: { color: "#4ade80", fontWeight: "800", fontSize: 15 },
    expense: { color: "#fb7185", fontWeight: "800", fontSize: 15 },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    sectionTitle: {
      color: isDarkMode ? "#f8fafc" : "#0f172a",
      fontSize: 16,
      fontWeight: "800",
    },
    countText: { color: isDarkMode ? "#94a3b8" : "#64748b", fontSize: 12 },
    transactionRow: {
      backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
      borderRadius: 13,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: isDarkMode ? "#334155" : "#e2e8f0",
      marginBottom: 8,
    },
    transactionInfo: { flex: 1, marginRight: 10 },
    transactionName: {
      color: isDarkMode ? "#f8fafc" : "#0f172a",
      fontSize: 14,
      fontWeight: "700",
    },
    transactionMeta: {
      color: isDarkMode ? "#94a3b8" : "#64748b",
      fontSize: 11,
      marginTop: 4,
    },
    emptyState: {
      backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
      borderRadius: 14,
      padding: 22,
      alignItems: "center",
      borderWidth: 1,
      borderColor: isDarkMode ? "#334155" : "#e2e8f0",
    },
    emptyTitle: {
      color: isDarkMode ? "#f8fafc" : "#0f172a",
      fontSize: 14,
      fontWeight: "700",
    },
    emptyText: {
      color: isDarkMode ? "#94a3b8" : "#64748b",
      fontSize: 12,
      textAlign: "center",
      marginTop: 5,
    },
    documentNote: {
      flexDirection: "row",
      backgroundColor: isDarkMode ? "#172554" : "#eff6ff",
      borderRadius: 14,
      padding: 14,
      marginTop: 20,
    },
    documentIcon: { color: "#2563eb", fontSize: 22, marginRight: 12 },
    documentCopy: { flex: 1 },
    documentTitle: { color: "#1d4ed8", fontSize: 13, fontWeight: "800" },
    documentText: {
      color: isDarkMode ? "#cbd5e1" : "#475569",
      fontSize: 12,
      lineHeight: 18,
      marginTop: 3,
    },
  });
