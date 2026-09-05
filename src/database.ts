import * as SQLite from "expo-sqlite";
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

// Single SQLite Database Instance
const db = SQLite.openDatabaseSync("finance.db");

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

// Single Initialization Function
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
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      lastFour TEXT NOT NULL,
      expiry TEXT NOT NULL
    );
  `);
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
): Promise<{ id: number; firestoreId?: string }> => {
  initDatabase();

  const result = db.runSync(
    "INSERT INTO transactions (name, amount, type, category, date, time) VALUES (?, ?, ?, ?, ?, ?)",
    [
      transaction.name,
      transaction.amount,
      transaction.type,
      transaction.category,
      transaction.date,
      transaction.time,
    ]
  );

  const insertedId = result.lastInsertRowId;
  const currentUser = auth.currentUser;
  let firestoreId: string | undefined;

  if (currentUser) {
    try {
      const userTransactionsRef = collection(
        firestoreDb,
        "users",
        currentUser.uid,
        "transactions"
      );

      const docRef = doc(userTransactionsRef);
      firestoreId = docRef.id;

      await setDoc(docRef, {
        id: insertedId,
        name: transaction.name,
        amount: transaction.amount,
        type: transaction.type,
        category: transaction.category,
        date: transaction.date,
        time: transaction.time,
        loanId: transaction.loanId || null,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error writing transaction to Firestore:", error);
    }
  }

  return { id: insertedId, firestoreId };
};

export const updateTransactionInDB = async (
  transaction: TransactionItem
): Promise<void> => {
  if (!transaction.id && !transaction.firestoreId) return;
  initDatabase();

  const numericId = transaction.id ? Number(transaction.id) : null;

  // 1. Update in local SQLite
  if (numericId) {
    db.runSync(
      "UPDATE transactions SET name = ?, amount = ?, type = ?, category = ?, date = ?, time = ? WHERE id = ?",
      [
        transaction.name,
        transaction.amount,
        transaction.type,
        transaction.category,
        transaction.date,
        transaction.time,
        numericId,
      ]
    );
  }

  // 2. Update in Firebase Firestore
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  try {
    const transactionsRef = collection(
      firestoreDb,
      "users",
      currentUser.uid,
      "transactions"
    );

    if (transaction.firestoreId) {
      const docRef = doc(transactionsRef, transaction.firestoreId);
      await setDoc(
        docRef,
        {
          name: transaction.name,
          amount: transaction.amount,
          type: transaction.type,
          category: transaction.category,
          date: transaction.date,
          time: transaction.time,
          loanId: transaction.loanId || null,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } else if (numericId) {
      const q = query(transactionsRef, where("id", "==", numericId));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const batch = writeBatch(firestoreDb);
        snapshot.forEach((document) => {
          batch.set(
            document.ref,
            {
              name: transaction.name,
              amount: transaction.amount,
              type: transaction.type,
              category: transaction.category,
              date: transaction.date,
              time: transaction.time,
              loanId: transaction.loanId || null,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        });
        await batch.commit();
      }
    }
  } catch (error) {
    console.error("Error updating transaction in Firestore:", error);
  }
};

export const deleteTransactionFromDB = async (
  id?: number | string,
  firestoreId?: string,
  loanId?: string | null
): Promise<void> => {
  initDatabase();

  const numericId = id ? Number(id) : undefined;

  if (numericId && !isNaN(numericId) && numericId > 0) {
    db.runSync("DELETE FROM transactions WHERE id = ?", [numericId]);
  }

  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const userPath = `users/${currentUser.uid}`;

  try {
    if (firestoreId) {
      const txRef = doc(firestoreDb, userPath, "transactions", firestoreId);
      await deleteDoc(txRef);
      return;
    }

    if (numericId && !isNaN(numericId) && numericId > 0) {
      const transactionsRef = collection(firestoreDb, userPath, "transactions");
      const q = query(transactionsRef, where("id", "==", numericId));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const batch = writeBatch(firestoreDb);
        snapshot.forEach((docSnap) => batch.delete(docSnap.ref));
        await batch.commit();
      }
    }
  } catch (error) {
    console.error("Error deleting record from Firestore:", error);
    throw error;
  }
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
): Promise<{ id: number; firestoreId?: string }> => {
  initDatabase();

  const createdAt = loan.createdAt || new Date().toISOString();

  const result = db.runSync(
    "INSERT INTO loans (title, totalAmount, monthlyPayment, annualExpense, durationMonths, startDate, endDate, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
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
  const currentUser = auth.currentUser;
  let firestoreId: string | undefined;

  if (currentUser) {
    try {
      const userLoansRef = collection(
        firestoreDb,
        "users",
        currentUser.uid,
        "loans"
      );

      const docRef = doc(userLoansRef);
      firestoreId = docRef.id;

      await setDoc(docRef, {
        id: insertedId,
        title: loan.title,
        totalAmount: loan.totalAmount,
        monthlyPayment: loan.monthlyPayment,
        annualExpense: loan.annualExpense,
        durationMonths: loan.durationMonths,
        startDate: loan.startDate,
        endDate: loan.endDate,
        createdAt: createdAt,
      });
    } catch (error) {
      console.error("Error writing loan to Firestore:", error);
    }
  }

  return { id: insertedId, firestoreId };
};

export const updateLoanInDB = async (loan: LoanItem): Promise<void> => {
  if (!loan.id && !loan.firestoreId) return;
  initDatabase();

  const numericId = loan.id ? Number(loan.id) : null;

  if (numericId) {
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
        numericId,
      ]
    );
  }

  const currentUser = auth.currentUser;
  if (!currentUser) return;

  try {
    const loansRef = collection(
      firestoreDb,
      "users",
      currentUser.uid,
      "loans"
    );

    if (loan.firestoreId) {
      const docRef = doc(loansRef, loan.firestoreId);
      await setDoc(
        docRef,
        {
          title: loan.title,
          totalAmount: loan.totalAmount,
          monthlyPayment: loan.monthlyPayment,
          annualExpense: loan.annualExpense,
          durationMonths: loan.durationMonths,
          startDate: loan.startDate,
          endDate: loan.endDate,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } else if (numericId) {
      const q = query(loansRef, where("id", "==", numericId));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const batch = writeBatch(firestoreDb);
        snapshot.forEach((document) => {
          batch.set(
            document.ref,
            {
              title: loan.title,
              totalAmount: loan.totalAmount,
              monthlyPayment: loan.monthlyPayment,
              annualExpense: loan.annualExpense,
              durationMonths: loan.durationMonths,
              startDate: loan.startDate,
              endDate: loan.endDate,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        });
        await batch.commit();
      }
    }
  } catch (error) {
    console.error("Error updating loan in Firestore:", error);
  }
};

export const deleteLoanFromDB = async (
  id?: number | string,
  firestoreId?: string
): Promise<void> => {
  initDatabase();

  const numericId = id ? Number(id) : undefined;

  try {
    if (numericId && !isNaN(numericId) && numericId > 0) {
      db.runSync("DELETE FROM loans WHERE id = ?", [numericId]);
    }

    const currentUser = auth.currentUser;
    if (currentUser) {
      const userPath = `users/${currentUser.uid}`;

      if (firestoreId) {
        const loanRef = doc(firestoreDb, userPath, "loans", firestoreId);
        await deleteDoc(loanRef);
      } else if (numericId && !isNaN(numericId) && numericId > 0) {
        const loansRef = collection(firestoreDb, userPath, "loans");
        const q = query(loansRef, where("id", "==", numericId));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const batch = writeBatch(firestoreDb);
          snapshot.forEach((docSnap) => batch.delete(docSnap.ref));
          await batch.commit();
        }
      }
    }
  } catch (error) {
    console.error("Error executing delete loan query:", error);
    throw error;
  }
};

export const deleteMasterLoanFromDB = async (loanId: string): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const userPath = `users/${currentUser.uid}`;

  try {
    const transactionsRef = collection(firestoreDb, userPath, "transactions");
    const paymentQuery = query(transactionsRef, where("loanId", "==", loanId));
    const paymentSnapshot = await getDocs(paymentQuery);

    const batch = writeBatch(firestoreDb);
    paymentSnapshot.forEach((docSnap) => batch.delete(docSnap.ref));

    const loanRef = doc(firestoreDb, userPath, "loans", loanId);
    batch.delete(loanRef);

    await batch.commit();
  } catch (error) {
    console.error("Error deleting master loan:", error);
    throw error;
  }
};

// ==========================================
// Profile Picture Functions
// ==========================================
export const setUserProfilePicture = async (
  profilePicUri: string
): Promise<boolean> => {
  try {
    initDatabase();

    db.runSync(
      `INSERT INTO user_profile (id, profilePic)
       VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET profilePic = excluded.profilePic;`,
      [profilePicUri]
    );

    const currentUser = auth.currentUser;
    if (currentUser) {
      const userRef = doc(firestoreDb, "users", currentUser.uid);
      await setDoc(
        userRef,
        {
          photoURL: profilePicUri,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }

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
    if (!rawPic) return null;

    if (
      rawPic.startsWith("http://") ||
      rawPic.startsWith("https://") ||
      rawPic.startsWith("file://") ||
      rawPic.startsWith("data:image/")
    ) {
      return rawPic;
    }

    return `data:image/jpeg;base64,${rawPic}`;
  } catch (error) {
    console.error("Error fetching profile picture from DB:", error);
    return null;
  }
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

  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      const userPath = `users/${currentUser.uid}`;
      const collectionsToDelete = ["transactions", "cards", "loans"];

      for (const colName of collectionsToDelete) {
        const colRef = collection(firestoreDb, userPath, colName);
        const snapshot = await getDocs(colRef);

        if (!snapshot.empty) {
          const batch = writeBatch(firestoreDb);
          snapshot.forEach((docSnap) => batch.delete(docSnap.ref));
          await batch.commit();
        }
      }
    } catch (error) {
      console.error("Error clearing Firestore collections on logout:", error);
    }
  }
};

// ==========================================
// Card CRUD Functions
// ==========================================
export const clearCardsFromDB = async (): Promise<void> => {
  initDatabase();

  db.runSync("DELETE FROM cards;");

  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      const cardsRef = collection(
        firestoreDb,
        "users",
        currentUser.uid,
        "cards"
      );
      const snapshot = await getDocs(cardsRef);

      if (!snapshot.empty) {
        const batch = writeBatch(firestoreDb);
        snapshot.forEach((docSnap) => batch.delete(docSnap.ref));
        await batch.commit();
      }
    } catch (error) {
      console.error("Error clearing cards from Firestore:", error);
      throw error;
    }
  }
};