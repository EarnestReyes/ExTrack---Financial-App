import { useReducedMotion } from "../../../hooks/use-reduced-motion";
import { auth } from "@/services/firebase/client";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as PdfTextExtract from "expo-pdf-text-extract";
import { useFocusEffect, useRouter } from "expo-router";
import Papa from "papaparse";
import { useCallback, useState } from "react";
import {
ActivityIndicator,
Alert,
Modal,
ScrollView,
Text,
TouchableOpacity,
useColorScheme,
View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
fetchTransactionsFromDB,
getThemePreference, syncFromFirestore, TransactionItem
} from "../../../database";
import { periodStart, summarize } from "../../../domain/finance";
import { createStyles } from "../styles/StatementsScreen.styles";

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
  const reducedMotion = useReducedMotion();
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

    if (!auth.currentUser) { setTransactions([]); return; }
    try { await syncFromFirestore(); }
    catch { Alert.alert("Cloud sync unavailable", "Showing this account's saved local records."); }
    setTransactions(fetchTransactionsFromDB());
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



      if (result.canceled || !result.assets || result.assets.length === 0)
        return;

      const fileAsset = result.assets[0];
      const fileNameLower = fileAsset.name.toLowerCase();





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

      setIsProcessing(false);
      Alert.alert("Error", error?.message || "Failed to read file.");
    }
  };

  const handleConfirmImport = () => Alert.alert("Import requires review", "Import saving is disabled until bank formats, transaction direction, and duplicate detection are verified. No records have been saved or changed.");
  const summary = summarize(transactions, periodStart(period === "This Month" ? "Month" : period === "This Year" ? "Year" : "All Time"));
  const filteredTransactions = summary.entries;
  const incoming = summary.income, outgoing = summary.expenses, netChange = summary.net;
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

        {summary.reviewCount > 0 && <Text style={styles.emptyText}>{summary.reviewCount} preserved records are excluded pending review (generated card/loan entries or invalid amounts).</Text>}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent statement activity</Text>
          <Text style={styles.countText}>
            {filteredTransactions.length} records
          </Text>
        </View>

        {filteredTransactions.length > 0 ? (
          filteredTransactions.map((transaction) => (
            <View key={transaction.firestoreId} style={styles.transactionRow}>
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
        animationType={reducedMotion ? "none" : "slide"}
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
                  Preview only: {parsedRows.length} rows found. Nothing is saved.
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
                disabled={true}
              >
                <Text style={styles.confirmButtonText}>Import saving unavailable</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
