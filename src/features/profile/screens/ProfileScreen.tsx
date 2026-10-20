import { getDesignTheme } from "../../../constants/design";
import { refreshDesignTheme } from "../../../hooks/use-design-theme";
import { useReducedMotion } from "../../../hooks/use-reduced-motion";
import ChangePasswordModal from '@/features/auth/components/ChangePasswordModal';
import { CreditScoreModal } from "@/features/credit-score/components/CreditScoreModal";
import DeveloperModal from '@/features/settings/components/DeveloperModal';
import SystemInformationModal from '@/features/settings/components/SystemInformationModal';
import { auth, db } from "@/services/firebase/client";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import * as LocalAuthentication from "expo-local-authentication";
import { useFocusEffect, useRouter } from "expo-router";
import { cacheUserProfile, clearCardsFromDB, deleteCardFromDB, fetchCardsFromDB, fetchLoansFromDB, insertCardToDB, insertLoanToDB, subscribeFinancialData, syncFromFirestore, updateCardInDB } from "../../../database";
import { inputDate, moneyToCentavos, periodStart, scheduleDates, summarize } from "../../../domain/finance";
import { calculateCreditScoreFromDB, ComputedCreditData } from "../../credit-score/services/creditScore";
import { createModalStyles, createStyles } from "../styles/ProfileScreen.styles";

import {
collection,
doc,
onSnapshot,
updateDoc
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
ActivityIndicator,
Alert,
Image,
Keyboard,
KeyboardAvoidingView,
Modal,
Platform,
ScrollView,
Switch,
Text,
TextInput,
TouchableOpacity,
useColorScheme,
View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../../contexts/AuthContext";
import {
fetchTransactionsFromDB,
getThemePreference,
setThemePreference,
TransactionItem,
} from "../../../database";

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
}

interface Loan {
  id: string;
  title: string;
  totalAmount: number;
  monthlyDeduction: number;
  startDate: string;
  durationMonths: number;
  remainingMonths: number;
  accountId?: string;
}

interface SavedCard {
  id: string;
  name: string;
  type: string;
  lastFour: string;
  expiry: string;
  amount?: number;
}

interface UserProfile {
  displayName: string;
  email: string;
  phone?: string;
  address?: string;
  photoURL?: string;
  tier: string;
  isBiometricEnabled: boolean;
  isNotificationEnabled: boolean;
  birthdate?: string;
  occupation?: string;
}

export default function ProfileScreen() {


  const { logout } = useAuth();
  const router = useRouter();
  const systemColorScheme = useColorScheme();
  const reducedMotion = useReducedMotion();

  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === "dark");
  const appearance = getDesignTheme(isDarkMode);
  const [loading, setLoading] = useState(true);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCardModalVisible, setIsCardModalVisible] = useState(false);
  const [isSavingCard, setIsSavingCard] = useState(false);
  const [cardName, setCardName] = useState("");
  const [cardType, setCardType] = useState("Debit");
  const [cardLastFour, setCardLastFour] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardAmount, setCardAmount] = useState("");
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<SavedCard | null>(null);

 // Loans State
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [isCreatingLoan, setIsCreatingLoan] = useState(false);
  const [isLoanModalVisible, setIsLoanModalVisible] = useState(false);
  const [loans, setLoans] = useState<Loan[]>([]);

  //updated loans
  const [loanTitle, setLoanTitle] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [loanInstallment, setLoanInstallment] = useState("");
  const [loanDueDay, setLoanDueDay] = useState("1");
  const [loanDuration, setLoanDuration] = useState("");
  const [loanStartDate, setLoanStartDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSavingLoan, setIsSavingLoan] = useState(false);
  const savingLoanRef = useRef(false);

    // Automatically calculate end date and total projected cost
  const calculatedEndDate = useMemo(() => {
    try { return new Date(scheduleDates(inputDate(loanStartDate), Number(loanDueDay), Number(loanDuration)).endDate + "T12:00:00"); }
    catch { return null; }
  }, [loanStartDate, loanDueDay, loanDuration]);

  const totalExpense = useMemo(() => {
    const amountNum = Number(loanAmount);
    return isNaN(amountNum) || amountNum <= 0 ? 0 : amountNum;
  }, [loanAmount]);

  const [profile, setProfile] = useState<UserProfile>({
    displayName: "User",
    email: "",
    phone: "",
    address: "",
    photoURL: "",
    tier: "Standard Member",
    isBiometricEnabled: false,
    isNotificationEnabled: true,
  });

  const [editForm, setEditForm] = useState({
    displayName: "",
    phone: "",
    address: "",
  });

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [analyticsVisible, setAnalyticsVisible] = useState(false);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<
    "Week" | "Month" | "Year"
  >("Month");
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);

  // Memoize styles to prevent re-creation on every render
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const modalStyles = useMemo(() => createModalStyles(isDarkMode), [isDarkMode]);
  const currentUser = auth.currentUser;

  useFocusEffect(
    useCallback(() => {
      const savedTheme = getThemePreference();
      void loadCreditScore().catch(() => {});
      if (savedTheme !== null) {
        setIsDarkMode(savedTheme === "dark");
      } else {
        setIsDarkMode(systemColorScheme === "dark");
      }
    }, [systemColorScheme])
  );

  const handleDarkModeToggle = (value: boolean) => {
    setIsDarkMode(value);
    setThemePreference(value ? "dark" : "light");
    refreshDesignTheme();
  };

  const handlePickImage = async () => {
    if (!currentUser) return;

    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Denied",
        "Permission to access gallery is required!"
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.2, // Keep Base64 within Firestore 1MB document limit
      base64: true,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      setIsUploadingImage(true);
      try {
        const imageUri = `data:image/jpeg;base64,${result.assets[0].base64}`;
        const userDocRef = doc(db, "users", currentUser.uid);

        await updateDoc(userDocRef, { photoURL: imageUri });
        setProfile((prev) => ({ ...prev, photoURL: imageUri }));
        Alert.alert("Success", "Profile picture updated successfully!");
      } catch (error) {

        Alert.alert("Error", "Failed to update profile picture.");
      } finally {
        setIsUploadingImage(false);
      }
    }
  };

  const handlePhoneChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, "");
    if (cleaned.length <= 11) {
      setEditForm((prev) => ({ ...prev, phone: cleaned }));
      if (cleaned.length === 11) {
        Keyboard.dismiss();
      }
    }
  };

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
          } catch (error) {
            Alert.alert("Error", "Failed to log out.");
          }
        },
      },
    ]);
  };

  // Bind snapshot listeners safely to currentUser.uid
  useEffect(() => {
  if (!currentUser?.uid) {
    setLoading(false);

    return;
  }

  // Define Firestore references
  const userDocRef = doc(db, "users", currentUser.uid);
  const loansColRef = collection(db, "users", currentUser.uid, "loans");
  const cardsColRef = collection(db, "users", currentUser.uid, "cards");

  // 1. Synchronize Profile Data
  const unsubscribeUser = onSnapshot(
    userDocRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (auth.currentUser?.uid !== currentUser.uid) return;
        cacheUserProfile(currentUser.uid, data);
        setProfile((prev) => ({
          ...prev,
          displayName:
            data.displayName ?? data.fullName ?? currentUser.displayName ?? prev.displayName,
          email: data.email ?? currentUser.email ?? prev.email,
          phone: data.phone ?? data.mobileNumber ?? currentUser.phoneNumber ?? prev.phone,
          address: data.address ?? prev.address,
          photoURL: data.photoURL ?? currentUser.photoURL ?? prev.photoURL,
          tier: data.tier ?? prev.tier,
          isBiometricEnabled:
            data.isBiometricEnabled ?? prev.isBiometricEnabled,
          isNotificationEnabled:
            data.isNotificationEnabled ?? prev.isNotificationEnabled,
          birthdate: data.birthdate ?? data.birthday ?? prev.birthdate,
          occupation: data.occupation ?? prev.occupation,
        }));
      } else {
        setProfile((prev) => ({
          ...prev,
          displayName: currentUser.displayName || prev.displayName,
          email: currentUser.email || prev.email,
          phone: currentUser.phoneNumber || prev.phone,
          photoURL: currentUser.photoURL || prev.photoURL,
        }));
      }
      setLoading(false);
    },
    (error) => {

      setLoading(false);
    }
  );

  const reload = () => {
    setLoans(fetchLoansFromDB().map((loan) => ({ ...loan, id: loan.firestoreId!, monthlyDeduction: loan.monthlyPayment, remainingMonths: 0 })));
    setCards(fetchCardsFromDB().map((card) => ({ ...card, id: card.firestoreId! })));
  };
  reload();
  const stop = subscribeFinancialData(reload);
  void syncFromFirestore().catch(() => {});
  return () => { unsubscribeUser(); stop(); };
}, [currentUser?.uid]);

  const openEditModal = () => {
    setEditForm({
      displayName: profile.displayName,
      phone: profile.phone || "",
      address: profile.address || "",
    });
    setIsEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;

    if (editForm.phone && editForm.phone.length !== 11) {
      Alert.alert(
        "Invalid Phone Number",
        "Please enter a valid 11-digit mobile number (e.g., 09123456789).",
      );
      return;
    }

    setIsSaving(true);
    try {
      const userDocRef = doc(db, "users", currentUser.uid);
      await updateDoc(userDocRef, {
        displayName: editForm.displayName,
        phone: editForm.phone,
        address: editForm.address,
      });

      setIsEditModalVisible(false);
      Alert.alert("Success", "Profile updated successfully.");
    } catch (error) {
      Alert.alert("Error", "Failed to update profile information.");

    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePreference = async (
    field: keyof UserProfile,
    value: boolean,
  ) => {
    if (!currentUser) return;

    // If toggling email balance alerts, intercept with a confirmation alert explaining the feature
    if (field === "isNotificationEnabled") {
      const actionText = value ? "turn on" : "turn off";
      Alert.alert(
        "Email Balance Alerts",
        `Email alerts can notify you when your recorded balance is negative. Do you want to ${actionText} email alerts?`,
        [
          {
            text: "Cancel",
            style: "cancel",
            // Switch state remains unchanged if cancelled
          },
          {
            text: "Confirm",
            onPress: async () => {
              setProfile((prev) => ({ ...prev, [field]: value }));
              try {
                const userDocRef = doc(db, "users", currentUser.uid);
                await updateDoc(userDocRef, { [field]: value });
              } catch (error) {
                Alert.alert("Error", "Failed to update preferences.");
                setProfile((prev) => ({ ...prev, [field]: !value }));
              }
            },
          },
        ]
      );
      return;
    }

    setProfile((prev) => ({ ...prev, [field]: value }));

    try {
      const userDocRef = doc(db, "users", currentUser.uid);
      await updateDoc(userDocRef, { [field]: value });
    } catch (error) {
      Alert.alert("Error", "Failed to update preferences.");
      setProfile((prev) => ({ ...prev, [field]: !value }));
    }
  };

  const handleBiometricToggle = async (value: boolean) => {
  if (!value) {
    await handleTogglePreference("isBiometricEnabled", false);
    return;
  }

  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      Alert.alert(
        "Biometrics Unavailable",
        "This device does not have a supported biometric sensor."
      );
      return;
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      Alert.alert(
        "Biometrics Not Set Up",
        "Set up Face ID or a fingerprint on your device before enabling this option."
      );
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Confirm biometric security for ExTrack",
      cancelLabel: "Cancel",
      fallbackLabel: "Use Passcode",
      disableDeviceFallback: false,
    });

    if (result.success) {
      await handleTogglePreference("isBiometricEnabled", true);
      Alert.alert("Success", "Biometric authentication enabled!");
    } else {
      await handleTogglePreference("isBiometricEnabled", false);
    }
  } catch (error) {

    Alert.alert(
      "Biometric Error",
      "Biometric authentication is unavailable right now."
    );
    await handleTogglePreference("isBiometricEnabled", false);
  }
};

  const handleSaveLoan = async () => {
    if (!currentUser || isSavingLoan) return;
    let principalCentavos: number, installmentCentavos: number;
    const durationMonths = Number(loanDuration), dueDay = Number(loanDueDay);
    try {
      principalCentavos = moneyToCentavos(loanAmount); installmentCentavos = moneyToCentavos(loanInstallment);
      if (!loanTitle.trim() || !Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 600 || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) throw new Error("Enter a title, duration (1-600 months), and due day (1-31).");
    } catch (error) { Alert.alert("Check loan details", error instanceof Error ? error.message : "Invalid details."); return; }
    const startDate = inputDate(loanStartDate);
    const { firstDueDate, endDate } = scheduleDates(startDate, dueDay, durationMonths);
    const saveLoan = async () => {
      if (savingLoanRef.current || auth.currentUser?.uid !== currentUser.uid) return;
      savingLoanRef.current = true; setIsSavingLoan(true);
      try {
        await insertLoanToDB({ title: loanTitle.trim(), schemaVersion: 2, principalCentavos, installmentCentavos, durationMonths, dueDay,
          startDate, firstDueDate, endDate,
          totalAmount: principalCentavos / 100, monthlyPayment: installmentCentavos / 100, annualExpense: 0 });
        setLoanTitle(""); setLoanAmount(""); setLoanInstallment(""); setLoanDuration(""); setIsLoanModalVisible(false);
        Alert.alert("Loan saved locally", "Installments stay unpaid until you confirm payment from the Home loan details. Pending changes sync when connected.");
      } catch (error) { Alert.alert("Unable to save", error instanceof Error ? error.message : "Loan could not be saved."); }
      finally { savingLoanRef.current = false; setIsSavingLoan(false); }
    };
    Alert.alert("Review loan schedule", "Principal: PHP " + (principalCentavos / 100).toFixed(2) + ". Monthly installment: PHP " + (installmentCentavos / 100).toFixed(2) + ". Scheduled total: PHP " + (installmentCentavos * durationMonths / 100).toFixed(2) + ". First due: " + firstDueDate + ". No interest is inferred. Confirm these values?", [{ text: "Cancel", style: "cancel" }, { text: "Save Loan", onPress: saveLoan }]);
  };

const [isCreditModalVisible, setIsCreditModalVisible] = useState(false);

const handleAction = (title: string) => {
  if (title === "Credit") {
    setIsCreditModalVisible(true);
    return;
  }
  if (title === "Loan") {
    setIsLoanModalVisible(true);
    return;
  }
  if (title === "Manage Cards") {
    Alert.alert(
      "Add a card",
      "Would you like to add a card to your ExTrack account?",
      [
        { text: "No", style: "cancel" },
        { text: "Yes", onPress: () => setIsCardModalVisible(true) },
      ],
    );
    return;
  }
  if (title === "Bank Documents") {
    router.push("/statements");
    return;
  }
  if (title === "Help & Support") {
    router.push("/help");
    return;
  }
  Alert.alert(title, `This feature is currently in a limited pilot phase, Thank you for your understanding!`);
};

const closeCardModal = () => {
  setIsCardModalVisible(false);
  setEditingCardId(null);
  setCardName("");
  setCardType("Debit");
  setCardLastFour("");
  setCardExpiry("");
  setCardAmount("");
};

const handleSaveCard = async () => {
  if (!currentUser) return;
  const cleanLastFour = cardLastFour.replace(/\D/g, "");
  let parsedAmount = 0;
  try { parsedAmount = cardAmount.trim() === "" || /^0(?:\.0{1,2})?$/.test(cardAmount.trim()) ? 0 : moneyToCentavos(cardAmount.trim()) / 100; }
  catch { Alert.alert("Invalid amount", "Enter a nonnegative card summary with at most two decimals."); return; }

  if (
    !cardName.trim() ||
    cleanLastFour.length !== 4 ||
    !/^\d{2}\/\d{2}$/.test(cardExpiry)
  ) {
    Alert.alert(
      "Incomplete card details",
      "Enter a card name, exactly four ending digits, and expiry in MM/YY format."
    );
    return;
  }

  setIsSavingCard(true);
  try {
    const cardData = {
      name: cardName.trim(),
      type: cardType,
      lastFour: cleanLastFour,
      expiry: cardExpiry,
      ownerUid: currentUser.uid,
      amount: parsedAmount,
    };

    if (auth.currentUser?.uid !== currentUser.uid) throw new Error("Account changed.");
    if (editingCardId) await updateCardInDB({ ...cardData, firestoreId: editingCardId });
    else await insertCardToDB(cardData);
    const isEdit = Boolean(editingCardId);
    closeCardModal();

    Alert.alert(
      isEdit ? "Card updated" : "Card added",
      "Card summary saved locally. Pending changes sync when connected; balances are not income."
    );
  } catch (error) {

    Alert.alert("Error", "Unable to save card details right now.");
  } finally {
    setIsSavingCard(false);
  }
};

const openEditCard = (card: SavedCard) => {
  setEditingCardId(card.id);
  setCardName(card.name);
  setCardType(card.type);
  setCardLastFour(card.lastFour);
  setCardExpiry(card.expiry);
  setCardAmount(card.amount !== undefined ? card.amount.toString() : "");
  setSelectedCard(null);
  setIsCardModalVisible(true);
};

const deleteSelectedCard = async () => {
  if (!currentUser || !selectedCard) return;

  try {
    await deleteCardFromDB(undefined, selectedCard.id);
    setSelectedCard(null);
  } catch (error) {

    Alert.alert("Error", "Unable to delete this card right now.");
  }
};

const [creditScoreVisible, setCreditScoreVisible] = useState(false);
const [information, setInformation] = useState(false);
const [password, setPassword] = useState(false);
const [developer, setDeveloper] = useState(false);

const [creditData, setCreditData] = useState<ComputedCreditData>({
  score: 0,
  tier: "Fair",
  paymentHistoryCount: 0,
  activeLoansCount: 0,
  creditUtilizationPct: 0,
});

const handleOpenCreditScore = async () => {
  try {
    await loadCreditScore();
    setCreditScoreVisible(true);
  } catch (error) {

    Alert.alert("Estimate unavailable", "Financial data could not be synchronized. No score has been calculated.");
  }
};

const loadCreditScore = useCallback(async () => {
  try {
    const data = await calculateCreditScoreFromDB();
    setCreditData(data);
  } catch (error) {
    throw new Error("Estimate unavailable.");
  }
}, []);

  const openAnalytics = async () => {
    setLoading(true);
    try { await syncFromFirestore(); }
    catch { Alert.alert("Cloud sync unavailable", "Showing this account's saved local records. Pending changes are preserved."); }
    finally { setTransactions(fetchTransactionsFromDB()); setLoading(false); setAnalyticsVisible(true); }
  };
  const analyticsSummary = summarize(transactions, periodStart(analyticsPeriod));
  const analyticsTransactions = analyticsSummary.entries;
  const analyticsIncome = analyticsSummary.income, analyticsExpenses = analyticsSummary.expenses;
  const topCategories = Object.entries(analyticsSummary.categories).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const highestCategoryAmount = topCategories[0]?.[1] || 1;
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const handleClearCards = () => {
  Alert.alert(
    "Clear All Cards",
    "Are you sure you want to remove all saved cards?",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear All",
        style: "destructive",
        onPress: async () => {
          try {
            await clearCardsFromDB();
            setCards([]);
            Alert.alert("Success", "All cards have been removed.");
          } catch (error) {
            Alert.alert("Error", "Failed to clear cards.");
          }
        },
      },
    ]
  );
};

const openChangePassword = () => {
    setPassword(true);
  };

const openDeveloper = () => {
    setDeveloper(true);
  };

const openInformation = () => {
    setInformation(true);
  };

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "left", "right", "bottom"]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {profile.photoURL ? (
              <Image
                source={{ uri: profile.photoURL }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {getInitials(profile.displayName)}
                </Text>
              </View>
            )}

            <TouchableOpacity
              accessibilityRole="button" accessibilityLabel="Change profile photo" hitSlop={12}
              style={styles.editAvatarBadge}
              onPress={handlePickImage}
              disabled={isUploadingImage}
            >
              {isUploadingImage ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="camera-outline" size={16} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.userName}>{profile.displayName}</Text>
          <Text style={styles.userEmail}>{profile.email}</Text>
          {profile.phone ? (
            <Text style={styles.userPhone}>
              +63 {profile.phone.replace(/^0/, "")}
            </Text>
          ) : null}

          <View style={styles.tierBadge}>
            <Text style={styles.tierBadgeText}>{profile.tier}</Text>
          </View>
        </View>

        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleOpenCreditScore()}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: appearance.raised }]}>
              <Ionicons name="shield-checkmark-outline" size={21} color={appearance.accent} />
            </View>
            <Text style={styles.actionLabel}>Wellness</Text>
          </TouchableOpacity>

               <CreditScoreModal visible={creditScoreVisible} onClose={() =>
                setCreditScoreVisible(false)}
                creditScore={creditData.score}
                paymentHistoryCount={creditData.paymentHistoryCount}
                activeLoansCount={creditData.activeLoansCount}
                creditUtilizationPct={creditData.creditUtilizationPct}
                />

                <TouchableOpacity
        style={styles.actionButton}
        onPress={() => handleAction("Loan")}
      >
        <View
          style={[
            styles.actionIconContainer,
            { backgroundColor: appearance.raised },
          ]}
        >
          <Ionicons name="calendar-outline" size={20} color={appearance.accent} />
        </View>
        <Text style={styles.actionLabel}>Loan</Text>
      </TouchableOpacity>

          <Modal
            visible={isLoanModalVisible}
            animationType={reducedMotion ? "none" : "slide"}
            transparent={true}
            onRequestClose={() => setIsLoanModalVisible(false)}
          >
            <View style={modalStyles.overlay}>
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ width: "100%" }}
              >
                <View style={[modalStyles.container, { maxHeight: "85%" }]}>
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ flexGrow: 1 }}
                  >
                    <Text style={modalStyles.title}>Track New Loan</Text>

                    <Text style={modalStyles.label}>Loan Title / Description</Text>
                    <TextInput
                      style={modalStyles.input}
                      placeholder="e.g. Car Loan, Emergency Fund"
                      placeholderTextColor={isDarkMode ? "#64748b" : "#9ca3af"}
                      value={loanTitle}
                      onChangeText={setLoanTitle}
                    />

                    <Text style={modalStyles.label}>Total Loan Principal (PHP)</Text>
                    <TextInput
                      style={modalStyles.input}
                      placeholder="0.00"
                      placeholderTextColor={isDarkMode ? "#64748b" : "#9ca3af"}
                      keyboardType="numeric"
                      value={loanAmount}
                      onChangeText={setLoanAmount}
                    />

                    <Text style={modalStyles.label}>Monthly Installment (PHP)</Text>
                    <TextInput style={modalStyles.input} value={loanInstallment} onChangeText={setLoanInstallment} keyboardType="decimal-pad" placeholder="2000.00" placeholderTextColor="#94a3b8" />
                    <Text style={modalStyles.label}>Payment Due Day (1-31; shorter months use last day)</Text>
                    <TextInput style={modalStyles.input} value={loanDueDay} onChangeText={setLoanDueDay} keyboardType="number-pad" placeholder="1" placeholderTextColor="#94a3b8" />
                    <Text style={modalStyles.label}>Duration (Months)</Text>
                    <TextInput
                      style={modalStyles.input}
                      placeholder="e.g. 12"
                      placeholderTextColor={isDarkMode ? "#64748b" : "#9ca3af"}
                      keyboardType="number-pad"
                      value={loanDuration}
                      onChangeText={setLoanDuration}
                    />

                    <Text style={modalStyles.label}>Start Date</Text>
                    <TouchableOpacity
                      style={modalStyles.datePickerButton}
                      onPress={() => setShowDatePicker((prev) => !prev)}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        color={isDarkMode ? "#94a3b8" : "#4b5563"}
                      />
                      <Text style={modalStyles.datePickerText}>
                        {loanStartDate.toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </Text>
                    </TouchableOpacity>

                    {showDatePicker && (
                      <DateTimePicker
                        value={loanStartDate}
                        mode="date"
                        display={Platform.OS === "ios" ? "inline" : "default"}
                        textColor={isDarkMode ? "#ffffff" : "#000000"}
                        themeVariant={isDarkMode ? "dark" : "light"}
                        onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
                          if (Platform.OS === "android") {
                            setShowDatePicker(false);
                          }
                          if (selectedDate) {
                            setLoanStartDate(selectedDate);
                          }
                          if (event.type === "dismissed") {
                            setShowDatePicker(false);
                          }
                        }}
                      />
                    )}

                    <View style={modalStyles.summaryCard}>
                      <View style={modalStyles.summaryRow}>
                        <Text style={modalStyles.summaryLabel}>Last Scheduled Due Date:</Text>
                        <Text style={modalStyles.summaryValue}>
                          {calculatedEndDate
                            ? calculatedEndDate.toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : "--"}
                        </Text>
                      </View>
                      <View style={modalStyles.summaryRow}>
                        <Text style={modalStyles.summaryLabel}>Scheduled Installment Total:</Text>
                        <Text style={modalStyles.summaryValueBold}>
                          ₱
                          {(
                            (parseFloat(loanInstallment) || 0) *
                            (parseInt(loanDuration, 10) || 0)
                          ).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </Text>
                      </View>
                    </View>

                    <View style={modalStyles.buttonContainer}>
                      <TouchableOpacity
                        style={[modalStyles.button, modalStyles.cancelButton]}
                        onPress={() => setIsLoanModalVisible(false)}
                        disabled={isSavingLoan}
                      >
                        <Text style={modalStyles.buttonTextCancel}>Cancel</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[modalStyles.button, modalStyles.submitButton]}
                        onPress={handleSaveLoan}
                        disabled={isSavingLoan}
                      >
                        <Text style={modalStyles.buttonText}>
                          {isSavingLoan ? "Saving..." : "Save Record"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </View>
              </KeyboardAvoidingView>
            </View>
          </Modal>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleAction("Manage Cards")}
          >
            <View
              style={[
                styles.actionIconContainer,
                { backgroundColor: appearance.raised },
              ]}
            >
              <Ionicons name="card-outline" size={21} color={appearance.accent} />
            </View>
            <Text style={styles.actionLabel}>Cards</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={openAnalytics}>
            <View
              style={[
                styles.actionIconContainer,
                { backgroundColor: appearance.raised },
              ]}
            >
              <Ionicons name="stats-chart-outline" size={21} color={appearance.accent} />
            </View>
            <Text style={styles.actionLabel}>Analytics</Text>
          </TouchableOpacity>
        </View>

<View style={styles.sectionContainer}>
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>Accounts & Cards</Text>
    <TouchableOpacity onPress={handleClearCards}>
      <Text style={styles.sectionHeaderAction}>Clear Cards</Text>
    </TouchableOpacity>
  </View>

  {accounts.length > 0 || cards.length > 0 ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.horizontalScrollContent}
    >
      {accounts.map((acc) => (
        <TouchableOpacity key={`account-${acc.id}`} style={styles.accountCard}>
          <View style={styles.accountCardHeader}>
            <Text style={styles.accountCardName}>{acc.name}</Text>
            <Text style={styles.accountCardType}>{acc.type}</Text>
          </View>
          <Text style={styles.accountBalance}>
            ₱
            {acc.balance.toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}
          </Text>
        </TouchableOpacity>
      ))}

      {cards.map((card) => (
        <TouchableOpacity
          key={`card-${card.id}`}
          style={styles.accountCard}
          onPress={() => setSelectedCard(card)}
          activeOpacity={0.75}
          accessibilityLabel={`Open actions for ${card.name}`}
        >
          <View style={styles.accountCardHeader}>
            <Text style={styles.accountCardName}>{card.name}</Text>
            <Text style={styles.accountCardType}>{card.type} card</Text>
          </View>
          <Text style={styles.accountBalance}>
            ₱{(card.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </Text>
          <Text style={styles.accountCardType}>•••• {card.lastFour} • Expires {card.expiry}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  ) : (
    <View style={styles.accountCard}>
      <Text style={styles.accountCardName}>No active accounts or cards found.</Text>
    </View>
  )}
</View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Preferences & Security</Text>
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Face ID / Biometrics</Text>
                <Text style={styles.settingSubtitle}>Secure app access</Text>
              </View>
              <Switch
                value={profile.isBiometricEnabled}
                onValueChange={handleBiometricToggle}
                trackColor={{ false: "#767577", true: "#1e3a8a" }}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Push Notifications</Text>
                <Text style={styles.settingSubtitle}>
                  Alerts for balance changes
                </Text>
              </View>
              <Switch
                value={profile.isNotificationEnabled}
                onValueChange={(val) => handleTogglePreference("isNotificationEnabled", val)}
                trackColor={{ false: "#767577", true: "#1e3a8a" }}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Dark Theme</Text>
                <Text style={styles.settingSubtitle}>
                  Toggle app appearance
                </Text>
              </View>
              <Switch
                value={isDarkMode}
                onValueChange={handleDarkModeToggle}
                trackColor={{ false: "#767577", true: "#1e3a8a" }}
              />
            </View>
          </View>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Account Details</Text>
          <View style={styles.settingCard}>

            <TouchableOpacity style={styles.menuRow} onPress={openEditModal}>
              <Text style={styles.menuText}>Personal Information</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => handleAction("Bank Documents")}
            >
              <Text style={styles.menuText}>Statements & Documents</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => handleAction("Help & Support")}
            >
              <Text style={styles.menuText}>Help & Support</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Security & Privacy</Text>
          <View style={styles.settingCard}>

            <TouchableOpacity style={styles.menuRow} onPress={openChangePassword}>
              <Text style={styles.menuText}>Change Password</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
          </View>
        </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Developer Details</Text>
        <View style={styles.settingCard}>

          <TouchableOpacity style={styles.menuRow} onPress={openDeveloper}>
            <Text style={styles.menuText}>Developer</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.menuRow}
            onPress={openInformation}
          >
            <Text style={styles.menuText}>System Information</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

        </View>
      </View>

      <SystemInformationModal
        visible={information}
        onClose={() => setInformation(false)}
      />

      <DeveloperModal
        visible={developer}
        onClose={() => setDeveloper(false)}
      />

      <ChangePasswordModal
        visible={password}
        onClose={() => setPassword(false)}
      />

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.clearButton} disabled accessibilityState={{ disabled: true }} accessibilityHint="No safe disposable cache is available">
          <Text style={styles.clearButtonText}>Clear Cache</Text>
        </TouchableOpacity>
        <Text style={styles.settingSubtitle}>Unavailable: no disposable cache was identified. Financial records and pending changes are kept.</Text>
      </ScrollView>

      <Modal
        visible={analyticsVisible}
        animationType={reducedMotion ? "none" : "slide"}
        transparent
        onRequestClose={() => setAnalyticsVisible(false)}
      >
        <View style={styles.analyticsOverlay}>
          <View style={styles.analyticsContent}>
            <View style={styles.analyticsHeader}>
              <View>
                <Text style={styles.analyticsTitle}>Analytics</Text>
                <Text style={styles.analyticsSubtitle}>
                  Your financial snapshot
                </Text>
              </View>
              <TouchableOpacity
                style={styles.analyticsCloseButton}
                onPress={() => setAnalyticsVisible(false)}
                accessibilityLabel="Close analytics"
              >
                <Text style={styles.analyticsCloseText}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.analyticsPeriodContainer}>
              {(["Week", "Month", "Year"] as const).map((period) => (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.analyticsPeriodButton,
                    analyticsPeriod === period && styles.analyticsPeriodActive,
                  ]}
                  onPress={() => setAnalyticsPeriod(period)}
                >
                  <Text
                    style={[
                      styles.analyticsPeriodText,
                      analyticsPeriod === period &&
                        styles.analyticsPeriodTextActive,
                    ]}
                  >
                    {period}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.analyticsSummaryRow}>
              <View style={styles.analyticsMetricCard}>
                <Text style={styles.analyticsMetricLabel}>Incoming money</Text>
                <Text style={styles.analyticsIncome}>
                  ₱{analyticsIncome.toLocaleString()}
                </Text>
              </View>
              <View style={styles.analyticsMetricCard}>
                <Text style={styles.analyticsMetricLabel}>Outgoing money</Text>
                <Text style={styles.analyticsExpense}>
                  ₱{analyticsExpenses.toLocaleString()}
                </Text>
              </View>
            </View>

            <View style={styles.analyticsNetCard}>
              <Text style={styles.analyticsMetricLabel}>Net change</Text>
              <Text
                style={
                  analyticsIncome - analyticsExpenses >= 0
                    ? styles.analyticsIncome
                    : styles.analyticsExpense
                }
              >
                {analyticsIncome - analyticsExpenses >= 0 ? "+" : "-"}₱
                {Math.abs(analyticsIncome - analyticsExpenses).toLocaleString()}
              </Text>
              <Text style={styles.analyticsHint}>
                {analyticsTransactions.length} transaction
                {analyticsTransactions.length === 1 ? "" : "s"} in this period
              </Text>
            </View>

            {analyticsSummary.reviewCount > 0 && <Text style={styles.analyticsHint}>{analyticsSummary.reviewCount} preserved records excluded pending review.</Text>}
            <Text style={styles.analyticsSectionTitle}>
              Top expense categories
            </Text>
            {topCategories.length > 0 ? (
              topCategories.map(([category, categoryAmount]) => (
                <View key={category} style={styles.categoryRow}>
                  <View style={styles.categoryRowHeader}>
                    <Text style={styles.categoryRowName}>{category}</Text>
                    <Text style={styles.categoryRowAmount}>
                      ₱{categoryAmount.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.categoryTrack}>
                    <View
                      style={[
                        styles.categoryBar,
                        {
                          width: `${(categoryAmount / highestCategoryAmount) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.analyticsEmpty}>
                No expense data for this period.
              </Text>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={isCardModalVisible}
        animationType={reducedMotion ? "none" : "slide"}
        transparent
        onRequestClose={closeCardModal}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardAvoidingView}
          >
            <View style={[styles.modalContent, { maxHeight: "85%" }]}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ flexGrow: 1 }}
              >
                <Text style={styles.modalTitle}>
                  {editingCardId ? "Edit card" : "Add card"}
                </Text>
                <Text style={styles.cardFormHint}>
                  Card summaries are excluded from income and recorded balance. Only the summary is stored. Never enter
                  your PIN or CVV.
                </Text>

                <Text style={styles.inputLabel}>Card name</Text>
                <TextInput
                  style={styles.input}
                  value={cardName}
                  onChangeText={(value) => {
                    const lettersOnly = value.replace(/[0-9]/g, "");
                    const capitalized = lettersOnly.replace(/\b\w/g, (char) => char.toUpperCase());
                    setCardName(capitalized);
                  }}
                  placeholder="e.g. Main Debit Card"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="words"
                />

                <Text style={styles.inputLabel}>Card type</Text>
                <View style={styles.cardTypeRow}>
                  {(["Debit", "Credit"] as const).map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.cardTypeButton,
                        cardType === option && styles.cardTypeButtonActive,
                      ]}
                      onPress={() => setCardType(option)}
                    >
                      <Text
                        style={[
                          styles.cardTypeText,
                          cardType === option && styles.cardTypeTextActive,
                        ]}
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Amount (₱)</Text>
                <TextInput
                  style={styles.input}
                  value={cardAmount}
                  onChangeText={setCardAmount}
                  placeholder="0.00"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                />

                <Text style={styles.inputLabel}>Last four digits</Text>
                <TextInput
                  style={styles.input}
                  value={cardLastFour}
                  onChangeText={(value) =>
                    setCardLastFour(value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="1234"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  returnKeyType="next"
                  maxLength={4}
                />

                <Text style={styles.inputLabel}>Expiry (MM/YY)</Text>
                <TextInput
                  style={styles.input}
                  value={cardExpiry}
                  onChangeText={(value) => {
                    const digits = value.replace(/\D/g, "").slice(0, 4);
                    setCardExpiry(
                      digits.length > 2
                        ? `${digits.slice(0, 2)}/${digits.slice(2)}`
                        : digits,
                    );
                  }}
                  placeholder="12/30"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={5}
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={closeCardModal}
                    disabled={isSavingCard}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton]}
                    onPress={handleSaveCard}
                    disabled={isSavingCard}
                  >
                    {isSavingCard ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.saveButtonText}>
                        {editingCardId ? "Update card" : "Save card"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={selectedCard !== null}
        animationType={reducedMotion ? "none" : "fade"}
        transparent
        onRequestClose={() => setSelectedCard(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.cardActionContent}>
            <Text style={styles.cardActionTitle}>{selectedCard?.name}</Text>
            <Text style={styles.cardActionSubtitle}>
              {selectedCard?.type} card • •••• {selectedCard?.lastFour}
            </Text>
            <TouchableOpacity
              style={styles.cardActionEditButton}
              onPress={() => selectedCard && openEditCard(selectedCard)}
            >
              <Text style={styles.cardActionEditText}>Edit card</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cardActionDeleteButton}
              onPress={() => Alert.alert("Delete card summary", "Remove this summary? This will not alter transaction history.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: deleteSelectedCard }])}
            >
              <Text style={styles.cardActionDeleteText}>Delete card</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cardActionCancelButton}
              onPress={() => setSelectedCard(null)}
            >
              <Text style={styles.cardActionCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isEditModalVisible}
        animationType={reducedMotion ? "none" : "slide"}
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Personal Information</Text>

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={editForm.displayName}
              onChangeText={(text) =>
                setEditForm((prev) => ({
                  ...prev,
                  displayName: text.replace(/[0-9]/g, ""),
                }))
              }
              placeholder="Enter full name"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.inputLabel}>Email (Read-only)</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              value={profile.email}
              editable={false}
            />

            <Text style={styles.inputLabel}>Mobile Number (+63)</Text>
            <TextInput
              style={styles.input}
              value={editForm.phone}
              onChangeText={handlePhoneChange}
              placeholder="09XXXXXXXXX"
              keyboardType="number-pad"
              maxLength={11}
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.inputLabel}>Address</Text>
            <TextInput
              style={styles.input}
              value={editForm.address}
              onChangeText={(text) =>
                setEditForm((prev) => ({ ...prev, address: text }))
              }
              placeholder="Enter address"
              placeholderTextColor="#94a3b8"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsEditModalVisible(false)}
                disabled={isSaving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveProfile}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}