import DefaultAvatar from "@/assets/images/default-avatar.png";
import { auth, db } from "@/config/firebase";
import { useFocusEffect, useRouter } from "expo-router";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  deleteTransactionFromDB,
  fetchTransactionsFromDB,
  LoanItem,
  fetchLoansFromDB,
  getThemePreference,
  getUserProfilePicture,
  initDatabase,
  insertTransactionToDB,
  setThemePreference,
  setUserProfilePicture, // <--- Change this
  TransactionItem,
  updateTransactionInDB,
  deleteLoanFromDB, 
} from "../../database";

interface GraphDataItem {
  date: string;
  income: number;
  expense: number;
}

const { width, height } = Dimensions.get("window");

export default function HomeScreen() {

  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [showLoansModal, setShowLoansModal] = useState(false);
  const INITIAL_COUNT = 3;
  
  const router = useRouter();
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState<boolean>(
    systemColorScheme === "dark",
  );

  const [profilePic, setProfilePic] = useState<string | null>(null);
  const currentUser = auth.currentUser;

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<
    number | undefined
  >();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"Income" | "Expense">("Expense");
  const [category, setCategory] = useState("");

 // View States
const [filter, setFilter] = useState("All");
const [overviewPeriod, setOverviewPeriod] = useState<
  "Day" | "Week" | "Month" | "Year"
>("Month");
const [balancePeriod, setBalancePeriod] =
  useState<typeof overviewPeriod>("Month");
const [transactions, setTransactions] = useState<TransactionItem[]>([]);
// 1. Updated state type to LoanItem[] and standard camelCase naming
const [loans, setLoanList] = useState<LoanItem[]>([]);
const [selectedLoan, setSelectedLoan] = useState<LoanItem | null>(null);
const [loan, setLoans] = useState<LoanItem[]>([]);
const [selectedLoans, setSelectedLoans] = useState<LoanItem | null>(null);

const [selectedTransaction, setSelectedTransaction] =
  useState<TransactionItem | null>(null);

const overviewPeriods: Array<typeof overviewPeriod> = [
  "Day",
  "Week",
  "Month",
  "Year",
];

useEffect(() => {
  initDatabase();
  loadTransactions();
  loadLoans(); // 2. Call loadLoans on component mount

  if (currentUser) {
    processAutomaticLoanPayments();
  }
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

    // Load loans on focus (loadTransactions removed to prevent overwrite of Firestore real-time listener)
    loadLoans();
  }, [systemColorScheme])
);

// Real-time listener for Firestore Profile Picture / Transactions / Loans
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
  if (!currentUser) return;

  const userPath = `users/${currentUser.uid}`;
  const userDocRef = doc(db, "users", currentUser.uid);

  // 1. Real-time Firestore Listener for User Profile Updates
  const unsubscribeUserDoc = onSnapshot(
    userDocRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        const photoURL = userData?.photoURL || userData?.profilePic;
        if (photoURL) {
          const formattedPic = formatProfilePicUri(photoURL);
          setProfilePic(formattedPic);
        }
      }
    },
    (error) => {
      console.error("Error listening to user profile:", error);
    }
  );

  // 2. Real-time Listener for Transactions
  const transactionsRef = collection(db, userPath, "transactions");
const unsubscribeTransactions = onSnapshot(
  transactionsRef,
  (snapshot) => {
    const remoteData: TransactionItem[] = snapshot.docs.map((docItem) => {
      const data = docItem.data();
      return {
        id: data.id,
        firestoreId: docItem.id,
        name: data.name || "",
        amount: Number(data.amount) || 0,
        type: data.type || "",
        category: data.category || "",
        date: data.date || "",
        time: data.time || "",
        userId: currentUser.uid,
      };
    });

    remoteData.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time || "00:00"}`).getTime();
      const dateB = new Date(`${b.date}T${b.time || "00:00"}`).getTime();
      return dateB - dateA;
    });

    // Update React state directly with remote data
    setTransactions(remoteData);
  },
  (error) => {
    console.error("Error listening to transactions:", error);
  }
);

  // 3. Real-time Listener for Loans
  const loansRef = collection(db, userPath, "loans");
  const unsubscribeLoans = onSnapshot(
    loansRef,
    (snapshot) => {
      const remoteLoans: LoanItem[] = snapshot.docs.map((docItem) => {
        const data = docItem.data();
        return {
          id: data.id,
          firestoreId: docItem.id,
          title: data.title || "",
          totalAmount: Number(data.totalAmount) || 0,
          monthlyPayment: Number(data.monthlyPayment) || 0,
          annualExpense: Number(data.annualExpense) || 0,
          durationMonths: Number(data.durationMonths) || 0,
          startDate: data.startDate || "",
          endDate: data.endDate || "",
          createdAt: data.createdAt || "",
        };
      });

      setLoanList(remoteLoans);
    },
    (error) => {
      console.error("Error listening to loans:", error);
    }
  );

  return () => {
    unsubscribeUserDoc();
    unsubscribeTransactions();
    unsubscribeLoans();
  };
}, [currentUser]);

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
  const formattedDate = today.toISOString().split("T")[0];
  const formattedTime = today.toTimeString().split(" ")[0].substring(0, 5);
  const existingTransaction = transactions.find(
    (transaction) => transaction.id === editingTransactionId
  );

  const transaction = {
    id: editingTransactionId,
    firestoreId: existingTransaction?.firestoreId, // Pass the Firestore Document ID
    name,
    amount: numericAmount,
    type,
    category,
    date: existingTransaction?.date ?? formattedDate,
    time: existingTransaction?.time ?? formattedTime,
    userId: currentUser?.uid,
  } as TransactionItem;

  try {
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
    console.error("Error saving transaction:", error);
    Alert.alert("Error", "Failed to save transaction.");
  }
};

    const openEditTransaction = (transaction: TransactionItem) => {
    setEditingTransactionId(transaction.id ? Number(transaction.id) : undefined);
    setName(transaction.name);
    setAmount(formatAmountInput(`₱${transaction.amount}`));
    setType(transaction.type as "Income" | "Expense");
    setCategory(transaction.category);
    setShowForm(true);
  };

  const closeTransactionForm = () => {
    setShowForm(false);
    setEditingTransactionId(undefined);
    setName("");
    setAmount("");
    setCategory("");
  };

  // Calculations
  const totalIncome = transactions
    .filter((t) => t.type === "Income")
    .reduce((total, t) => total + t.amount, 0);

  const totalExpenses = Number(
  transactions
    .filter((t) => t.type === "Expense")
    .reduce((total, t) => total + t.amount, 0)
    .toFixed(2)
);

const availableBalance = Number((totalIncome - totalExpenses).toFixed(2));

  // Chart Data Processing
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overviewStartDate = new Date(today);
  if (overviewPeriod === "Week") overviewStartDate.setDate(today.getDate() - 6);
  if (overviewPeriod === "Month") overviewStartDate.setDate(1);
  if (overviewPeriod === "Year") overviewStartDate.setMonth(0, 1);

  const overviewTransactions = transactions.filter((transaction) => {
    const [year, month, day] = transaction.date.split("-").map(Number);
    const transactionDate = new Date(year, month - 1, day);
    transactionDate.setHours(0, 0, 0, 0);
    return transactionDate >= overviewStartDate && transactionDate <= today;
  });

  const graphDataMap: Record<string, GraphDataItem> = {};
  overviewTransactions.forEach((t) => {
    const key = overviewPeriod === "Year" ? t.date.slice(0, 7) : t.date;
    if (!graphDataMap[key]) {
      graphDataMap[key] = { date: key, income: 0, expense: 0 };
    }
    if (t.type === "Income") {
      graphDataMap[key].income += t.amount;
    } else {
      graphDataMap[key].expense += t.amount;
    }
  });

  const maxChartPoints = overviewPeriod === "Year" ? 12 : 7;
  const chartLabels = Object.keys(graphDataMap).sort().slice(-maxChartPoints);
  const chartIncomeValues = chartLabels.map(
    (key) => graphDataMap[key]?.income || 0,
  );
  const chartExpenseValues = chartLabels.map(
    (key) => graphDataMap[key]?.expense || 0,
  );
  const chartDisplayLabels =
    chartLabels.length === 1 ? ["Start", chartLabels[0]] : chartLabels;
  const chartDisplayIncomeValues =
    chartLabels.length === 1 ? [0, chartIncomeValues[0]] : chartIncomeValues;
  const chartDisplayExpenseValues =
    chartLabels.length === 1 ? [0, chartExpenseValues[0]] : chartExpenseValues;
  const spendingChartWidth = Math.max(
    width - 72,
    chartDisplayLabels.length * 84,
  );
  const overviewIncomeTotal = overviewTransactions.reduce(
    (total, transaction) =>
      total + (transaction.type === "Income" ? transaction.amount : 0),
    0,
  );
  const overviewExpenseTotal = overviewTransactions.reduce(
    (total, transaction) =>
      total + (transaction.type === "Expense" ? transaction.amount : 0),
    0,
  );
  const spendingOverviewDescription =
    overviewTransactions.length === 0
      ? "No income or expense data for this period"
      : overviewExpenseTotal > overviewIncomeTotal
        ? "You have more expenses than income"
        : overviewIncomeTotal > overviewExpenseTotal
          ? "You have more income than expenses"
          : "Your income and expenses are equal";
  const formatChartLabel = (
    label: string,
    period: typeof overviewPeriod = overviewPeriod,
  ) => {
    if (period === "Year") {
      const [year, month] = label.split("-").map(Number);
      return new Date(year, month - 1, 1).toLocaleString("en-US", {
        month: "short",
      });
    }
    return label.slice(5);
  };

  const balanceToday = new Date();
  balanceToday.setHours(0, 0, 0, 0);
  const balanceStartDate = new Date(balanceToday);
  if (balancePeriod === "Week")
    balanceStartDate.setDate(balanceToday.getDate() - 6);
  if (balancePeriod === "Month") balanceStartDate.setDate(1);
  if (balancePeriod === "Year") balanceStartDate.setMonth(0, 1);

      const balanceTransactions = [...transactions].sort((first, second) => {
      const firstDate = `${first.date} ${first.time}`;
      const secondDate = `${second.date} ${second.time}`;
      
      const dateComparison = firstDate.localeCompare(secondDate);
      if (dateComparison !== 0) return dateComparison;

      const firstId = Number(first.id) || 0;
      const secondId = Number(second.id) || 0;
      return firstId - secondId;
    });
  const startingBalance = balanceTransactions
    .filter((transaction) => {
      const [year, month, day] = transaction.date.split("-").map(Number);
      return new Date(year, month - 1, day) < balanceStartDate;
    })
    .reduce(
      (balance, transaction) =>
        balance +
        (transaction.type === "Income"
          ? transaction.amount
          : -transaction.amount),
      0,
    );
  let runningBalance = startingBalance;
  const balanceGraphPoints: Array<{ label: string; value: number }> = [];
  balanceTransactions.forEach((transaction) => {
    const [year, month, day] = transaction.date.split("-").map(Number);
    const transactionDate = new Date(year, month - 1, day);
    if (transactionDate < balanceStartDate || transactionDate > balanceToday)
      return;

    runningBalance +=
      transaction.type === "Income" ? transaction.amount : -transaction.amount;
    balanceGraphPoints.push({ label: transaction.date, value: runningBalance });
  });
  const maxBalancePoints = balancePeriod === "Year" ? 12 : 7;
  const visibleBalancePoints = balanceGraphPoints.slice(-maxBalancePoints);
  const balanceLabels = visibleBalancePoints.map((point) => point.label);
  const balanceValues = visibleBalancePoints.map((point) => point.value);
  const balanceDisplayLabels =
    balanceLabels.length === 1 ? ["Start", balanceLabels[0]] : balanceLabels;
  const balanceDisplayValues =
    balanceLabels.length === 1
      ? [startingBalance, balanceValues[0]]
      : balanceValues;
  const balanceChartWidth = Math.max(
    width - 72,
    balanceDisplayValues.length * 84,
  );
  const balanceTrendColor =
    (balanceDisplayValues.at(-1) ?? 0) >= (balanceDisplayValues[0] ?? 0)
      ? "#22c55e"
      : "#ef4444";
  const balanceTrendLabel =
    (balanceDisplayValues.at(-1) ?? 0) >= (balanceDisplayValues[0] ?? 0)
      ? "Balance increasing"
      : "Balance decreasing";

  const filteredTransactions = transactions.filter((t) => {
    if (filter === "Income") return t.type === "Income";
    if (filter === "Expense") return t.type === "Expense";
    return true;
  });

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
          "Other",
        ]
      : ["Salary", "Allowance", "Freelance", "Gift", "Other"];

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "Food":
        return "🍔";
      case "Shopping":
        return "🛒";
      case "Transportation":
        return "🚌";
      case "Bills":
        return "💡";
      case "Entertainment":
        return "🎮";
      case "Health":
        return "💊";
      case "Education":
        return "📚";
      case "Salary":
        return "💰";
      case "Allowance":
        return "💵";
      case "Freelance":
        return "💻";
      case "Gift":
        return "🎁";
      default:
        return "💳";
    }
  };

  const handleTransactionPress = (transaction: TransactionItem) => {
    setSelectedTransaction(transaction);
  };

const handleLoanPress = (loanItem: LoanItem) => {
  setSelectedLoan(loanItem);
};


  const closeTransactionActions = () => {
    setSelectedTransaction(null);
  };

 const handleDeleteSelectedTransaction = async () => {
  if (!selectedTransaction?.id) return;

  try {
    // Pass local id, Firestore transaction document ID, and loanId
    await deleteTransactionFromDB(
      selectedTransaction.id,
      selectedTransaction.firestoreId,
      selectedTransaction.loanId
    );

    // Update local React state to reflect immediate deletion
    setTransactions((current) =>
      current.filter((t) => t.id !== selectedTransaction.id)
    );

    closeTransactionActions();
  } catch (error) {
    console.error("Failed to delete transaction:", error);
    Alert.alert("Error", "Failed to delete transaction from all records.");
  }
};

  // Draggable FAB with Gesture Distance Check
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const isDragging = useRef(false);
  const fabPosition = useRef({ x: 0, y: 0 });
  const dragStartPosition = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
      },
      onPanResponderGrant: () => {
        isDragging.current = false;
        pan.extractOffset();
        dragStartPosition.current = { ...fabPosition.current };
      },
      onPanResponderMove: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5) {
          isDragging.current = true;
        }
        fabPosition.current = {
          x: dragStartPosition.current.x + gestureState.dx,
          y: dragStartPosition.current.y + gestureState.dy,
        };
        Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        })(_, gestureState);
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();
        const maxHorizontalOffset = width - 76;
        const maxVerticalOffset = height - 86;
        const boundedPosition = {
          x: Math.max(-maxHorizontalOffset, Math.min(0, fabPosition.current.x)),
          y: Math.max(-maxVerticalOffset, Math.min(0, fabPosition.current.y)),
        };
        fabPosition.current = boundedPosition;
        Animated.spring(pan, {
          toValue: boundedPosition,
          useNativeDriver: false,
          tension: 70,
          friction: 10,
        }).start();
        if (!isDragging.current) {
          setShowForm(true);
        }
      },
    }),
  ).current;

  const styles = createStyles(isDarkMode);

  const processAutomaticLoanPayments = async () => {
  if (!currentUser) return;

  try {
    const loansRef = collection(
      db,
      "users",
      currentUser.uid,
      "loans"
    );

    const loansSnapshot = await getDocs(loansRef);

    const transactionsRef = collection(
      db,
      "users",
      currentUser.uid,
      "transactions"
    );

    const now = new Date();

    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDay = now.getDate();

    const todayString = [
      todayYear,
      String(todayMonth + 1).padStart(2, "0"),
      String(todayDay).padStart(2, "0"),
    ].join("-");

    console.log(`Checking loans for ${todayString}`);

    for (const loanDoc of loansSnapshot.docs) {
      const loan = loanDoc.data();

      const monthlyPayment = Number(loan.monthlyPayment);
      const durationMonths = Number(loan.durationMonths);

      if (
        !loan.startDate ||
        !monthlyPayment ||
        monthlyPayment <= 0 ||
        !durationMonths ||
        durationMonths <= 0
      ) {
        continue;
      }

      const startDate = new Date(loan.startDate);

      if (isNaN(startDate.getTime())) {
        console.log(`Invalid start date for loan ${loanDoc.id}`);
        continue;
      }

      const loanStartYear = startDate.getFullYear();
      const loanStartMonth = startDate.getMonth();
      const paymentDay = startDate.getDate();

      /*
       * IMPORTANT:
       * Only create a payment when TODAY is the payment day.
       *
       * Example:
       * Loan date = September 4
       *
       * September 4  -> payment
       * September 5  -> nothing
       * September 20 -> nothing
       * October 4     -> payment
       * November 4    -> payment
       */

      if (todayDay !== paymentDay) {
        continue;
      }

      // Calculate which month/payment this is
      const monthsSinceStart =
        (todayYear - loanStartYear) * 12 +
        (todayMonth - loanStartMonth);

      const paymentNumber = monthsSinceStart + 1;

      // Loan hasn't started yet
      if (paymentNumber <= 0) {
        continue;
      }

      // Loan is already finished
      if (paymentNumber > durationMonths) {
        console.log(
          `${loan.title}: All loan payments completed.`
        );
        continue;
      }

      /*
       * CHECK IF THIS MONTH'S PAYMENT ALREADY EXISTS
       */
      const paymentQuery = query(
        transactionsRef,
        where("loanId", "==", loanDoc.id),
        where("loanPaymentDate", "==", todayString)
      );

      const existingPaymentSnapshot =
        await getDocs(paymentQuery);

      // Prevent duplicate payment
      if (!existingPaymentSnapshot.empty) {
        console.log(
          `${loan.title}: Payment #${paymentNumber} already recorded.`
        );
        continue;
      }

      /*
       * CREATE ONLY ONE PAYMENT
       */
      const transactionRef = doc(transactionsRef);

      await setDoc(transactionRef, {
        id: Date.now(),
        name: `${loan.title} Loan Payment`,
        amount: monthlyPayment,
        type: "Expense",
        category: "Bills",
        date: todayString,
        time: now.toTimeString().slice(0, 5),

        // Loan information
        loanId: loanDoc.id,
        loanPaymentDate: todayString,
        loanPaymentNumber: paymentNumber,

        // Mark as automatic
        automatic: true,

        createdAt: new Date().toISOString(),
      });

      console.log(
        `Created payment #${paymentNumber} for ${loan.title}: ₱${monthlyPayment}`
      );
    }

    console.log("Loan payment check completed.");
  } catch (error) {
    console.error(
      "Error processing automatic loan payments:",
      error
    );
  }
};

const closeLoanActions = () => {
  setSelectedLoan(null);
};

const handleDeleteSelectedLoan = async () => {
  if (!selectedLoan) return;

  const numericId = selectedLoan.id ? Number(selectedLoan.id) : undefined;
  const firestoreId = selectedLoan.firestoreId;

  // 1. Check if at least ONE valid identifier exists
  const hasValidNumericId = numericId !== undefined && !isNaN(numericId) && numericId > 0;
  const hasValidFirestoreId = Boolean(firestoreId);

  if (!hasValidNumericId && !hasValidFirestoreId) {
    Alert.alert("Error", "Invalid Loan ID. Cannot delete this record.");
    console.error("Delete failed: No valid loan ID provided ->", selectedLoan);
    return;
  }

  // 2. Prompt confirmation and execute deletion
  Alert.alert(
    "Delete Loan",
    "Are you sure you want to delete this active loan?",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            // Call updated database function passing both potential keys
            await deleteLoanFromDB(numericId, firestoreId);

            // Update UI local state immediately
            setLoans((current: LoanItem[]) =>
              current.filter((l: LoanItem) => {
                if (firestoreId && l.firestoreId === firestoreId) return false;
                if (numericId && l.id === numericId) return false;
                return true;
              })
            );

            closeLoanActions();
          } catch (error) {
            console.error("Failed to delete loan:", error);
            Alert.alert("Error", "Failed to delete loan from records.");
          }
        },
      },
    ]
  );
};

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.dashboardContainer}
        contentContainerStyle={styles.dashboardContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>ExTrack</Text>
            <Text style={styles.subtitle}>Personal Finance Tracker</Text>
          </View>

          {/* TouchableOpacity pointing to index.tsx */}
          <TouchableOpacity
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

        {/* BALANCE CARD */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text
            style={[
              styles.balance,
              availableBalance < 0 && { color: "#ef4444" },
            ]}
          >
            ₱
            {availableBalance.toLocaleString("en-PH", {
              minimumFractionDigits: 2,
            })}
          </Text>
          <View style={styles.statsRow}>
            <View>
              <Text style={styles.statsLabel}>Incoming</Text>
              <Text style={styles.incomeText}>
                +₱{totalIncome.toLocaleString()}
              </Text>
            </View>
            <View>
              <Text style={styles.statsLabel}>Outgoing</Text>
              <Text style={styles.expenseText}>
                -₱{totalExpenses.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

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
                  labels: chartDisplayLabels.map((label) =>
                    label === "Start"
                      ? label
                      : formatChartLabel(label, overviewPeriod),
                  ),
                  datasets: [
                    {
                      data: chartDisplayIncomeValues,
                      color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
                    },
                    {
                      data: chartDisplayExpenseValues,
                      color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
                    },
                  ],
                }}
                width={spendingChartWidth}
                height={180}
                fromZero
                chartConfig={{
                  backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
                  backgroundGradientFrom: isDarkMode ? "#1e293b" : "#ffffff",
                  backgroundGradientTo: isDarkMode ? "#1e293b" : "#ffffff",
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
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
                bezier
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
          Description: {spendingOverviewDescription}
        </Text>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Balance Overview</Text>
        </View>

        <View style={styles.overviewFilterContainer}>
          {overviewPeriods.map((period) => (
            <TouchableOpacity
              key={`balance-${period}`}
              style={[
                styles.overviewFilter,
                balancePeriod === period && styles.overviewFilterActive,
              ]}
              onPress={() => setBalancePeriod(period)}
            >
              <Text
                style={[
                  styles.filterText,
                  balancePeriod === period && styles.filterTextActive,
                ]}
              >
                {period}
              </Text>
            </TouchableOpacity>
          ))}
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
                    label === "Start"
                      ? label
                      : formatChartLabel(label, balancePeriod),
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
                  backgroundColor: isDarkMode ? "#1e293b" : "#ffffff",
                  backgroundGradientFrom: isDarkMode ? "#1e293b" : "#ffffff",
                  backgroundGradientTo: isDarkMode ? "#1e293b" : "#ffffff",
                  decimalPlaces: 0,
                  color: (opacity = 1) =>
                    `${balanceTrendColor}${opacity === 1 ? "" : ""}`,
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

        {/* RECENT TRANSACTIONS CONTAINER */}
<View style={styles.cardContainer}>
  {/* RECENT TRANSACTIONS HEADER */}
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>Recent Transactions</Text>
  </View>

  {/* FILTERS */}
  <View style={styles.filterContainer}>
    {["All", "Income", "Expense"].map((f) => (
      <TouchableOpacity
        key={f}
        style={[
          styles.filterChip,
          filter === f && styles.filterChipActive,
        ]}
        onPress={() => setFilter(f)}
      >
        <Text
          style={[
            styles.filterText,
            filter === f && styles.filterTextActive,
          ]}
        >
          {f}
        </Text>
      </TouchableOpacity>
    ))}
  </View>

  {/* LIST TRANSACTIONS */}
  {filteredTransactions.length > 0 ? (
    filteredTransactions.slice(0, INITIAL_COUNT).map((item) => (
      <TouchableOpacity
        key={item.id}
        style={styles.transactionCard}
        onPress={() => handleTransactionPress(item)}
        activeOpacity={0.75}
        accessibilityLabel={`Open actions for ${item.name}`}
      >
        <View style={styles.transactionLeft}>
          <Text style={styles.transactionIcon}>
            {getCategoryIcon(item.category)}
          </Text>
          <View>
            <Text style={styles.transactionName}>{item.name}</Text>
            <Text style={styles.transactionCategory}>
              {item.category} • {item.date}
            </Text>
          </View>
        </View>
        <View style={styles.transactionRight}>
          <Text
            style={
              item.type === "Income"
                ? styles.incomeText
                : styles.expenseText
            }
          >
            {item.type === "Income" ? "+" : "-"}₱
            {item.amount.toLocaleString()}
          </Text>
        </View>
      </TouchableOpacity>
    ))
  ) : (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No Transactions Found.</Text>
    </View>
  )}

  {/* SEE MORE BUTTON (OPENS TRANSACTIONS MODAL) */}
  {filteredTransactions.length > INITIAL_COUNT && (
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
      <TouchableOpacity
        key={item.id || item.firestoreId || `loan-${index}`}
        style={styles.transactionCard}
        onPress={() => handleLoanPress(item)}
        activeOpacity={0.75}
        accessibilityLabel={`Open actions for ${item.title}`}
      >
        <View style={styles.transactionLeft}>
          <Text style={styles.transactionIcon}>🏦</Text>
          <View>
            <Text style={styles.transactionName}>
              {item.title} •{" "}
              {item.startDate ? item.startDate.split("T")[0] : ""}
            </Text>
            <Text style={styles.transactionCategory}>
              Monthly: ₱{(item.monthlyPayment ?? 0).toLocaleString()}
            </Text>
          </View>
        </View>
        <View style={styles.transactionRight}>
          <Text style={styles.LoanexpenseText}>
            ₱{(item.totalAmount ?? 0).toLocaleString()}
          </Text>
        </View>
      </TouchableOpacity>
    ))}

    {/* SEE MORE BUTTON (OPENS LOANS MODAL) */}
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

{/* ALL TRANSACTIONS SCROLLABLE MODAL FORM */}
<Modal
  visible={showTransactionsModal}
  animationType="slide"
  transparent={false}
  onRequestClose={() => setShowTransactionsModal(false)}
>
  <View style={styles.fullModalContainer}>
    <View style={styles.fullModalHeader}>
      <Text style={styles.fullModalTitle}>All Transactions</Text>
      <TouchableOpacity
        style={styles.closeModalButton}
        onPress={() => setShowTransactionsModal(false)}
      >
        <Text style={styles.closeModalButtonText}>Close</Text>
      </TouchableOpacity>
    </View>

    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.modalListContent}
    >
      {filteredTransactions.map((item) => (
        <TouchableOpacity
          key={`modal-tx-${item.id}`}
          style={styles.transactionCard}
          onPress={() => {
            setShowTransactionsModal(false);
            handleTransactionPress(item);
          }}
          activeOpacity={0.75}
        >
          <View style={styles.transactionLeft}>
            <Text style={styles.transactionIcon}>
              {getCategoryIcon(item.category)}
            </Text>
            <View>
              <Text style={styles.transactionName}>{item.name}</Text>
              <Text style={styles.transactionCategory}>
                {item.category} • {item.date}
              </Text>
            </View>
          </View>
          <View style={styles.transactionRight}>
            <Text
              style={
                item.type === "Income"
                  ? styles.incomeText
                  : styles.expenseText
              }
            >
              {item.type === "Income" ? "+" : "-"}₱
              {item.amount.toLocaleString()}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
</Modal>

{/* ALL LOANS SCROLLABLE MODAL FORM */}
<Modal
  visible={showLoansModal}
  animationType="slide"
  transparent={false}
  onRequestClose={() => setShowLoansModal(false)}
>
  <View style={styles.fullModalContainer}>
    <View style={styles.fullModalHeader}>
      <Text style={styles.fullModalTitle}>All Active Loans</Text>
      <TouchableOpacity
        style={styles.closeModalButton}
        onPress={() => setShowLoansModal(false)}
      >
        <Text style={styles.closeModalButtonText}>Close</Text>
      </TouchableOpacity>
    </View>

    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.modalListContent}
    >
      {loans.map((item, index) => (
        <TouchableOpacity
          key={`modal-loan-${item.id || index}`}
          style={styles.transactionCard}
          onPress={() => {
            setShowLoansModal(false);
            handleLoanPress(item);
          }}
          activeOpacity={0.75}
        >
          <View style={styles.transactionLeft}>
            <Text style={styles.transactionIcon}>🏦</Text>
            <View>
              <Text style={styles.transactionName}>
                {item.title} •{" "}
                {item.startDate ? item.startDate.split("T")[0] : ""}
              </Text>
              <Text style={styles.transactionCategory}>
                Monthly: ₱{(item.monthlyPayment ?? 0).toLocaleString()}
              </Text>
            </View>
          </View>
          <View style={styles.transactionRight}>
            <Text style={styles.LoanexpenseText}>
              ₱{(item.totalAmount ?? 0).toLocaleString()}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
</Modal>

{/* LOAN ACTIONS MODAL */}
<Modal
  visible={selectedLoan !== null}
  animationType="fade"
  transparent
  onRequestClose={closeLoanActions}
>
  <View style={styles.actionModalOverlay}>
    <View style={styles.actionModalContent}>
      <Text style={styles.actionModalTitle}>{selectedLoan?.title}</Text>
      <Text style={styles.actionModalSubtitle}>
        Total Amount • ₱{(selectedLoan?.totalAmount ?? 0).toLocaleString()}
      </Text>

      {/* DELETE BUTTON */}
      <TouchableOpacity
        style={styles.actionModalDeleteButton}
        onPress={handleDeleteSelectedLoan}
      >
        <Text style={styles.actionModalDeleteText}>Delete loan</Text>
      </TouchableOpacity>

      {/* CANCEL BUTTON */}
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
        animationType="fade"
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
              onPress={handleDeleteSelectedTransaction}
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

      {/* DRAGGABLE FAB BUTTON */}
      <Animated.View
        style={[styles.fab, { transform: pan.getTranslateTransform() }]}
        {...panResponder.panHandlers}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Animated.View>

      {/* ADD TRANSACTION MODAL */}
      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingTransactionId ? "Edit Transaction" : "Add Transaction"}
            </Text>

            {/* TYPE SWITCHER */}
            <View style={styles.typeContainer}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  type === "Expense" && styles.typeButtonActiveExpense,
                ]}
                onPress={() => setType("Expense")}
              >
                <Text
                  style={[
                    styles.typeText,
                    type === "Expense" && styles.typeTextActive,
                  ]}
                >
                  Expense
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  type === "Income" && styles.typeButtonActiveIncome,
                ]}
                onPress={() => setType("Income")}
              >
                <Text
                  style={[
                    styles.typeText,
                    type === "Income" && styles.typeTextActive,
                  ]}
                >
                  Income
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Groceries"
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.inputLabel}>Amount (₱)</Text>
            <TextInput
              style={styles.input}
              placeholder="₱0.00"
              placeholderTextColor="#94a3b8"
              keyboardType="decimal-pad"
              value={amount}
              onFocus={handleAmountFocus}
              onChangeText={handleAmountChange}
            />

            <Text style={styles.inputLabel}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 16 }}
            >
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryChip,
                    category === cat && styles.categoryChipActive,
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      category === cat && styles.categoryTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={closeTransactionForm}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveTransaction}
              >
                <Text style={styles.saveButtonText}>
                  {editingTransactionId ? "Update" : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}



const createStyles = (isDarkMode: boolean) => {
  const backgroundColor = isDarkMode ? "#0f172a" : "#f8fafc";
  const cardColor = isDarkMode ? "#1e293b" : "#ffffff";
  const textColor = isDarkMode ? "#f8fafc" : "#0f172a";
  const secondaryTextColor = isDarkMode ? "#94a3b8" : "#64748b";
  const borderColor = isDarkMode ? "#334155" : "#e2e8f0";

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor,
    },
    dashboardContainer: {
      flex: 1,
    },
    dashboardContent: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 110,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      color: textColor,
    },
    subtitle: {
      fontSize: 13,
      color: secondaryTextColor,
    },
    profileButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 2,
      borderColor: "#3b82f6",
      overflow: "hidden",
    },
    profileAvatar: {
      width: "100%",
      height: "100%",
    },
    themeToggleContainer: {
      flexDirection: "row",
      alignItems: "center",
    },
    themeToggleLabel: {
      fontSize: 18,
      marginRight: 6,
    },
    balanceCard: {
      backgroundColor: cardColor,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor,
    },
    balanceLabel: {
      fontSize: 13,
      color: secondaryTextColor,
      marginBottom: 4,
    },
    balance: {
      fontSize: 28,
      fontWeight: "bold",
      color: textColor,
      marginBottom: 16,
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderTopColor: borderColor,
      paddingTop: 12,
    },
    statsLabel: {
      fontSize: 12,
      color: secondaryTextColor,
    },
    incomeText: {
      color: "#22c55e",
      fontWeight: "600",
      fontSize: 15,
    },
    expenseText: {
      color: "#ef4444",
      fontWeight: "600",
      fontSize: 15,
    },
    LoanexpenseText: {
      color: "#A4BE0C",
      fontWeight: "600",
      fontSize: 15,
    },
    sectionHeader: {
      marginBottom: 10,
      marginTop: 4,
    },
    overviewFilterContainer: {
      flexDirection: "row",
      backgroundColor: cardColor,
      borderRadius: 10,
      padding: 4,
      marginBottom: 12,
      borderWidth: 1,
      borderColor,
    },
    overviewFilter: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 8,
      borderRadius: 7,
    },
    overviewFilterActive: {
      backgroundColor: "#3b82f6",
    },
    balanceTrendLabel: {
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 8,
      marginLeft: 4,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: textColor,
    },
    chartCard: {
      backgroundColor: cardColor,
      borderRadius: 16,
      padding: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor,
      alignItems: "center",
    },
    chartScroll: {
      width: "100%",
    },
    chartContent: {
      paddingHorizontal: 4,
    },
    balanceChartScroll: {
      width: "100%",
    },
    balanceChartContent: {
      paddingHorizontal: 4,
    },
    spendingOverviewDescription: {
      color: secondaryTextColor,
      fontSize: 13,
      lineHeight: 19,
      marginTop: -4,
      marginBottom: 16,
      paddingHorizontal: 4,
    },
    filterContainer: {
      flexDirection: "row",
      marginBottom: 14,
    },
    filterChip: {
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: cardColor,
      marginRight: 8,
      borderWidth: 1,
      borderColor,
    },
    filterChipActive: {
      backgroundColor: "#3b82f6",
      borderColor: "#3b82f6",
    },
    filterText: {
      fontSize: 13,
      color: secondaryTextColor,
    },
    filterTextActive: {
      color: "#ffffff",
      fontWeight: "600",
    },
    transactionCard: {
      backgroundColor: cardColor,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 1,
      borderColor,
    },
    transactionLeft: {
      flexDirection: "row",
      alignItems: "center",
    },
    transactionIcon: {
      fontSize: 22,
      marginRight: 12,
    },
    transactionName: {
      fontSize: 14,
      fontWeight: "600",
      color: textColor,
    },
    transactionCategory: {
      fontSize: 12,
      color: secondaryTextColor,
      marginTop: 2,
    },
    transactionRight: {
      alignItems: "flex-end",
    },
    emptyContainer: {
      alignItems: "center",
      paddingVertical: 20,
    },
    emptyText: {
      color: secondaryTextColor,
      fontSize: 13,
    },
    fab: {
      position: "absolute",
      bottom: 30,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "#3b82f6",
      justifyContent: "center",
      alignItems: "center",
      elevation: 6,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 4.5,
    },
    fabIcon: {
      color: "#ffffff",
      fontSize: 32,
      fontWeight: "300",
      marginTop: -2,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
    },
    actionModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(15, 23, 42, 0.55)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    actionModalContent: {
      width: "100%",
      backgroundColor: cardColor,
      borderRadius: 18,
      padding: 20,
      borderWidth: 1,
      borderColor,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 8,
    },
    actionModalTitle: {
      color: textColor,
      fontSize: 19,
      fontWeight: "700",
      marginBottom: 5,
    },
    actionModalSubtitle: {
      color: secondaryTextColor,
      fontSize: 13,
      marginBottom: 18,
    },
    actionModalEditButton: {
      backgroundColor: isDarkMode ? "#1e3a8a" : "#eff6ff",
      borderColor: isDarkMode ? "#2563eb" : "#bfdbfe",
      borderWidth: 1,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: "center",
      marginBottom: 10,
    },
    actionModalEditText: {
      color: isDarkMode ? "#bfdbfe" : "#1d4ed8",
      fontSize: 14,
      fontWeight: "700",
    },
    actionModalDeleteButton: {
      backgroundColor: isDarkMode ? "#7f1d1d" : "#fff1f2",
      borderColor: isDarkMode ? "#ef4444" : "#fecdd3",
      borderWidth: 1,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: "center",
      marginBottom: 10,
    },
    actionModalDeleteText: {
      color: isDarkMode ? "#fecaca" : "#be123c",
      fontSize: 14,
      fontWeight: "700",
    },
    actionModalCancelButton: {
      paddingVertical: 11,
      alignItems: "center",
    },
    actionModalCancelText: {
      color: secondaryTextColor,
      fontSize: 14,
      fontWeight: "600",
    },
    modalContent: {
      width: "100%",
      backgroundColor: cardColor,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: textColor,
      marginBottom: 16,
    },
    typeContainer: {
      flexDirection: "row",
      marginBottom: 16,
      backgroundColor: isDarkMode ? "#0f172a" : "#f1f5f9",
      borderRadius: 10,
      padding: 4,
    },
    typeButton: {
      flex: 1,
      paddingVertical: 8,
      alignItems: "center",
      borderRadius: 8,
    },
    typeButtonActiveExpense: {
      backgroundColor: "#ef4444",
    },
    typeButtonActiveIncome: {
      backgroundColor: "#22c55e",
    },
    typeText: {
      fontSize: 13,
      fontWeight: "600",
      color: secondaryTextColor,
    },
    typeTextActive: {
      color: "#ffffff",
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: secondaryTextColor,
      marginBottom: 6,
    },
    input: {
      backgroundColor: isDarkMode ? "#0f172a" : "#f1f5f9",
      color: textColor,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 14,
      borderWidth: 1,
      borderColor,
    },
    categoryChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: isDarkMode ? "#0f172a" : "#f1f5f9",
      marginRight: 8,
      borderWidth: 1,
      borderColor,
    },
    categoryChipActive: {
      backgroundColor: "#3b82f6",
      borderColor: "#3b82f6",
    },
    categoryText: {
      fontSize: 12,
      color: secondaryTextColor,
    },
    categoryTextActive: {
      color: "#ffffff",
      fontWeight: "600",
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    modalButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: "center",
    },
    cancelButton: {
      backgroundColor: isDarkMode ? "#334155" : "#e2e8f0",
      marginRight: 8,
    },
    cancelButtonText: {
      color: textColor,
      fontWeight: "600",
    },
    saveButton: {
      backgroundColor: "#3b82f6",
      marginLeft: 8,
    },
    saveButtonText: {
      color: "#ffffff",
      fontWeight: "600",
    },

    cardContainer: {
  backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
  borderRadius: 18,
  padding: 16,
  borderWidth: 1,
  borderColor: isDarkMode ? '#334155' : '#cbd5e1',
  marginBottom: 20,
},
seeMoreButton: {
  width: '100%',
  paddingVertical: 14,
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 10,
  backgroundColor: 'transparent',
  borderTopWidth: 1,
  borderTopColor: isDarkMode ? '#334155' : '#e2e8f0',
  zIndex: 10,
},
seeMoreText: {
  fontSize: 14,
  fontWeight: 'bold',
  color: '#01040A', // Ensure high-contrast blue color
},
fullModalContainer: {
  flex: 1,
  backgroundColor: isDarkMode ? "#0f172a" : "#f8fafc",
  paddingTop: 50,
  paddingHorizontal: 20,
},
fullModalHeader: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 20,
  paddingBottom: 12,
  borderBottomWidth: 1,
  borderBottomColor: isDarkMode ? "#334155" : "#cbd5e1",
},
fullModalTitle: {
  fontSize: 22,
  fontWeight: "bold",
  color: isDarkMode ? "#f8fafc" : "#0f172a",
},
closeModalButton: {
  paddingVertical: 6,
  paddingHorizontal: 14,
  backgroundColor: "#1e3a8a",
  borderRadius: 8,
},
closeModalButtonText: {
  color: "#ffffff",
  fontWeight: "600",
  fontSize: 14,
},
modalListContent: {
  paddingBottom: 40,
},
  });
};
