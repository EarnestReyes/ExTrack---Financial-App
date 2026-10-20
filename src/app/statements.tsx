import { auth, db as firestoreDb } from "@/config/firebase";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as PdfTextExtract from "expo-pdf-text-extract";
import { useFocusEffect, useRouter } from "expo-router";
import { collection, getDocs, QueryDocumentSnapshot } from "firebase/firestore";
import Papa from "papaparse";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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

const parseCustomBankDate = (
  dateStr?: string,
  fallbackYear = new Date().getFullYear(),
): Date | null => {
  if (!dateStr) return null;

  try {
    const cleaned = dateStr.split(",")[0].trim();
    const parts = cleaned.split(" ");

    if (parts.length >= 2) {
      const day = parseInt(parts[0], 10);
      const monthStr = parts[1].toLowerCase();

      const months: { [key: string]: number } = {
        jan: 0,
        feb: 1,
        mar: 2,
        apr: 3,
        may: 4,
        jun: 5,
        jul: 6,
        aug: 7,
        sep: 8,
        oct: 9,
        nov: 10,
        dec: 11,
      };

      const monthKey = monthStr.substring(0, 3);
      if (months[monthKey] !== undefined && !isNaN(day)) {
        return new Date(fallbackYear, months[monthKey], day);
      }
    }
  } catch (e) {
    // Fallback
  }

  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? null : fallback;
};

const isExpenseType = (type?: string) => {
  if (!type) return false;
  const normalized = type.toLowerCase();
  return (
    normalized === "expense" ||
    normalized === "loan" ||
    normalized === "loan payment" ||
    normalized === "loan deduction" ||
    normalized === "deduction" ||
    normalized === "debit"
  );
};

export default function StatementsScreen() {
  const router = useRouter();
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === "dark");
  const [period, setPeriod] = useState<StatementPeriod>("All Time");
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const styles = createStyles(isDarkMode);

  const loadTransactionsData = useCallback(async () => {
    const savedTheme = getThemePreference();
    setIsDarkMode(
      savedTheme ? savedTheme === "dark" : systemColorScheme === "dark",
    );

    const localTransactions = fetchTransactionsFromDB();
    let combinedTransactions = [...localTransactions];

    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const userPath = `users/${currentUser.uid}`;
        const transactionsRef = collection(
          firestoreDb,
          userPath,
          "transactions",
        );
        const snapshot = await getDocs(transactionsRef);

        const remoteTransactions: TransactionItem[] = snapshot.docs.map(
          (docSnap: QueryDocumentSnapshot) => {
            const data = docSnap.data();
            return {
              firestoreId: docSnap.id,
              id: Number(data.id) || Date.now() + Math.random(),
              name: data.name,
              amount: Number(data.amount) || 0,
              type: data.type,
              category: data.category,
              date: data.date,
              time: data.time,
              loanId: data.loanId || null,
            };
          },
        );

        const cardsRef = collection(firestoreDb, userPath, "cards");
        const cardsSnapshot = await getDocs(cardsRef);
        const cardTransactions: TransactionItem[] = cardsSnapshot.docs.map(
          (docSnap, index) => {
            const data = docSnap.data();
            return {
              firestoreId: `card-${docSnap.id}`,
              id: Date.now() + index,
              name: `Card Balance: ${data.name || "Card"}`,
              amount: Number(data.amount) || 0,
              type: "Income",
              category: "Card",
              date: data.createdAt
                ? data.createdAt.split("T")[0]
                : new Date().toISOString().split("T")[0],
              time: "12:00 PM",
              loanId: null,
            };
          },
        );

        const localIds = new Set(localTransactions.map((t) => t.id));
        const newRemoteItems = remoteTransactions.filter(
          (rt) => !rt.id || !localIds.has(rt.id),
        );

        combinedTransactions = [
          ...localTransactions,
          ...newRemoteItems,
          ...cardTransactions,
        ];
      } catch (error) {
        console.error("Error syncing Firestore transactions/cards:", error);
      }
    }

    setTransactions(combinedTransactions);
  }, [systemColorScheme]);

  useFocusEffect(
    useCallback(() => {
      loadTransactionsData();
    }, [loadTransactionsData]),
  );

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      console.log("📄 DocumentPicker Full Result:", JSON.stringify(result));

      if (result.canceled || !result.assets || result.assets.length === 0)
        return;

      const fileAsset = result.assets[0];
      const fileNameLower = fileAsset.name.toLowerCase();

      console.log("📂 File Name:", fileAsset.name);
      console.log("🔗 File URI:", fileAsset.uri);
      console.log("📋 MIME Type:", fileAsset.mimeType);

      setSelectedFileName(fileAsset.name);
      setIsProcessing(true);

      if (fileNameLower.endsWith(".pdf")) {
        try {
          const rawText = await PdfTextExtract.extractText(fileAsset.uri);
          const lines = rawText.split("\n");
          const extractedRows: any[] = [];

          lines.forEach((line: string) => {
            const hasDate =
              /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(line);
            const amounts = line.match(/[\d,]+\.\d{2}/g);

            if (hasDate && amounts) {
              extractedRows.push({
                "Date and time": line.substring(0, 18).trim(),
                Description: line.trim(),
                "Amount (PHP)": amounts[0],
              });
            }
          });

          setIsProcessing(false);
          if (extractedRows.length > 0) {
            setParsedRows(extractedRows);
            Alert.alert(
              "PDF Parsed",
              `Extracted ${extractedRows.length} potential transactions.`,
            );
          } else {
            Alert.alert(
              "No Data",
              "Could not find valid transactions in this PDF.",
            );
          }
        } catch (pdfErr: any) {
          console.error("PDF Parsing Error:", pdfErr);
          setIsProcessing(false);
          Alert.alert(
            "PDF Error",
            "Failed to extract text. Ensure you are using a Development Build.",
          );
        }
        return;
      }

      if (fileNameLower.endsWith(".csv") || fileNameLower.endsWith(".txt")) {
        const fileText = await FileSystem.readAsStringAsync(fileAsset.uri);
        Papa.parse(fileText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setIsProcessing(false);
            if (results.data && results.data.length > 0) {
              setParsedRows(results.data);
            } else {
              Alert.alert("Empty File", "No rows found in CSV.");
            }
          },
          error: (error: Error) => {
            setIsProcessing(false);
            Alert.alert("CSV Error", error.message);
          },
        });
        return;
      }

      setIsProcessing(false);
      Alert.alert(
        "Unsupported File",
        `Selected file name: "${fileAsset.name}" does not end with .pdf or .csv`,
      );
    } catch (error: any) {
      console.error("Picker Error:", error);
      setIsProcessing(false);
      Alert.alert("Error", error?.message || "Failed to read file.");
    }
  };

  const handleConfirmImport = () => {
    if (parsedRows.length === 0) {
      Alert.alert("No Data", "Please select a valid statement file first.");
      return;
    }

    try {
      let importedCount = 0;
      const newItems: TransactionItem[] = [];

      let targetYear = new Date().getFullYear();
      if (selectedFileName) {
        const yearMatch = selectedFileName.match(/20\d{2}/);
        if (yearMatch) targetYear = parseInt(yearMatch[0], 10);
      }

      parsedRows.forEach((row, index) => {
        const keys = Object.keys(row as object);
        if (keys.length === 0) return;

        const findValue = (targets: string[]) => {
          for (const k of keys) {
            const cleanKey = k.toLowerCase().trim();
            if (targets.some((t) => cleanKey.includes(t))) {
              return row[k];
            }
          }
          return undefined;
        };

        const rawDate = findValue(["date and time", "date", "timestamp"]);
        const rawName = findValue(["description", "particulars", "details"]);
        const rawAmountStr = findValue([
          "amount (php)",
          "amount",
          "amt",
          "value",
        ]);

        const cleanAmount = parseFloat(
          String(rawAmountStr || "0").replace(/[,₱PHP]/g, ""),
        );

        if (!isNaN(cleanAmount) && cleanAmount !== 0) {
          let formattedDate = new Date().toISOString().split("T")[0];
          let extractedTime = "12:00 PM";

          if (rawDate) {
            const dateStrVal = String(rawDate);
            if (dateStrVal.includes(",")) {
              extractedTime = dateStrVal.split(",")[1].trim();
            }
            const parsed = parseCustomBankDate(dateStrVal, targetYear);
            if (parsed) {
              formattedDate = parsed.toISOString().split("T")[0];
            }
          }

          const isInc = cleanAmount > 0;
          const normalizedItem: TransactionItem = {
            id: Date.now() + index + Math.random(),
            name: rawName
              ? String(rawName).trim().split("\n")[0]
              : "Bank Statement Item",
            amount: Math.abs(cleanAmount),
            type: isInc ? "Income" : "Expense",
            category: "Bank Import",
            date: formattedDate,
            time: extractedTime,
            loanId: null,
          };

          newItems.push(normalizedItem);
          importedCount++;
        }
      });

      if (importedCount > 0) {
        setTransactions((prev) => [...newItems, ...prev]);
        setPeriod("All Time");
        Alert.alert(
          "Success",
          `Successfully imported ${importedCount} transaction rows!`,
        );
      } else {
        Alert.alert(
          "Import Warning",
          "Could not detect matching columns or rows.",
        );
      }

      setIsModalVisible(false);
      setParsedRows([]);
      setSelectedFileName(null);
    } catch (error: any) {
      Alert.alert("Import Failed", error?.message || "An error occurred.");
    }
  };

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const filteredTransactions = transactions.filter((transaction) => {
    if (period === "All Time") return true;

    const transactionDate = parseCustomBankDate(transaction.date);
    if (!transactionDate) return false;

    if (period === "This Year") {
      return transactionDate.getFullYear() === currentYear;
    }

    return (
      transactionDate.getFullYear() === currentYear &&
      transactionDate.getMonth() === currentMonth
    );
  });

  const incoming = filteredTransactions
    .filter((transaction) => transaction.type?.toLowerCase() === "income")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const outgoing = filteredTransactions
    .filter((transaction) => isExpenseType(transaction.type))
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

          <TouchableOpacity
            style={styles.importHeaderButton}
            onPress={() => setIsModalVisible(true)}
          >
            <Text style={styles.importHeaderButtonText}>+ Import</Text>
          </TouchableOpacity>
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
              Transactions you add or import will appear here automatically.
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Import Statement File</Text>
            <Text style={styles.modalSubtitle}>
              Upload either a Maya PDF statement or a CSV spreadsheet export.
            </Text>

            <TouchableOpacity
              style={styles.filePickerBox}
              onPress={handlePickDocument}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#2563eb" />
              ) : (
                <>
                  <Text style={styles.filePickerIcon}>📂</Text>
                  <Text style={styles.filePickerText}>
                    {selectedFileName
                      ? selectedFileName
                      : "Tap to browse PDF or CSV files"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {parsedRows.length > 0 && (
              <View style={styles.previewContainer}>
                <Text style={styles.previewTitle}>
                  Preview: {parsedRows.length} rows found
                </Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setIsModalVisible(false);
                  setParsedRows([]);
                  setSelectedFileName(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.confirmButton,
                  parsedRows.length === 0 && styles.disabledButton,
                ]}
                onPress={handleConfirmImport}
                disabled={parsedRows.length === 0}
              >
                <Text style={styles.confirmButtonText}>Import Records</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    importHeaderButton: {
      backgroundColor: "#2563eb",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      alignSelf: "center",
    },
    importHeaderButtonText: {
      color: "#ffffff",
      fontSize: 12,
      fontWeight: "700",
    },
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
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalContent: {
      backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
      borderRadius: 18,
      padding: 22,
      width: "100%",
      maxWidth: 400,
      borderWidth: 1,
      borderColor: isDarkMode ? "#334155" : "#e2e8f0",
    },
    modalTitle: {
      color: isDarkMode ? "#f8fafc" : "#0f172a",
      fontSize: 18,
      fontWeight: "800",
      marginBottom: 6,
    },
    modalSubtitle: {
      color: isDarkMode ? "#94a3b8" : "#64748b",
      fontSize: 12,
      marginBottom: 18,
      lineHeight: 18,
    },
    filePickerBox: {
      borderWidth: 2,
      borderColor: isDarkMode ? "#334155" : "#cbd5e1",
      borderStyle: "dashed",
      borderRadius: 12,
      padding: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isDarkMode ? "#0f172a" : "#f8fafc",
      marginBottom: 16,
    },
    filePickerIcon: { fontSize: 28, marginBottom: 8 },
    filePickerText: {
      color: isDarkMode ? "#94a3b8" : "#64748b",
      fontSize: 12,
      fontWeight: "600",
      textAlign: "center",
    },
    previewContainer: {
      marginBottom: 16,
      padding: 10,
      backgroundColor: isDarkMode ? "#0f172a" : "#eff6ff",
      borderRadius: 8,
    },
    previewTitle: {
      color: isDarkMode ? "#4ade80" : "#1d4ed8",
      fontSize: 12,
      fontWeight: "700",
      textAlign: "center",
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 10,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: "center",
    },
    cancelButton: {
      backgroundColor: isDarkMode ? "#334155" : "#e2e8f0",
    },
    cancelButtonText: {
      color: isDarkMode ? "#f8fafc" : "#334155",
      fontSize: 13,
      fontWeight: "700",
    },
    confirmButton: {
      backgroundColor: "#2563eb",
    },
    confirmButtonText: {
      color: "#ffffff",
      fontSize: 13,
      fontWeight: "700",
    },
    disabledButton: {
      opacity: 0.5,
    },
  });
