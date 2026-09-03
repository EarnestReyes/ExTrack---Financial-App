import { auth, db } from "@/config/firebase";
import * as ImagePicker from "expo-image-picker";
import * as LocalAuthentication from "expo-local-authentication";
import { useFocusEffect, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  fetchTransactionsFromDB,
  getThemePreference,
  setThemePreference,
  TransactionItem,
} from "../../database";
import { useAuth } from "../_layout";

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
}

interface SavedCard {
  id: string;
  name: string;
  type: string;
  lastFour: string;
  expiry: string;
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

  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === "dark");
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
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<SavedCard | null>(null);

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
  const currentUser = auth.currentUser;

  useFocusEffect(
    useCallback(() => {
      const savedTheme = getThemePreference();
      if (savedTheme !== null) {
        setIsDarkMode(savedTheme === "dark");
      } else {
        setIsDarkMode(systemColorScheme === "dark");
      }
    }, [systemColorScheme]),
  );

  const handleDarkModeToggle = (value: boolean) => {
    setIsDarkMode(value);
    setThemePreference(value ? "dark" : "light");
  };

  const handlePickImage = async () => {
    if (!currentUser) return;

    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Denied",
        "Permission to access gallery is required!",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.2, // Reduced quality to keep Base64 well within Firestore 1MB document limit
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
        console.error("Error saving profile picture:", error);
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

    const userDocRef = doc(db, "users", currentUser.uid);
    const accountsColRef = collection(db, "users", currentUser.uid, "accounts");
    const cardsColRef = collection(db, "users", currentUser.uid, "cards");

    const unsubscribeUser = onSnapshot(
      userDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfile((prev) => ({
            ...prev,
            displayName:
              data.displayName ?? currentUser.displayName ?? prev.displayName,
            email: data.email ?? currentUser.email ?? prev.email,
            phone: data.phone ?? currentUser.phoneNumber ?? prev.phone,
            address: data.address ?? prev.address,
            photoURL: data.photoURL ?? currentUser.photoURL ?? prev.photoURL,
            tier: data.tier ?? prev.tier,
            isBiometricEnabled:
              data.isBiometricEnabled ?? prev.isBiometricEnabled,
            isNotificationEnabled:
              data.isNotificationEnabled ?? prev.isNotificationEnabled,
            birthdate: data.birthdate ?? prev.birthdate,
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
        console.error("Error fetching user document:", error);
        setLoading(false);
      },
    );

    const unsubscribeAccounts = onSnapshot(
      accountsColRef,
      (snapshot) => {
        const fetchedAccounts: Account[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          name: docSnap.data().name || "Account",
          type: docSnap.data().type || "Savings",
          balance: docSnap.data().balance || 0,
        }));
        setAccounts(fetchedAccounts);
      },
      (error) => {
        console.error("Error fetching accounts:", error);
      },
    );

    const unsubscribeCards = onSnapshot(
      cardsColRef,
      (snapshot) => {
        const savedCards: SavedCard[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          name: docSnap.data().name || "Card",
          type: docSnap.data().type || "Debit",
          lastFour: docSnap.data().lastFour || "",
          expiry: docSnap.data().expiry || "",
        }));
        setCards(savedCards);
      },
      (error) => {
        console.error("Error fetching cards:", error);
      },
    );

    return () => {
      unsubscribeUser();
      unsubscribeAccounts();
      unsubscribeCards();
    };
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
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePreference = async (
    field: keyof UserProfile,
    value: boolean,
  ) => {
    if (!currentUser) return;

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
          "This device does not have a supported biometric sensor.",
        );
        return;
      }

      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        Alert.alert(
          "Biometrics Not Set Up",
          "Set up Face ID or a fingerprint on your device before enabling this option.",
        );
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Confirm biometric security for ExTrack",
        cancelLabel: "Cancel",
        fallbackLabel: "Use Passcode",
      });

      if (result.success) {
        await handleTogglePreference("isBiometricEnabled", true);
      }
    } catch (error) {
      console.error("Biometric authentication failed:", error);
      Alert.alert(
        "Biometric Error",
        "Biometric authentication is unavailable right now.",
      );
    }
  };

  const handleAction = (title: string) => {
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
    Alert.alert(title, `Navigating to ${title}...`);
  };

  const closeCardModal = () => {
    setIsCardModalVisible(false);
    setEditingCardId(null);
    setCardName("");
    setCardType("Debit");
    setCardLastFour("");
    setCardExpiry("");
  };

  const handleSaveCard = async () => {
    if (!currentUser) return;
    const cleanLastFour = cardLastFour.replace(/\D/g, "");
    if (
      !cardName.trim() ||
      cleanLastFour.length !== 4 ||
      !/^\d{2}\/\d{2}$/.test(cardExpiry)
    ) {
      Alert.alert(
        "Incomplete card details",
        "Enter a card name, exactly four ending digits, and expiry in MM/YY format.",
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
      };
      if (editingCardId) {
        await updateDoc(
          doc(db, "users", currentUser.uid, "cards", editingCardId),
          cardData,
        );
      } else {
        await addDoc(collection(db, "users", currentUser.uid, "cards"), {
          ...cardData,
          createdAt: new Date().toISOString(),
        });
      }
      closeCardModal();
      Alert.alert(
        editingCardId ? "Card updated" : "Card added",
        "Your card summary was saved successfully.",
      );
    } catch (error) {
      console.error("Error saving card:", error);
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
    setSelectedCard(null);
    setIsCardModalVisible(true);
  };

  const deleteSelectedCard = async () => {
    if (!currentUser || !selectedCard) return;
    try {
      await deleteDoc(
        doc(db, "users", currentUser.uid, "cards", selectedCard.id),
      );
      setSelectedCard(null);
    } catch (error) {
      console.error("Error deleting card:", error);
      Alert.alert("Error", "Unable to delete this card right now.");
    }
  };

  const openAnalytics = () => {
    setTransactions(fetchTransactionsFromDB());
    setAnalyticsVisible(true);
  };

  const analyticsToday = new Date();
  analyticsToday.setHours(0, 0, 0, 0);
  const analyticsStart = new Date(analyticsToday);
  if (analyticsPeriod === "Week")
    analyticsStart.setDate(analyticsToday.getDate() - 6);
  if (analyticsPeriod === "Month") analyticsStart.setDate(1);
  if (analyticsPeriod === "Year") analyticsStart.setMonth(0, 1);

  const analyticsTransactions = transactions.filter((transaction) => {
    const [year, month, day] = transaction.date.split("-").map(Number);
    const transactionDate = new Date(year, month - 1, day);
    return (
      transactionDate >= analyticsStart && transactionDate <= analyticsToday
    );
  });
  const analyticsIncome = analyticsTransactions
    .filter((transaction) => transaction.type === "Income")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const analyticsExpenses = analyticsTransactions
    .filter((transaction) => transaction.type === "Expense")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const analyticsCategories = analyticsTransactions.reduce<
    Record<string, number>
  >((totals, transaction) => {
    if (transaction.type === "Expense") {
      totals[transaction.category] =
        (totals[transaction.category] || 0) + transaction.amount;
    }
    return totals;
  }, {});
  const topCategories = Object.entries(analyticsCategories)
    .sort(([, firstAmount], [, secondAmount]) => secondAmount - firstAmount)
    .slice(0, 5);
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

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "left", "right", "bottom"]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* HEADER / PROFILE CARD */}
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
              style={styles.editAvatarBadge}
              onPress={handlePickImage}
              disabled={isUploadingImage}
            >
              {isUploadingImage ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.editAvatarText}>📷</Text>
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
            <Text style={styles.tierBadgeText}>✨ {profile.tier}</Text>
          </View>
        </View>

        {/* QUICK ACTIONS */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleAction("Send Money")}
          >
            <View
              style={[
                styles.actionIconContainer,
                { backgroundColor: "#e0e7ff" },
              ]}
            >
              <Text style={styles.actionIcon}>↗</Text>
            </View>
            <Text style={styles.actionLabel}>Send</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleAction("Receive Money")}
          >
            <View
              style={[
                styles.actionIconContainer,
                { backgroundColor: "#dcfce7" },
              ]}
            >
              <Text style={styles.actionIcon}>↘</Text>
            </View>
            <Text style={styles.actionLabel}>Receive</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleAction("Manage Cards")}
          >
            <View
              style={[
                styles.actionIconContainer,
                { backgroundColor: "#fef3c7" },
              ]}
            >
              <Text style={styles.actionIcon}>💳</Text>
            </View>
            <Text style={styles.actionLabel}>Cards</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={openAnalytics}>
            <View
              style={[
                styles.actionIconContainer,
                { backgroundColor: "#f3e8ff" },
              ]}
            >
              <Text style={styles.actionIcon}>📊</Text>
            </View>
            <Text style={styles.actionLabel}>Analytics</Text>
          </TouchableOpacity>
        </View>

        {/* ACCOUNTS OVERVIEW */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Accounts & Cards</Text>
          {accounts.length > 0 || cards.length > 0 ? (
            accounts
              .map((acc) => (
                <TouchableOpacity key={acc.id} style={styles.accountCard}>
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
              ))
              .concat(
                cards.map((card) => (
                  <TouchableOpacity
                    key={card.id}
                    style={styles.accountCard}
                    onPress={() => setSelectedCard(card)}
                    activeOpacity={0.75}
                    accessibilityLabel={`Open actions for ${card.name}`}
                  >
                    <View style={styles.accountCardHeader}>
                      <Text style={styles.accountCardName}>{card.name}</Text>
                      <Text style={styles.accountCardType}>
                        {card.type} card
                      </Text>
                    </View>
                    <Text style={styles.accountBalance}>
                      •••• {card.lastFour}
                    </Text>
                    <Text style={styles.accountCardType}>
                      Expires {card.expiry}
                    </Text>
                  </TouchableOpacity>
                )),
              )
          ) : (
            <View style={styles.accountCard}>
              <Text style={styles.accountCardName}>
                No linked accounts found.
              </Text>
            </View>
          )}
        </View>

        {/* PREFERENCES & SECURITY */}
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
                onValueChange={(val) =>
                  handleTogglePreference("isNotificationEnabled", val)
                }
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

        {/* ACCOUNT DETAILS */}
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

        {/* LOGOUT BUTTON */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={analyticsVisible}
        animationType="slide"
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
        animationType="slide"
        transparent
        onRequestClose={closeCardModal}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardAvoidingView}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add card</Text>
              <Text style={styles.cardFormHint}>
                For your security, only the card summary is stored. Never enter
                your PIN or CVV.
              </Text>

              <Text style={styles.inputLabel}>Card name</Text>
              <TextInput
                style={styles.input}
                value={cardName}
                onChangeText={(value) =>
                  setCardName(value.replace(/[0-9]/g, ""))
                }
                placeholder="e.g. Main debit card"
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
                keyboardType="default"
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
                    <Text style={styles.saveButtonText}>Save card</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={selectedCard !== null}
        animationType="fade"
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
              onPress={deleteSelectedCard}
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

      {/* EDIT PROFILE MODAL */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
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

const createStyles = (isDarkMode: boolean) => {
  const backgroundColor = isDarkMode ? "#0f172a" : "#f8fafc";
  const cardColor = isDarkMode ? "#1e293b" : "#ffffff";
  const textColor = isDarkMode ? "#f8fafc" : "#0f172a";
  const secondaryTextColor = isDarkMode ? "#94a3b8" : "#64748b";
  const borderColor = isDarkMode ? "#334155" : "#e2e8f0";

  return StyleSheet.create({
    container: { flex: 1, backgroundColor },
    centerContent: { justifyContent: "center", alignItems: "center" },
    scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 },
    profileHeader: { alignItems: "center", marginBottom: 20 },
    avatarContainer: { position: "relative", marginBottom: 10 },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: "#1e3a8a",
      justifyContent: "center",
      alignItems: "center",
    },
    avatarImage: { width: 80, height: 80, borderRadius: 40 },
    avatarText: { color: "#ffffff", fontSize: 28, fontWeight: "bold" },
    editAvatarBadge: {
      position: "absolute",
      bottom: 0,
      right: 0,
      backgroundColor: "#3b82f6",
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: backgroundColor,
    },
    editAvatarText: { color: "#ffffff", fontSize: 12 },
    userName: { fontSize: 20, fontWeight: "700", color: textColor },
    userEmail: { fontSize: 13, color: secondaryTextColor, marginTop: 2 },
    userPhone: { fontSize: 13, color: secondaryTextColor, marginTop: 2 },
    tierBadge: {
      marginTop: 8,
      backgroundColor: isDarkMode ? "#312e81" : "#e0e7ff",
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 20,
    },
    tierBadgeText: {
      color: isDarkMode ? "#a5b4fc" : "#4338ca",
      fontSize: 12,
      fontWeight: "600",
    },
    quickActionsContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: cardColor,
      padding: 16,
      borderRadius: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor,
    },
    actionButton: { alignItems: "center", flex: 1 },
    actionIconContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 6,
    },
    actionIcon: { fontSize: 18 },
    actionLabel: { fontSize: 12, fontWeight: "600", color: textColor },
    sectionContainer: { marginBottom: 20 },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: textColor,
      marginBottom: 10,
    },
    accountCard: {
      backgroundColor: cardColor,
      borderRadius: 16,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor,
    },
    accountCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    accountCardName: { fontSize: 14, fontWeight: "600", color: textColor },
    accountCardType: { fontSize: 12, color: secondaryTextColor },
    accountBalance: { fontSize: 18, fontWeight: "bold", color: textColor },
    settingCard: {
      backgroundColor: cardColor,
      borderRadius: 16,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor,
    },
    settingRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
    },
    settingInfo: { flex: 1 },
    settingTitle: { fontSize: 14, fontWeight: "600", color: textColor },
    settingSubtitle: { fontSize: 12, color: secondaryTextColor, marginTop: 2 },
    menuRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 14,
    },
    menuText: { fontSize: 14, fontWeight: "600", color: textColor },
    menuArrow: { fontSize: 18, color: secondaryTextColor },
    divider: { height: 1, backgroundColor: borderColor },
    logoutButton: {
      backgroundColor: "#ef444415",
      borderWidth: 1,
      borderColor: "#ef444440",
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 4,
    },
    logoutButtonText: { color: "#ef4444", fontSize: 15, fontWeight: "700" },
    analyticsOverlay: {
      flex: 1,
      backgroundColor: "rgba(15, 23, 42, 0.58)",
      justifyContent: "flex-end",
    },
    analyticsContent: {
      backgroundColor: backgroundColor,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 32,
      maxHeight: "88%",
    },
    analyticsHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 18,
    },
    analyticsTitle: { fontSize: 24, fontWeight: "800", color: textColor },
    analyticsSubtitle: {
      fontSize: 13,
      color: secondaryTextColor,
      marginTop: 3,
    },
    analyticsCloseButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: cardColor,
      alignItems: "center",
      justifyContent: "center",
    },
    analyticsCloseText: {
      fontSize: 24,
      color: secondaryTextColor,
      lineHeight: 26,
    },
    analyticsPeriodContainer: {
      flexDirection: "row",
      backgroundColor: cardColor,
      borderRadius: 11,
      padding: 4,
      marginBottom: 16,
    },
    analyticsPeriodButton: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 9,
      borderRadius: 8,
    },
    analyticsPeriodActive: { backgroundColor: "#3b82f6" },
    analyticsPeriodText: {
      fontSize: 13,
      fontWeight: "600",
      color: secondaryTextColor,
    },
    analyticsPeriodTextActive: { color: "#ffffff" },
    analyticsSummaryRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
    analyticsMetricCard: {
      flex: 1,
      backgroundColor: cardColor,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor,
    },
    analyticsMetricLabel: {
      fontSize: 12,
      color: secondaryTextColor,
      marginBottom: 5,
    },
    analyticsIncome: { fontSize: 19, fontWeight: "800", color: "#16a34a" },
    analyticsExpense: { fontSize: 19, fontWeight: "800", color: "#dc2626" },
    analyticsNetCard: {
      backgroundColor: cardColor,
      borderRadius: 14,
      padding: 14,
      marginBottom: 20,
      borderWidth: 1,
      borderColor,
    },
    analyticsHint: { fontSize: 12, color: secondaryTextColor, marginTop: 4 },
    analyticsSectionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: textColor,
      marginBottom: 12,
    },
    categoryRow: { marginBottom: 12 },
    categoryRowHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    categoryRowName: { fontSize: 13, color: textColor, fontWeight: "600" },
    categoryRowAmount: {
      fontSize: 13,
      color: secondaryTextColor,
      fontWeight: "600",
    },
    categoryTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: isDarkMode ? "#334155" : "#e2e8f0",
      overflow: "hidden",
    },
    categoryBar: {
      height: "100%",
      borderRadius: 4,
      backgroundColor: "#3b82f6",
    },
    analyticsEmpty: {
      color: secondaryTextColor,
      fontSize: 13,
      marginBottom: 8,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
    },
    keyboardAvoidingView: {
      width: "100%",
    },
    cardActionContent: {
      width: "100%",
      backgroundColor: cardColor,
      borderRadius: 18,
      padding: 20,
      borderWidth: 1,
      borderColor,
    },
    cardActionTitle: {
      color: textColor,
      fontSize: 19,
      fontWeight: "700",
      marginBottom: 5,
    },
    cardActionSubtitle: {
      color: secondaryTextColor,
      fontSize: 13,
      marginBottom: 18,
    },
    cardActionEditButton: {
      backgroundColor: isDarkMode ? "#1e3a8a" : "#eff6ff",
      borderColor: isDarkMode ? "#2563eb" : "#bfdbfe",
      borderWidth: 1,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: "center",
      marginBottom: 10,
    },
    cardActionEditText: {
      color: isDarkMode ? "#bfdbfe" : "#1d4ed8",
      fontSize: 14,
      fontWeight: "700",
    },
    cardActionDeleteButton: {
      backgroundColor: isDarkMode ? "#7f1d1d" : "#fff1f2",
      borderColor: isDarkMode ? "#ef4444" : "#fecdd3",
      borderWidth: 1,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: "center",
      marginBottom: 10,
    },
    cardActionDeleteText: {
      color: isDarkMode ? "#fecaca" : "#be123c",
      fontSize: 14,
      fontWeight: "700",
    },
    cardActionCancelButton: {
      paddingVertical: 11,
      alignItems: "center",
    },
    cardActionCancelText: {
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
    cardFormHint: {
      color: secondaryTextColor,
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 14,
    },
    cardTypeRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 12,
    },
    cardTypeButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 9,
      alignItems: "center",
      backgroundColor: isDarkMode ? "#0f172a" : "#f1f5f9",
      borderWidth: 1,
      borderColor,
    },
    cardTypeButtonActive: {
      backgroundColor: "#dbeafe",
      borderColor: "#3b82f6",
    },
    cardTypeText: {
      color: secondaryTextColor,
      fontSize: 13,
      fontWeight: "600",
    },
    cardTypeTextActive: {
      color: "#1d4ed8",
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
      marginBottom: 12,
      borderWidth: 1,
      borderColor,
    },
    readOnlyInput: { opacity: 0.6 },
    modalActions: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 10,
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
    cancelButtonText: { color: textColor, fontWeight: "600" },
    saveButton: { backgroundColor: "#3b82f6", marginLeft: 8 },
    saveButtonText: { color: "#ffffff", fontWeight: "600" },
  });
};
