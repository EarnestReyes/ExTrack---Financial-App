import { SafeModal as Modal } from '../../../components/ui/safe-modal';
import { LocalInsightsPanel } from "../../insights/components/LocalInsightsPanel";
import { LoanCard } from "../components/LoanCard";
import { TransactionRow } from "../../../components/ui/transaction-row";
import { BalanceBackdrop } from "../../../components/ui/balance-backdrop";
import { Entrance } from "../../../components/ui/entrance";
import { useReducedMotion } from "../../../hooks/use-reduced-motion";
import { getDesignTheme } from "../../../constants/design";
import DefaultAvatar from "@/assets/images/default-avatar.png";
import { auth, db } from "@/services/firebase/client";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import {
doc,
onSnapshot
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import {
Alert,
useWindowDimensions,
FlatList,
Image,
KeyboardAvoidingView,
Keyboard,
Platform,
RefreshControl,
ScrollView,
Text,
TextInput,
TouchableOpacity,
useColorScheme,
View
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { cacheUserProfile, confirmLoanInstallment, getSyncState, subscribeFinancialData, syncFromFirestore, watchFinancialData } from "../../../database";
import { legacyStorageStatus } from "../../../database/legacyStorage";
import { chartData, loanSchedule, localDate, mergeLedger, summarize } from "../../../domain/finance";
import { sendNegativeBalanceEmail } from "../../../services/email/emailService";
import { createStyles } from "../styles/DashboardScreen.styles";

import {
deleteTransactionFromDB,
fetchLoansFromDB,
fetchTransactionsFromDB,
getThemePreference,
getUserProfilePicture,
initDatabase,
insertTransactionToDB,
LoanItem,
setThemePreference,
TransactionItem,
updateTransactionInDB
} from "../../../database";

interface GraphDataItem {
  date: string;
  income: number;
  expense: number;
}



 const overviewPeriods = ["Day", "Week", "Month", "Year"] as const;
  type OverviewPeriod = (typeof overviewPeriods)[number];


export default function HomeScreen({ mode = "home" }: { mode?: "home" | "activity" | "insights" }) {
  const safeInsets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const { compose } = useLocalSearchParams<{ compose?: string }>();
  const reducedMotion = useReducedMotion();
  const [search, setSearch] = useState("");



  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [showLoansModal, setShowLoansModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hideBalance, setHideBalance] = useState(false); // 👈 Added state for hiding/showing balance
  const [isDataLoading, setIsDataLoading] = useState(true); // 👈 Guard state to track data fetching status
  const INITIAL_COUNT = 3;

  const router = useRouter();
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState<boolean>(
    systemColorScheme === "dark",
  );

  const [profilePic, setProfilePic] = useState<string | null>(null);
  const currentUser = auth.currentUser;

  // Notification Preference State
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<
    string | undefined
  >();
  const savingRef = useRef(false);
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [legacyStatus, setLegacyStatus] = useState("unknown");
  useEffect(() => { let active = true; void legacyStorageStatus().then((status) => { if (active) setLegacyStatus(status); }); return () => { active = false; }; }, []);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"Income" | "Expense">("Expense");
  const [category, setCategory] = useState("");

// View States
  const [filter, setFilter] = useState("All");
  const [overviewPeriod, setOverviewPeriod] = useState<
    "Day" | "Week" | "Month" | "Year"
  >("Day");
  const [balancePeriod, setBalancePeriod] =
    useState<typeof overviewPeriod>("Day");
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);

  // FIXED: Consolidated loan states to prevent shadowing/re-load clearing bugs
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<LoanItem | null>(null);

  // Cards State for Recent Transactions Integration
  const [cards, setCards] = useState<any[]>([]);

  const [selectedTransaction,
    setSelectedTransaction] =
    useState<TransactionItem | null>(null);

  // Guard ref to ensure negative balance email is sent only once per negative cycle
  const emailAlertSentRef = useRef(false);



  const handleTriggerEmail = async (balance: number) => {
    if (mode !== "home" || !currentUser?.email || !notificationsEnabled) return;
    const success = await sendNegativeBalanceEmail({
      email: currentUser.email,
      userName: currentUser.displayName || "User",
      balance: balance,
    });

    if (success) {

    }
  };




  useEffect(() => {
    initDatabase();
    loadTransactions();
    loadLoans();


  }, [currentUser]);


  useFocusEffect(
    useCallback(() => {
      const savedTheme = getThemePreference();
      if (savedTheme !== null) {
        setIsDarkMode(savedTheme === "dark");
      } else {
        setIsDarkMode(systemColorScheme === "dark");
      }

      // Fetch profile picture from local DB fallback immediately on screen focus
      const localPic = getUserProfilePicture();
      if (localPic) {
        setProfilePic(localPic);

      }

      // Load loans on focus
      loadLoans();
    }, [systemColorScheme]),
  );

  // Pull-to-refresh reload handler function
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const savedTheme = getThemePreference();
      if (savedTheme !== null) {
        setIsDarkMode(savedTheme === "dark");
      }

      const localPic = getUserProfilePicture();
      if (localPic) {
        setProfilePic(localPic);

      }

      loadTransactions();
      loadLoans();

      if (currentUser) {
        await syncFromFirestore();
      }
    } catch (error) {

    } finally {
      setRefreshing(false);
    }
  }, [currentUser, systemColorScheme]);

  // Real-time listener for Firestore Profile Picture / Transactions / Loans / Cards
  const formatProfilePicUri = (rawPic: string | null): string | null => {
    if (!rawPic) return null;
    const trimmed = rawPic.trim();
    if (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("file://") ||
      trimmed.startsWith("data:image/")
    ) {
      return trimmed;
    }
    return `data:image/jpeg;base64,${trimmed}`;
  };

  // ==========================================
  // Real-time Firestore Listeners
  // ==========================================
  useEffect(() => {
    if (!currentUser) {
      setIsDataLoading(false);
      return;
    }

    const userPath = `users/${currentUser.uid}`;
    const userDocRef = doc(db, "users", currentUser.uid);

    let loadedProfiles = false;
    let loadedTransactions = false;
    let loadedLoans = false;
    let loadedCards = false;

    const checkAllLoaded = () => {
      if (loadedProfiles && loadedTransactions && loadedLoans && loadedCards) {
        setIsDataLoading(false);

      }
    };

    // 1. Real-time Firestore Listener for User Profile Updates & Settings
    const unsubscribeUserDoc = onSnapshot(
      userDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data();
          if (auth.currentUser?.uid !== currentUser.uid) return;
          cacheUserProfile(currentUser.uid, userData);
          const photoURL = userData?.photoURL || userData?.profilePic;
          if (photoURL) {
            const formattedPic = formatProfilePicUri(photoURL);
            setProfilePic(formattedPic);
          }
          if (userData?.isNotificationEnabled !== undefined) {
            setNotificationsEnabled(userData.isNotificationEnabled);
          } else if (userData?.notificationsEnabled !== undefined) {
            setNotificationsEnabled(userData.notificationsEnabled);
          }
        }
        loadedProfiles = true;

        checkAllLoaded();
      },
      (error) => {

        loadedProfiles = true;
        checkAllLoaded();
      },
    );

    const reload = () => { loadTransactions(); loadLoans(); setSyncError(getSyncState() === "error"); };
    const stopLocal = subscribeFinancialData(reload);
    const stopRemote = watchFinancialData(() => setSyncError(true));
    void syncFromFirestore().then(() => { setIsDataLoading(false); reload(); }).catch(() => { setIsDataLoading(false); setSyncError(true); });
    return () => { unsubscribeUserDoc(); stopLocal(); stopRemote(); };
  }, [currentUser?.uid]);

  const toggleDarkMode = (value: boolean) => {
    setIsDarkMode(value);
    setThemePreference(value ? "dark" : "light");
  };

  const loadTransactions = () => {
    const dbData = fetchTransactionsFromDB();
    setTransactions(dbData);
  };

  const loadLoans = () => {
    const dbData = fetchLoansFromDB();
    setLoans(dbData);
  };

  const formatAmountInput = (value: string) => {
    const hasPesoPrefix = value.includes("₱");
    const cleanedValue = value.replace(/[^0-9.]/g, "");
    const [wholePart = "", decimalPart] = cleanedValue.split(".");
    const formattedWholePart = wholePart
      ? Number(wholePart).toLocaleString("en-US")
      : "";

    const formattedValue =
      decimalPart === undefined
        ? formattedWholePart
        : `${formattedWholePart || "0"}.${decimalPart.slice(0, 2)}`;

    return hasPesoPrefix ? `₱${formattedValue}` : formattedValue;
  };

  const handleAmountChange = (value: string) => {
    setAmount(formatAmountInput(value));
  };

  const handleAmountFocus = () => {
    if (!amount) setAmount("₱");
  };

  const handleSaveTransaction = async () => {
    if (savingRef.current) return;
    if (!name.trim() || !amount.trim() || !category) {
      Alert.alert("Missing Fields", "Please fill out all fields.");
      return;
    }

    const numericAmount = parseFloat(amount.replace(/[₱,]/g, ""));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount.");
      return;
    }

    const today = new Date();
    const formattedDate = localDate(today);
    const formattedTime = today.toTimeString().split(" ")[0].substring(0, 5);

    savingRef.current = true; setIsSavingTransaction(true);
    try {
        const existingTransaction = transactions.find(
          (transaction) => transaction.firestoreId === editingTransactionId,
        );

        const transaction = {
          id: existingTransaction?.id,
          loanId: existingTransaction?.loanId,
          firestoreId: existingTransaction?.firestoreId,
          name,
          amount: numericAmount,
          type,
          category,
          date: existingTransaction?.date ?? formattedDate,
          time: existingTransaction?.time ?? formattedTime,
          userId: currentUser?.uid,
        } as TransactionItem;

        if (editingTransactionId) {
          await updateTransactionInDB(transaction);
        } else {
          await insertTransactionToDB(transaction);
        }
      setName("");
      setAmount("");
      setCategory("");
      setEditingTransactionId(undefined);
      setShowForm(false);
    } catch (error) {

      Alert.alert("Unable to save", error instanceof Error ? error.message : "Failed to save record.");
    } finally { savingRef.current = false; setIsSavingTransaction(false); }
  };

 const openEditTransaction = (transaction: TransactionItem) => {
    if (transaction.confirmedPayment || !["Income", "Expense"].includes(transaction.type)) { Alert.alert("Review required", "This record needs a dedicated reconciliation workflow and cannot be edited here."); return; }
    setEditingTransactionId(transaction.firestoreId);
    setName(transaction.name); setAmount(formatAmountInput(String(transaction.amount)));
    setType(transaction.type as "Income" | "Expense"); setCategory(transaction.category); setShowForm(true);
  };

  const closeTransactionForm = () => {
    setShowForm(false);
    setEditingTransactionId(undefined);
    setName("");
    setAmount("");
    setCategory("");

  };

  const combinedTransactions = mergeLedger(transactions, []) as TransactionItem[];
  const totals = summarize(combinedTransactions);
  const totalIncome = totals.income, totalExpenses = totals.expenses, availableBalance = totals.availableBalance;
  // FIXED: Strictly guard negative balance email dispatch to prevent false triggers when balance >= 0 OR while data is fetching
  useEffect(() => {
    if (isDataLoading) return; // Wait until all remote sources and cards are fully fetched

    if (availableBalance >= 0) {
      emailAlertSentRef.current = false;
      return;
    }

    if (
      availableBalance < 0 &&
      currentUser?.email &&
      notificationsEnabled &&
      !emailAlertSentRef.current
    ) {
      emailAlertSentRef.current = true;
      handleTriggerEmail(availableBalance);
    }
  }, [availableBalance, currentUser, notificationsEnabled, isDataLoading]);

  const points = chartData(combinedTransactions, overviewPeriod);
  const chartLabels = points.map((p) => p.date), chartDisplayLabels = chartLabels;
  const chartDisplayIncomeValues = points.map((p) => p.income), chartDisplayExpenseValues = points.map((p) => p.expense);
  const spendingChartWidth = Math.max(Math.min(width, 720) - 72, points.length * 64);
  const spendingOverviewDescription = "Recorded income and expenses. Card balances excluded.";
  const formatChartLabel = (label: string, period: typeof overviewPeriod = overviewPeriod) => period === "Year" ? label.slice(5, 7) : label.slice(5);
  const balancePoints = chartData(combinedTransactions, balancePeriod);
  const balanceDisplayLabels = balancePoints.map((p) => p.date), balanceDisplayValues = balancePoints.map((p) => p.balance);
  const balanceChartWidth = Math.max(Math.min(width, 720) - 72, balancePoints.length * 64);
  const balanceTrendColor = (balanceDisplayValues.at(-1) ?? 0) >= (balanceDisplayValues[0] ?? 0) ? getDesignTheme(isDarkMode).positive : getDesignTheme(isDarkMode).negative;
  const balanceTrendLabel = "Recorded ledger balance";
  const filteredTransactions = combinedTransactions?.filter((t) => {
    if (search && !`${t.name} ${t.category} ${t.date}`.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (filter === "Income") return t.type === "Income";
    if (filter === "Expense") return t.type === "Expense";
    return true;
  }) ?? [];

  // Keep long labels readable on small phones and with larger accessibility text.
  const categoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = { Food: "restaurant-outline", Shopping: "bag-outline", Transportation: "car-outline", Bills: "receipt-outline", Entertainment: "play-circle-outline", Health: "medkit-outline", Education: "school-outline", Savings: "wallet-outline", Other: "grid-outline", Salary: "briefcase-outline", Allowance: "cash-outline", Freelance: "laptop-outline", Gift: "gift-outline" };
  const categoryColumns = fontScale >= 1.6 ? 1 : fontScale >= 1.2 || width < 350 ? 2 : 3;

  const categories =
    type === "Expense"
      ? [
          "Food",
          "Shopping",
          "Transportation",
          "Bills",
          "Entertainment",
          "Health",
          "Education",
          "Savings",
          "Other",
        ]
      : ["Salary", "Allowance", "Freelance", "Gift", "Savings", "Other"];

  const handleTransactionPress = (transaction: any) => {
    setSelectedTransaction(transaction);
  };

  const handleLoanPress = (loanItem: LoanItem) => {
    setSelectedLoan(loanItem);
  };

  const closeTransactionActions = () => {
    setSelectedTransaction(null);
  };

  const handleDeleteSelectedTransaction = async () => {
    if (!selectedTransaction) return;

    try {
      await deleteTransactionFromDB(undefined, selectedTransaction.firestoreId, selectedTransaction.loanId);
      loadTransactions();

      closeTransactionActions();
    } catch (error) {

      Alert.alert("Error", "Failed to delete record.");
    }
  };

  const styles = createStyles(isDarkMode);
  const colors = getDesignTheme(isDarkMode);
  useEffect(() => {
    if (!compose || mode !== "home") return;
    setEditingTransactionId(undefined); setName(""); setAmount(""); setCategory(""); setType("Expense"); setShowForm(true);
    router.setParams({ compose: undefined });
  }, [compose, mode, router]);

  const selectedSchedule = selectedLoan ? loanSchedule(selectedLoan.firestoreId!, selectedLoan, transactions) : null;
  const confirmPayment = (installment: NonNullable<typeof selectedSchedule>["installments"][number]) => {
    if (!selectedLoan?.firestoreId || confirmingPayment) return;
    const loanId = selectedLoan.firestoreId;
    Alert.alert("Confirm Payment", "Record PHP " + installment.amount.toFixed(2) + " as an expense for installment " + installment.number + "? Confirm only after paying. ExTrack does not transfer money.", [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm Payment", onPress: async () => {
        if (savingRef.current) return;
        savingRef.current = true; setConfirmingPayment(true);
        try { await confirmLoanInstallment(loanId, installment.number); loadTransactions(); }
        catch (error) { Alert.alert("Payment confirmation", error instanceof Error ? error.message : "Payment confirmation failed."); }
        finally { savingRef.current = false; setConfirmingPayment(false); }
      } },
    ]);
  };
  const closeLoanActions = () => {
    setSelectedLoan(null);
  };

  return (
    <View style={[styles.container, { paddingTop: safeInsets.top, paddingLeft: safeInsets.left, paddingRight: safeInsets.right }]}>
      <ScrollView
        style={styles.dashboardContainer}
        contentContainerStyle={styles.dashboardContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDarkMode ? "#ffffff" : "#3b82f6"}
            colors={["#3b82f6"]}
          />
        }
      >
        {/* HEADER */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.subtitle}>{mode === "home" ? "YOUR FINANCIAL PERSPECTIVE" : "EXTRACK"}</Text>
            <Text style={styles.title}>{mode === "home" ? "Overview" : mode === "activity" ? "Activity" : "Insights"}</Text>
            <Text style={styles.subtitle}>{mode === "home" ? "Make room for what matters." : mode === "activity" ? "Your money, one record at a time." : "Understand your recorded cash flow."}</Text>
          </View>

          <TouchableOpacity
            accessibilityRole="button" accessibilityLabel="Open profile"
            style={styles.profileButton}
            onPress={() => router.push("/explore")}
          >
            <Image
              source={
                profilePic
                  ? { uri: profilePic, cache: "force-cache" }
                  : DefaultAvatar
              }
              style={styles.profileAvatar}
            />
          </TouchableOpacity>
        </View>

        {mode !== "activity" && <>
        {/* BALANCE CARD */}
        <Entrance><View style={styles.balanceCard}>
          <BalanceBackdrop />
          <View style={styles.balanceHeaderRow}>
            <View style={styles.balanceTitleContainer}>
              <View><Text style={styles.balanceLabel}>Recorded balance</Text><Text style={{ color: "#BDCAE1", fontSize: 10, letterSpacing: 1, marginTop: 6 }}>ALL-TIME LEDGER / PHP</Text></View>
              <TouchableOpacity
                onPress={() => setHideBalance(!hideBalance)}
                style={styles.eyeButton}
                accessibilityRole="button" accessibilityLabel={hideBalance ? "Show recorded balance" : "Hide recorded balance"}
              >
                <Ionicons
                  name={hideBalance ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color="#B3C6EB"
                />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.balance, availableBalance < 0 && !hideBalance && { color: "#F3979D" }]}>
            {hideBalance
              ? "₱ ****"
              : `₱${availableBalance.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                })}`}
          </Text>

          <View style={styles.statsRow}>
            <View>
              <Text style={styles.statsLabel}>Incoming</Text>
              <Text style={[styles.incomeText, { color: "#5BD1AE" }]}>
                {hideBalance
                  ? "+₱ ****"
                  : `+₱${totalIncome.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`}
              </Text>
            </View>
            <View>
              <Text style={styles.statsLabel}>Outgoing</Text>
              <Text style={[styles.expenseText, { color: "#F3979D" }]}>
                {hideBalance
                  ? "-₱ ****"
                  : `-₱${totalExpenses.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`}
              </Text>
            </View>
          </View>
        </View>

        </Entrance>
        <Text style={styles.emptyText}>Opening balances + recorded income minus expenses. Card balances excluded. Historical or invalid records may require review.</Text>
        {totals.reviewCount > 0 && <Text style={styles.emptyText}>{totals.reviewCount} historical or invalid records are preserved but excluded from totals pending review.</Text>}
        {syncError && <Text style={styles.emptyText}>Cloud sync failed. Local changes are preserved; pull to refresh to retry.</Text>}
        {legacyStatus !== "absent" && <Text style={styles.emptyText}>Previous device records are kept separate. Recovery requires a verified backup and ownership review; no old records are assigned automatically.</Text>}
        </>}
        {mode === "home" && <TouchableOpacity accessibilityRole="button" style={styles.insightLink} onPress={() => router.navigate("/insights")}><Ionicons name="analytics-outline" size={22} color={colors.accent} /><View style={{ flex: 1 }}><Text style={styles.transactionName}>See the bigger picture</Text><Text style={styles.transactionCategory}>Explore income, spending and balance trends</Text></View><Ionicons name="arrow-forward" size={20} color={colors.accent} /></TouchableOpacity>}
        {mode === "insights" && <>
        <LocalInsightsPanel key={currentUser?.uid} owner={currentUser?.uid} entries={transactions} loans={loans} dark={isDarkMode} />
        {combinedTransactions.length === 0 && <Text style={styles.emptyText}>Your story starts with a record. Add income or an expense to see your cash flow. Charts show recorded activity only.</Text>}
        {/* LINE CHART SECTION */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Spending Overview</Text>
        </View>

        <View style={styles.overviewFilterContainer}>
          {overviewPeriods.map((period) => (
            <TouchableOpacity
              key={period}
              style={[
                styles.overviewFilter,
                overviewPeriod === period && styles.overviewFilterActive,
              ]}
              onPress={() => setOverviewPeriod(period)}
            >
              <Text
                style={[
                  styles.filterText,
                  overviewPeriod === period && styles.filterTextActive,
                ]}
              >
                {period}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.chartCard}>
          {chartLabels.length > 0 ? (
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator
              style={styles.chartScroll}
              contentContainerStyle={styles.chartContent}
            >
              <LineChart
                data={{
                  legend: ["Income", "Expenses"],
                  labels: chartDisplayLabels.map((label) =>
                    label === "Start"
                      ? label
                      : formatChartLabel(label, overviewPeriod),
                  ),
                  datasets: [
                    {
                      data: chartDisplayIncomeValues,
                      color: (opacity = 1) => `rgba(21, 155, 115, ${opacity})`,
                    },
                    {
                      data: chartDisplayExpenseValues,
                      color: (opacity = 1) => `rgba(229, 104, 112, ${opacity})`,
                    },
                  ],
                }}
                width={spendingChartWidth}
                height={180}
                fromZero
                chartConfig={{
                  backgroundColor: colors.surface,
                  backgroundGradientFrom: colors.surface,
                  backgroundGradientTo: colors.surface,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(82, 120, 232, ${opacity})`,
                  labelColor: (opacity = 1) =>
                    isDarkMode
                      ? `rgba(148, 163, 184, ${opacity})`
                      : `rgba(100, 116, 139, ${opacity})`,
                  propsForDots: {
                    r: "4",
                    strokeWidth: "2",
                  },
                  style: { borderRadius: 16 },
                }}
                // Straight segments avoid implying values between recorded points.
                style={{ marginVertical: 8, borderRadius: 16 }}
              />
            </ScrollView>
          ) : (
            <Text style={styles.emptyText}>
              Add transactions to render chart
            </Text>
          )}
        </View>

        <Text style={styles.spendingOverviewDescription}>
          {spendingOverviewDescription}
        </Text>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Balance Overview</Text>
        </View>

        <View style={styles.overviewFilterContainer}>
          {overviewPeriods.map((period) => {
            const isActive = balancePeriod === period;

            return (
              <TouchableOpacity
                key={`balance-${period}`}
                style={[
                  styles.overviewFilter,
                  isActive && styles.overviewFilterActive,
                ]}
                onPress={() => setBalancePeriod(period)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterText,
                    isActive && styles.filterTextActive,
                  ]}
                >
                  {period}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.balanceTrendLabel, { color: balanceTrendColor }]}>
          {balanceTrendLabel}
        </Text>

        <View style={styles.chartCard}>
          {balanceDisplayValues.length > 0 ? (
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator
              style={styles.balanceChartScroll}
              contentContainerStyle={styles.balanceChartContent}
            >
              <LineChart
                key={`balance-chart-${balancePeriod}-${balanceDisplayValues.join(",")}`}
                data={{
                  labels: balanceDisplayLabels.map((label) =>
                    label === "Start" ? label : formatChartLabel(label, balancePeriod)
                  ),
                  datasets: [
                    {
                      data: balanceDisplayValues,
                      color: () => balanceTrendColor,
                    },
                  ],
                }}
                width={balanceChartWidth}
                height={180}
                fromZero={false}
                getDotColor={(value) => (value >= 0 ? "#22c55e" : "#ef4444")}
                chartConfig={{
                  backgroundColor: colors.surface,
                  backgroundGradientFrom: colors.surface,
                  backgroundGradientTo: colors.surface,
                  decimalPlaces: 0,
                  color: () => balanceTrendColor,
                  labelColor: (opacity = 1) =>
                    isDarkMode
                      ? `rgba(148, 163, 184, ${opacity})`
                      : `rgba(100, 116, 139, ${opacity})`,
                  propsForDots: { r: "4", strokeWidth: "2" },
                  style: { borderRadius: 16 },
                }}
                bezier
                style={{ marginVertical: 8, borderRadius: 16 }}
              />
            </ScrollView>
          ) : (
            <Text style={styles.emptyText}>
              Add transactions to track balance
            </Text>
          )}
        </View>

        </>}
        {mode !== "insights" && <>
        {/* RECENT TRANSACTIONS CONTAINER */}
        <View style={styles.cardContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{mode === "activity" ? "Transactions" : "Recent activity"}</Text>
          </View>

          <View style={styles.overviewFilterContainer}>
            {["All", "Income", "Expense"].map((f) => {
              const isActive = filter === f;

              return (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.overviewFilter,
                    isActive && styles.overviewFilterActive,
                  ]}
                  onPress={() => setFilter(f)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterText,
                      isActive && styles.filterTextActive,
                    ]}
                  >
                    {f}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {mode === "activity" && <TextInput accessibilityLabel="Search transactions" placeholder="Search name, category or date" placeholderTextColor={colors.secondary} value={search} onChangeText={setSearch} style={styles.input} />}
          {Array.isArray(filteredTransactions) && filteredTransactions.length > 0 ? (
            filteredTransactions.slice(0, mode === "activity" ? 50 : INITIAL_COUNT).map((item) => (
              <TransactionRow key={item.firestoreId} entry={item} dark={isDarkMode}
                onPress={() => handleTransactionPress(item)} />
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{isDataLoading ? "Loading your records..." : "No transactions found. Add a record to get started."}</Text>
            </View>
          )}

          {filteredTransactions.length > (mode === "activity" ? 50 : INITIAL_COUNT) && (
            <TouchableOpacity
              style={styles.seeMoreButton}
              onPress={() => setShowTransactionsModal(true)}
            >
              <Text style={styles.seeMoreText}>See More</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ACTIVE LOANS CONTAINER */}
        {loans && loans.length > 0 && (
          <View style={styles.cardContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Loans</Text>
            </View>

            {loans.slice(0, INITIAL_COUNT).map((item, index) => (
              <LoanCard key={item.firestoreId ?? item.id ?? index} loan={item} transactions={transactions} dark={isDarkMode} onPress={() => handleLoanPress(item)} />
            ))}

            {loans.length > INITIAL_COUNT && (
              <TouchableOpacity
                style={styles.seeMoreButton}
                onPress={() => setShowLoansModal(true)}
              >
                <Text style={styles.seeMoreText}>See More</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        </>}
        {/* ALL TRANSACTIONS MODAL */}
        <Modal
          visible={showTransactionsModal}
          animationType={reducedMotion ? "none" : "slide"}
          transparent={false}
          onRequestClose={() => setShowTransactionsModal(false)}
        >
          <SafeAreaView edges={[]} style={styles.fullModalContainer}>
            <View style={styles.fullModalHeader}>
              <Text style={styles.fullModalTitle}>All Transactions</Text>
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setShowTransactionsModal(false)}
              >
                <Text style={styles.closeModalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>

            <FlatList data={filteredTransactions} keyExtractor={(item) => item.firestoreId!} showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalListContent}
              renderItem={({ item }) => <TransactionRow entry={item} dark={isDarkMode}
                onPress={() => { setShowTransactionsModal(false); handleTransactionPress(item); }} />} />
          </SafeAreaView>
        </Modal>

        {/* ALL LOANS MODAL */}
        <Modal
          visible={showLoansModal}
          animationType={reducedMotion ? "none" : "slide"}
          transparent={false}
          onRequestClose={() => setShowLoansModal(false)}
        >
          <SafeAreaView edges={[]} style={styles.fullModalContainer}>
            <View style={styles.fullModalHeader}>
              <Text style={styles.fullModalTitle}>All Active Loans</Text>
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setShowLoansModal(false)}
              >
                <Text style={styles.closeModalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>

            <FlatList data={loans} keyExtractor={(item, index) => item.firestoreId ?? String(item.id ?? index)} contentContainerStyle={styles.modalListContent}
              renderItem={({ item }) => <LoanCard loan={item} transactions={transactions} dark={isDarkMode} onPress={() => { setShowLoansModal(false); handleLoanPress(item); }} />} />
          </SafeAreaView>
        </Modal>

        {/* LOAN ACTIONS MODAL */}
        <Modal
          visible={selectedLoan !== null}
          animationType={reducedMotion ? "none" : "fade"}
          transparent
          onRequestClose={closeLoanActions}
        >
          <View style={styles.actionModalOverlay}>
            <View style={styles.actionModalContent}>
              <Text style={styles.actionModalTitle}>{selectedLoan?.title}</Text>
              <Text style={styles.actionModalSubtitle}>
                Total Amount • ₱
                {(selectedLoan?.totalAmount ?? 0).toLocaleString()}
              </Text>

              <ScrollView style={{ maxHeight: 300 }}>
 {!selectedSchedule ? <Text style={styles.emptyText}>Legacy loan: review original amounts before enabling payments.</Text> : <>
 <Text style={styles.emptyText}>Principal: PHP {((selectedLoan?.principalCentavos || 0) / 100).toFixed(2)}. Scheduled: PHP {(selectedSchedule.totalScheduledCentavos / 100).toFixed(2)}. Paid: PHP {(selectedSchedule.confirmedPaymentCentavos / 100).toFixed(2)}. Remaining: PHP {(selectedSchedule.remainingCentavos / 100).toFixed(2)}.</Text>
 {selectedSchedule.installments.map((installment) => <View key={installment.installmentId} style={{ marginVertical: 8 }}>
 <Text style={styles.emptyText}>{installment.number}. {installment.dueDate} ? PHP {installment.amount.toFixed(2)} ? {installment.status}</Text>
 {installment.status !== "Paid" && <TouchableOpacity style={styles.actionModalEditButton} disabled={confirmingPayment} onPress={() => confirmPayment(installment)}><Text style={styles.actionModalEditText}>Confirm Payment</Text></TouchableOpacity>}
 </View>)} </>}
 </ScrollView>

              <TouchableOpacity
                style={styles.actionModalCancelButton}
                onPress={closeLoanActions}
              >
                <Text style={styles.actionModalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>

      <Modal
        visible={selectedTransaction !== null}
        animationType={reducedMotion ? "none" : "fade"}
        transparent
        onRequestClose={closeTransactionActions}
      >
        <View style={styles.actionModalOverlay}>
          <View style={styles.actionModalContent}>
            <Text style={styles.actionModalTitle}>
              {selectedTransaction?.name}
            </Text>
            <Text style={styles.actionModalSubtitle}>
              {selectedTransaction?.type} • ₱
              {selectedTransaction?.amount.toLocaleString()}
            </Text>

            <TouchableOpacity
              style={styles.actionModalEditButton}
              onPress={() => {
                if (selectedTransaction)
                  openEditTransaction(selectedTransaction);
                closeTransactionActions();
              }}
            >
              <Text style={styles.actionModalEditText}>Edit transaction</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionModalDeleteButton}
              onPress={() => Alert.alert("Delete transaction?", "This removes the selected record from your active ledger. This action affects recorded totals.", [{ text: "Keep record", style: "cancel" }, { text: "Delete", style: "destructive", onPress: handleDeleteSelectedTransaction }])}
            >
              <Text style={styles.actionModalDeleteText}>
                Delete transaction
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionModalCancelButton}
              onPress={closeTransactionActions}
            >
              <Text style={styles.actionModalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Phone-first transaction sheet: header and actions stay outside the scroll area. */}
      <Modal visible={showForm} animationType={reducedMotion ? "none" : "slide"} transparent
        statusBarTranslucent onRequestClose={() => { if (!isSavingTransaction) closeTransactionForm(); }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={[styles.composerOverlay, { paddingTop: 12, paddingBottom: 12 }]}>
            <View style={styles.composerSheet} accessibilityViewIsModal>
              <View style={styles.composerHandle} />
              <View style={styles.composerHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.composerEyebrow}>{editingTransactionId ? "EDIT TRANSACTION" : "NEW TRANSACTION"}</Text>
                  <Text accessibilityRole="header" style={styles.composerTitle}>{editingTransactionId ? "Edit transaction" : "Add transaction"}</Text>
                  <Text style={styles.composerSubtitle}>Keep your finances in focus.</Text>
                </View>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close transaction form"
                  disabled={isSavingTransaction} onPress={closeTransactionForm} style={styles.composerClose}>
                  <Ionicons name="close" size={22} color={colors.secondary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.composerScroll} contentContainerStyle={styles.composerBody}
                showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
                <View style={styles.composerSegment}>
                  {(["Expense", "Income"] as const).map(option => (
                    <TouchableOpacity key={option} accessibilityRole="button" accessibilityState={{ selected: type === option }}
                      style={[styles.composerSegmentButton, type === option && styles.composerSegmentSelected]}
                      onPress={() => setType(option)}>
                      <Text style={[styles.composerSegmentText, type === option && styles.composerCategoryTextSelected]}>{option}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.composerLabel}>Amount</Text>
                <View style={styles.composerAmountFrame}>
                  <Text style={styles.composerCurrency}>PHP</Text>
                  <TextInput accessibilityLabel="Transaction amount in Philippine pesos" style={styles.composerAmount}
                    placeholder="0.00" placeholderTextColor={colors.secondary} keyboardType="decimal-pad" returnKeyType="done"
                    value={amount} onFocus={handleAmountFocus} onChangeText={handleAmountChange} onSubmitEditing={Keyboard.dismiss} />
                </View>
                <Text style={styles.composerLabel}>Description</Text>
                <TextInput accessibilityLabel="Transaction title" style={styles.composerInput} placeholder="e.g. Groceries or monthly salary"
                  placeholderTextColor={colors.secondary} value={name} onChangeText={setName} returnKeyType="done" onSubmitEditing={Keyboard.dismiss} />
                <View style={styles.composerCategoryHeader}>
                  <Text style={styles.composerCategoryTitle}>Category</Text>
                  <Text style={styles.composerCategoryHint}>Choose one</Text>
                </View>
                <View accessibilityRole="radiogroup" accessibilityLabel="Transaction category" style={styles.composerCategories}>
                  {Array.from({ length: Math.ceil(categories.length / categoryColumns) }, (_, row) => (
                    <View key={row} style={styles.composerCategoryRow}>
                      {categories.slice(row * categoryColumns, (row + 1) * categoryColumns).map(cat => (
                        <TouchableOpacity key={cat} accessibilityRole="radio" accessibilityLabel={cat}
                          accessibilityState={{ checked: category === cat, disabled: isSavingTransaction }}
                          disabled={isSavingTransaction} activeOpacity={0.7}
                          style={[styles.composerChip, category === cat && styles.composerChipSelected]}
                          onPress={() => setCategory(cat)}>
                          <Ionicons name={categoryIcons[cat] ?? "grid-outline"} size={18} color={category === cat ? colors.accent : colors.secondary} />
                          <Text style={[styles.composerCategoryText, category === cat && styles.composerCategoryTextSelected]}>{cat}</Text>
                        </TouchableOpacity>
                      ))}
                      {Array.from({ length: Math.max(0, categoryColumns - categories.slice(row * categoryColumns, (row + 1) * categoryColumns).length) }, (_, index) => <View key={`empty-${index}`} style={{ flex: 1 }} />)}
                    </View>
                  ))}
                </View>
              </ScrollView>
              <View style={styles.composerFooter}>
                <TouchableOpacity accessibilityRole="button" disabled={isSavingTransaction} onPress={closeTransactionForm}
                  style={[styles.composerCancel, isSavingTransaction && { opacity: 0.5 }]}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" accessibilityState={{ busy: isSavingTransaction, disabled: isSavingTransaction }}
                  onPress={handleSaveTransaction} disabled={isSavingTransaction} style={[styles.composerSave, isSavingTransaction && { opacity: 0.6 }]}>
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>{isSavingTransaction ? "Saving..." : editingTransactionId ? "Save changes" : "Save Transaction"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
