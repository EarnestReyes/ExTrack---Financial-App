import * as SQLite from "expo-sqlite";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db as firestoreDb } from "./config/firebase";
import { onAuthStateChanged, User } from "firebase/auth";

// Single SQLite Database Instance
export const db = SQLite.openDatabaseSync("extrack.db");

// TypeScript Interfaces
export interface TransactionItem {
  id?: number;
  firestoreId?: string;
  loanId?: string | null;
  name: string;
  amount: number;
  type: string;
  category: string;
  date: string;
  time: string;
  userId?: string;
}

interface CreditScoreModalProps {
  visible: boolean;
  onClose: () => void;
  creditScore?: number; // e.g. 720 (Range: 300 to 850)
  paymentHistoryCount?: number;
  activeLoansCount?: number;
  creditUtilizationPct?: number;
}

export interface LoanItem {
  id?: number;
  firestoreId?: string;
  title: string;
  totalAmount: number;
  monthlyPayment: number;
  annualExpense: number;
  durationMonths: number;
  startDate: string;
  endDate: string;
  createdAt?: string;
}

export interface SavedCard {
  id: string;
  firestoreId?: string;
  name: string;
  type: string;
  lastFour: string;
  expiry: string;
}

export interface SyncTask {
  id: number;
  action: "INSERT" | "UPDATE" | "DELETE";
  entity: "transactions" | "loans" | "user_profile" | "cards";
  firestoreId: string;
  payload: string; // JSON String
  createdAt: string;
}

// ==========================================
// Authentication Resolver
// ==========================================
export const getCurrentUser = (): Promise<User | null> => {
  return new Promise((resolve) => {
    if (auth.currentUser) {
      return resolve(auth.currentUser);
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
};

// ==========================================
// Initialization Function
// ==========================================
export const initDatabase = () => {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY DEFAULT 1,
      profilePic TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firestoreId TEXT UNIQUE,
      loanId TEXT,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firestoreId TEXT UNIQUE,
      title TEXT NOT NULL,
      totalAmount REAL NOT NULL,
      monthlyPayment REAL NOT NULL,
      annualExpense REAL NOT NULL,
      durationMonths INTEGER NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY NOT NULL,
      firestoreId TEXT UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      lastFour TEXT NOT NULL,
      expiry TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      firestoreId TEXT NOT NULL,
      payload TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS credit_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      tier TEXT NOT NULL, -- 'Excellent', 'Good', 'Fair', 'Poor'
      payment_history_score INTEGER,
      credit_utilization_pct REAL,
      is_estimated INTEGER DEFAULT 0, -- 1 if computed offline, 0 if fetched from bureau
      updated_at TEXT NOT NULL
    );
  `);
};

// ==========================================
// Sync Queue Management
// ==========================================
const enqueueSyncTask = (
  action: "INSERT" | "UPDATE" | "DELETE",
  entity: "transactions" | "loans" | "user_profile" | "cards",
  firestoreId: string,
  payload: any = {}
) => {
  initDatabase();
  db.runSync(
    "INSERT INTO sync_queue (action, entity, firestoreId, payload, createdAt) VALUES (?, ?, ?, ?, ?)",
    [
      action,
      entity,
      firestoreId,
      JSON.stringify(payload),
      new Date().toISOString(),
    ]
  );
};

export const processSyncQueue = async (): Promise<void> => {
  initDatabase();
  const user = await getCurrentUser();
  if (!user) return;

  const tasks = db.getAllSync<SyncTask>(
    "SELECT * FROM sync_queue ORDER BY id ASC"
  );
  if (tasks.length === 0) return;

  for (const task of tasks) {
    try {
      const payload = task.payload ? JSON.parse(task.payload) : {};
      const userPath = `users/${user.uid}`;

      if (task.entity === "user_profile") {
        if (task.action === "UPDATE") {
          const userRef = doc(firestoreDb, "users", user.uid);
          await setDoc(userRef, payload, { merge: true });
        }
      } else {
        const docRef = doc(firestoreDb, userPath, task.entity, task.firestoreId);
        if (task.action === "INSERT" || task.action === "UPDATE") {
          await setDoc(docRef, payload, { merge: true });
        } else if (task.action === "DELETE") {
          await deleteDoc(docRef);
        }
      }

      // Remove task on successful execution
      db.runSync("DELETE FROM sync_queue WHERE id = ?", [task.id]);
    } catch (error) {
      console.warn(`Sync queue execution deferred for item ${task.id}:`, error);
      break; // Halt processing until next online reconnect
    }
  }
};

const safeFirestoreWrite = async (
  action: "INSERT" | "UPDATE" | "DELETE",
  entity: "transactions" | "loans" | "user_profile" | "cards",
  firestoreId: string,
  payload: any,
  operation: () => Promise<void>
): Promise<void> => {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    enqueueSyncTask(action, entity, firestoreId, payload);
    return;
  }

  try {
    await operation();
  } catch (error) {
    console.warn("Offline or network drop. Queuing operation for background sync:", error);
    enqueueSyncTask(action, entity, firestoreId, payload);
  }
};

// ==========================================
// Pull Remote Data Operations
// ==========================================
export const syncFromFirestore = async (): Promise<void> => {
  initDatabase();
  const user = await getCurrentUser();
  if (!user) return;

  // Process outbound sync queue prior to pulling latest state
  await processSyncQueue();

  try {
    const userPath = `users/${user.uid}`;

    // Pull Transactions
    const txSnapshot = await getDocs(collection(firestoreDb, userPath, "transactions"));
    txSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      db.runSync(
        `INSERT INTO transactions (firestoreId, loanId, name, amount, type, category, date, time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(firestoreId) DO UPDATE SET
            loanId=excluded.loanId, name=excluded.name, amount=excluded.amount,
            type=excluded.type, category=excluded.category, date=excluded.date, time=excluded.time`,
        [
          docSnap.id,
          data.loanId || null,
          data.name,
          data.amount,
          data.type,
          data.category,
          data.date,
          data.time,
        ]
      );
    });

    // Pull Loans
    const loanSnapshot = await getDocs(collection(firestoreDb, userPath, "loans"));
    loanSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      db.runSync(
        `INSERT INTO loans (firestoreId, title, totalAmount, monthlyPayment, annualExpense, durationMonths, startDate, endDate, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(firestoreId) DO UPDATE SET
            title=excluded.title, totalAmount=excluded.totalAmount, monthlyPayment=excluded.monthlyPayment,
            annualExpense=excluded.annualExpense, durationMonths=excluded.durationMonths,
            startDate=excluded.startDate, endDate=excluded.endDate`,
        [
          docSnap.id,
          data.title,
          data.totalAmount,
          data.monthlyPayment,
          data.annualExpense,
          data.durationMonths,
          data.startDate,
          data.endDate,
          data.createdAt || new Date().toISOString(),
        ]
      );
    });
  } catch (error) {
    console.warn("Pull sync skipped due to network connection:", error);
  }
};

// ==========================================
// Theme Preference Functions
// ==========================================
export const getThemePreference = (): string | null => {
  initDatabase();
  const result = db.getFirstSync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    ["theme"]
  );
  return result ? result.value : null;
};

export const setThemePreference = (theme: string) => {
  initDatabase();
  db.runSync("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [
    "theme",
    theme,
  ]);
};

// ==========================================
// Transaction CRUD Functions
// ==========================================
export const fetchTransactionsFromDB = (): TransactionItem[] => {
  initDatabase();
  return db.getAllSync<TransactionItem>(
    "SELECT * FROM transactions ORDER BY id DESC"
  );
};

export const insertTransactionToDB = async (
  transaction: TransactionItem
): Promise<{ id: number; firestoreId: string }> => {
  initDatabase();
  const user = await getCurrentUser();

  // Pre-generate Firestore ID offline or online
  const collectionRef = collection(
    firestoreDb,
    "users",
    user?.uid || "pending",
    "transactions"
  );
  const firestoreId = transaction.firestoreId || doc(collectionRef).id;

  const result = db.runSync(
    "INSERT INTO transactions (firestoreId, loanId, name, amount, type, category, date, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      firestoreId,
      transaction.loanId || null,
      transaction.name,
      transaction.amount,
      transaction.type,
      transaction.category,
      transaction.date,
      transaction.time,
    ]
  );

  const insertedId = result.lastInsertRowId;
  const payload = {
    id: insertedId,
    name: transaction.name,
    amount: transaction.amount,
    type: transaction.type,
    category: transaction.category,
    date: transaction.date,
    time: transaction.time,
    loanId: transaction.loanId || null,
    createdAt: new Date().toISOString(),
  };

  await safeFirestoreWrite("INSERT", "transactions", firestoreId, payload, async () => {
    if (!user) return;
    const docRef = doc(firestoreDb, "users", user.uid, "transactions", firestoreId);
    await setDoc(docRef, payload);
  });

  return { id: insertedId, firestoreId };
};

export const updateTransactionInDB = async (
  transaction: TransactionItem
): Promise<void> => {
  if (!transaction.id && !transaction.firestoreId) return;
  initDatabase();

  let firestoreId = transaction.firestoreId;

  if (transaction.id && !firestoreId) {
    const row = db.getFirstSync<{ firestoreId: string }>(
      "SELECT firestoreId FROM transactions WHERE id = ?",
      [transaction.id]
    );
    if (row?.firestoreId) firestoreId = row.firestoreId;
  }

  if (transaction.id) {
    db.runSync(
      "UPDATE transactions SET name = ?, amount = ?, type = ?, category = ?, date = ?, time = ? WHERE id = ?",
      [
        transaction.name,
        transaction.amount,
        transaction.type,
        transaction.category,
        transaction.date,
        transaction.time,
        transaction.id,
      ]
    );
  }

  if (!firestoreId) return;

  const payload = {
    name: transaction.name,
    amount: transaction.amount,
    type: transaction.type,
    category: transaction.category,
    date: transaction.date,
    time: transaction.time,
    loanId: transaction.loanId || null,
    updatedAt: new Date().toISOString(),
  };

  await safeFirestoreWrite("UPDATE", "transactions", firestoreId, payload, async () => {
    const user = await getCurrentUser();
    if (!user) return;
    const docRef = doc(firestoreDb, "users", user.uid, "transactions", firestoreId);
    await setDoc(docRef, payload, { merge: true });
  });
};

export const deleteTransactionFromDB = async (
  id?: number | string,
  firestoreId?: string,
  loanId?: string | null
): Promise<void> => {
  initDatabase();

  let targetFirestoreId = firestoreId;

  if (id && !targetFirestoreId) {
    const row = db.getFirstSync<{ firestoreId: string }>(
      "SELECT firestoreId FROM transactions WHERE id = ?",
      [Number(id)]
    );
    if (row?.firestoreId) targetFirestoreId = row.firestoreId;
  }

  if (id) {
    db.runSync("DELETE FROM transactions WHERE id = ?", [Number(id)]);
  }

  if (!targetFirestoreId) return;

  await safeFirestoreWrite("DELETE", "transactions", targetFirestoreId, {}, async () => {
    const user = await getCurrentUser();
    if (!user) return;
    const txRef = doc(firestoreDb, `users/${user.uid}/transactions`, targetFirestoreId);
    await deleteDoc(txRef);
  });
};

// ==========================================
// Loan CRUD Functions
// ==========================================
export const fetchLoansFromDB = (): LoanItem[] => {
  initDatabase();
  return db.getAllSync<LoanItem>("SELECT * FROM loans ORDER BY id DESC");
};

export const insertLoanToDB = async (
  loan: LoanItem
): Promise<{ id: number; firestoreId: string }> => {
  initDatabase();
  const user = await getCurrentUser();
  const createdAt = loan.createdAt || new Date().toISOString();

  const collectionRef = collection(firestoreDb, "users", user?.uid || "pending", "loans");
  const firestoreId = loan.firestoreId || doc(collectionRef).id;

  const result = db.runSync(
    "INSERT INTO loans (firestoreId, title, totalAmount, monthlyPayment, annualExpense, durationMonths, startDate, endDate, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      firestoreId,
      loan.title,
      loan.totalAmount,
      loan.monthlyPayment,
      loan.annualExpense,
      loan.durationMonths,
      loan.startDate,
      loan.endDate,
      createdAt,
    ]
  );

  const insertedId = result.lastInsertRowId;
  const payload = {
    id: insertedId,
    title: loan.title,
    totalAmount: loan.totalAmount,
    monthlyPayment: loan.monthlyPayment,
    annualExpense: loan.annualExpense,
    durationMonths: loan.durationMonths,
    startDate: loan.startDate,
    endDate: loan.endDate,
    createdAt: createdAt,
  };

  await safeFirestoreWrite("INSERT", "loans", firestoreId, payload, async () => {
    if (!user) return;
    const docRef = doc(firestoreDb, "users", user.uid, "loans", firestoreId);
    await setDoc(docRef, payload);
  });

  return { id: insertedId, firestoreId };
};

export const updateLoanInDB = async (loan: LoanItem): Promise<void> => {
  if (!loan.id && !loan.firestoreId) return;
  initDatabase();

  let firestoreId = loan.firestoreId;
  if (loan.id && !firestoreId) {
    const row = db.getFirstSync<{ firestoreId: string }>(
      "SELECT firestoreId FROM loans WHERE id = ?",
      [loan.id]
    );
    if (row?.firestoreId) firestoreId = row.firestoreId;
  }

  if (loan.id) {
    db.runSync(
      "UPDATE loans SET title = ?, totalAmount = ?, monthlyPayment = ?, annualExpense = ?, durationMonths = ?, startDate = ?, endDate = ? WHERE id = ?",
      [
        loan.title,
        loan.totalAmount,
        loan.monthlyPayment,
        loan.annualExpense,
        loan.durationMonths,
        loan.startDate,
        loan.endDate,
        loan.id,
      ]
    );
  }

  if (!firestoreId) return;

  const payload = {
    title: loan.title,
    totalAmount: loan.totalAmount,
    monthlyPayment: loan.monthlyPayment,
    annualExpense: loan.annualExpense,
    durationMonths: loan.durationMonths,
    startDate: loan.startDate,
    endDate: loan.endDate,
    updatedAt: new Date().toISOString(),
  };

  await safeFirestoreWrite("UPDATE", "loans", firestoreId, payload, async () => {
    const user = await getCurrentUser();
    if (!user) return;
    const docRef = doc(firestoreDb, "users", user.uid, "loans", firestoreId);
    await setDoc(docRef, payload, { merge: true });
  });
};

export const deleteLoanFromDB = async (
  id?: number | string,
  firestoreId?: string
): Promise<void> => {
  initDatabase();

  let targetFirestoreId = firestoreId;
  if (id && !targetFirestoreId) {
    const row = db.getFirstSync<{ firestoreId: string }>(
      "SELECT firestoreId FROM loans WHERE id = ?",
      [Number(id)]
    );
    if (row?.firestoreId) targetFirestoreId = row.firestoreId;
  }

  if (id) {
    db.runSync("DELETE FROM loans WHERE id = ?", [Number(id)]);
  }

  if (!targetFirestoreId) return;

  await safeFirestoreWrite("DELETE", "loans", targetFirestoreId, {}, async () => {
    const user = await getCurrentUser();
    if (!user) return;
    const loanRef = doc(firestoreDb, `users/${user.uid}/loans`, targetFirestoreId);
    await deleteDoc(loanRef);
  });
};

export const deleteMasterLoanFromDB = async (loanId: string): Promise<void> => {
  initDatabase();

  const transactions = db.getAllSync<{ firestoreId: string }>(
    "SELECT firestoreId FROM transactions WHERE loanId = ?",
    [loanId]
  );

  db.runSync("DELETE FROM transactions WHERE loanId = ?", [loanId]);
  db.runSync("DELETE FROM loans WHERE firestoreId = ? OR id = ?", [
    loanId,
    Number(loanId) || -1,
  ]);

  for (const tx of transactions) {
    if (tx.firestoreId) {
      await deleteTransactionFromDB(undefined, tx.firestoreId);
    }
  }

  await deleteLoanFromDB(undefined, loanId);
};

// ==========================================
// Profile Picture Functions
// ==========================================
export const setUserProfilePicture = async (
  profilePicUri: string
): Promise<boolean> => {
  try {
    initDatabase();

    // 1. Persist locally to SQLite first
    db.runSync(
      `INSERT INTO user_profile (id, profilePic)
       VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET profilePic = excluded.profilePic;`,
      [profilePicUri]
    );

    const payload = {
      photoURL: profilePicUri,
      updatedAt: new Date().toISOString(),
    };

    // 2. Safe Firestore Write (Handles online sync & offline queue automatically)
    await safeFirestoreWrite(
      "UPDATE",
      "user_profile",
      "profile",
      payload,
      async () => {
        const user = await getCurrentUser();
        if (!user) return;
        
        const userRef = doc(firestoreDb, "users", user.uid);
        await setDoc(userRef, payload, { merge: true });
      }
    );

    return true;
  } catch (error) {
    console.error("Error setting profile picture in DB:", error);
    return false;
  }
};

export const getUserProfilePicture = (): string | null => {
  try {
    initDatabase();

    const result = db.getFirstSync<{ profilePic: string }>(
      "SELECT profilePic FROM user_profile WHERE id = 1 LIMIT 1;"
    );

    const rawPic = result?.profilePic?.trim();

    if (rawPic) {
      if (
        rawPic.startsWith("http://") ||
        rawPic.startsWith("https://") ||
        rawPic.startsWith("file://") ||
        rawPic.startsWith("content://") ||
        rawPic.startsWith("ph://") ||
        rawPic.startsWith("data:image/")
      ) {
        return rawPic;
      }
      return `data:image/jpeg;base64,${rawPic}`;
    }
  } catch (error) {
    console.error("Error fetching profile picture from DB:", error);
  }

  return null; // Return null if no profile image exists
};

export const getInitials = (
  displayName?: string | null,
  email?: string | null
): string => {
  if (displayName?.trim()) {
    const parts = displayName.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }

  if (email?.trim()) {
    return email.trim().slice(0, 2).toUpperCase();
  }

  return "U";
};

// ==========================================
// Clear Local & Remote Data
// ==========================================
export const clearAllDataAndDatabase = async () => {
  initDatabase();

  db.execSync("DELETE FROM transactions;");
  db.execSync("DELETE FROM loans;");
  db.execSync("DELETE FROM user_profile;");
  db.execSync("DELETE FROM settings;");
  db.execSync("DELETE FROM cards;");
  db.execSync("DELETE FROM sync_queue;");

  const user = await getCurrentUser();
  if (!user) return;

  try {
    const userPath = `users/${user.uid}`;
    const collectionsToDelete = ["transactions", "cards", "loans"];

    for (const colName of collectionsToDelete) {
      const colRef = collection(firestoreDb, userPath, colName);
      const snapshot = await getDocs(colRef);

      if (!snapshot.empty) {
        const docs = snapshot.docs;
        for (let i = 0; i < docs.length; i += 500) {
          const batch = writeBatch(firestoreDb);
          const chunk = docs.slice(i, i + 500);
          chunk.forEach((docSnap) => batch.delete(docSnap.ref));
          await batch.commit();
        }
      }
    }
  } catch (error) {
    console.warn("Remote database clear deferred (network offline):", error);
  }
};

// ==========================================
// Card CRUD Functions
// ==========================================
export const clearCardsFromDB = async (): Promise<void> => {
  initDatabase();

  db.runSync("DELETE FROM cards;");

  const user = await getCurrentUser();
  if (!user) return;

  try {
    const cardsRef = collection(firestoreDb, "users", user.uid, "cards");
    const snapshot = await getDocs(cardsRef);

    if (!snapshot.empty) {
      const batch = writeBatch(firestoreDb);
      snapshot.forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();
    }
  } catch (error) {
    console.warn("Remote card clear deferred (network offline):", error);
  }
};

export interface CreditScoreMetrics {
  activeLoansCount: number;
  completedLoansCount: number;
  paymentHistoryCount: number;
  totalLoanAmount: number;
  totalMonthlyPayments: number;
}

// ==========================================
// Firestore Credit Score Operations
// ==========================================

// ==========================================
// Firestore Credit Score Operations
// ==========================================

export const fetchCreditScoreMetricsFromFirestore = async (): Promise<CreditScoreMetrics> => {
  const user = await getCurrentUser();
  if (!user) {
    return {
      activeLoansCount: 0,
      completedLoansCount: 0,
      paymentHistoryCount: 0,
      totalLoanAmount: 0,
      totalMonthlyPayments: 0,
    };
  }

  const userPath = `users/${user.uid}`;
  // Use YYYY-MM-DD string comparison to accurately match date-only strings like "2026-09-05"
  const todayStr = new Date().toISOString().split("T")[0];

  try {
    // 1. Fetch Loans Collection
    const loansRef = collection(firestoreDb, userPath, "loans");
    const loansSnapshot = await getDocs(loansRef);

    let activeLoansCount = 0;
    let completedLoansCount = 0;
    let totalLoanAmount = 0;
    let totalMonthlyPayments = 0;

    loansSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const amount = Number(data.totalAmount) || 0;
      const monthly = Number(data.monthlyPayment) || 0;
      const endDate = data.endDate;

      // Active if endDate is today/future or not set
      const isActive = !endDate || endDate >= todayStr;

      if (isActive) {
        activeLoansCount++;
        totalLoanAmount += amount;
        totalMonthlyPayments += monthly;
      } else {
        completedLoansCount++;
      }
    });

    // 2. Fetch All Transactions (Avoid Firestore query case-sensitivity & null-field drops)
    const txRef = collection(firestoreDb, userPath, "transactions");
    const txSnapshot = await getDocs(txRef);

    let paymentHistoryCount = 0;

    txSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      
      const txType = String(data.type || "").toLowerCase();
      const category = String(data.category || "").toLowerCase();
      const loanId = data.loanId;

      // Filter strictly for Expense type (handles "Expense" vs "expense")
      if (txType === "expense") {
        const hasValidLoanId = loanId !== null && loanId !== undefined && loanId !== "" && loanId !== "null";
        const isRepaymentCategory =
          category.includes("loan") ||
          category.includes("repayment") ||
          category.includes("debt") ||
          category.includes("food"); // Add custom category fallbacks if needed

        if (hasValidLoanId || isRepaymentCategory) {
          paymentHistoryCount++;
        }
      }
    });

    return {
      activeLoansCount,
      completedLoansCount,
      paymentHistoryCount,
      totalLoanAmount,
      totalMonthlyPayments,
    };
  } catch (error) {
    console.error("Error fetching credit metrics from Firestore:", error);
    return {
      activeLoansCount: 0,
      completedLoansCount: 0,
      paymentHistoryCount: 0,
      totalLoanAmount: 0,
      totalMonthlyPayments: 0,
    };
  }
};

export const saveCreditScoreToFirestore = async (
  userId: string,
  score: number,
  tier: string,
  paymentHistoryScore: number,
  creditUtilizationPct: number,
  isEstimated: boolean = true
): Promise<void> => {
  initDatabase();
  const timestamp = new Date().toISOString();

  // 1. Persist locally in SQLite
  db.runSync(
    `INSERT INTO credit_scores (user_id, score, tier, payment_history_score, credit_utilization_pct, is_estimated, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      score,
      tier,
      paymentHistoryScore,
      creditUtilizationPct,
      isEstimated ? 1 : 0,
      timestamp,
    ]
  );

  // 2. Persist snapshot to Firestore
  const payload = {
    userId,
    score,
    tier,
    paymentHistoryScore,
    creditUtilizationPct,
    isEstimated,
    updatedAt: timestamp,
  };

  const scoreDocRef = doc(firestoreDb, `users/${userId}/credit_scores`, "latest");

  await safeFirestoreWrite("UPDATE", "user_profile", "credit_scores", payload, async () => {
    await setDoc(scoreDocRef, payload, { merge: true });
  });
};

// ==========================================
// Network Listener Initialization
// ==========================================

// PLACE THIS AT THE VERY BOTTOM OF database.ts
NetInfo.addEventListener((state: NetInfoState) => {
  if (state.isConnected) {
    syncFromFirestore();
  }
});
