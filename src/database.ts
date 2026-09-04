import * as SQLite from "expo-sqlite";
import {
  collection,
  deleteDoc,
  doc,
  setDoc,
  writeBatch,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { auth, db as firestoreDb } from "./config/firebase";

const db = SQLite.openDatabaseSync("finance.db");

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

export const initDatabase = () => {
  // Create user_profile, settings, and transactions tables if they don't exist
  db.execSync(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY DEFAULT 1,
      profilePic TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "transaction" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL
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
    INSERT INTO transactions (id, name, amount, type, category, date, time)
    SELECT old.id, old.name, old.amount, old.type, old.category, old.date, old.time
    FROM "transaction" AS old
    WHERE NOT EXISTS (
      SELECT 1 FROM transactions AS current WHERE current.id = old.id
    );
    DROP TABLE IF EXISTS "transaction";
  `);
};

// Theme Preference Functions
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

// Transaction CRUD Functions with Firebase Synchronization
export const fetchTransactionsFromDB = (): TransactionItem[] => {
  initDatabase();
  return db.getAllSync<TransactionItem>(
    "SELECT * FROM transactions ORDER BY id DESC"
  );
};

export const insertTransactionToDB = (transaction: TransactionItem): number => {
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

  if (currentUser) {
    const userTransactionsRef = collection(
      firestoreDb,
      "users",
      currentUser.uid,
      "transactions"
    );

    const docRef = doc(userTransactionsRef);

    setDoc(docRef, {
      id: insertedId,
      name: transaction.name,
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category,
      date: transaction.date,
      time: transaction.time,
      loanId: transaction.loanId || null,
      createdAt: new Date().toISOString(),
    }).catch((error) =>
      console.error("Error writing transaction to Firestore:", error)
    );
  }

  return insertedId;
};

export const updateTransactionInDB = async (transaction: TransactionItem): Promise<void> => {
  if (!transaction.id) return;
  initDatabase();

  const numericId = Number(transaction.id);

  // 1. Update in local SQLite
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

    // If firestoreId is provided, update directly; otherwise query by numeric field 'id'
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
    } else {
      const q = query(transactionsRef, where("id", "==", numericId));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        for (const document of snapshot.docs) {
          await setDoc(
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
        }
      } else {
        // Fallback: If document doesn't exist in Firestore, create it using setDoc
        const docRef = doc(transactionsRef);
        await setDoc(
          docRef,
          {
            id: numericId,
            name: transaction.name,
            amount: transaction.amount,
            type: transaction.type,
            category: transaction.category,
            date: transaction.date,
            time: transaction.time,
            loanId: transaction.loanId || null,
            createdAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    }
  } catch (error) {
    console.error("Error updating transaction in Firestore:", error);
  }
};

export const deleteTransactionFromDB = async (
  id: number | string,
  firestoreId?: string,
  loanId?: string | null
): Promise<void> => {
  initDatabase();

  const numericId = Number(id);

  if (!numericId) {
    console.error("Invalid transaction ID:", id);
    return;
  }

  // 1. Delete from local SQLite
  db.runSync("DELETE FROM transactions WHERE id = ?", [numericId]);

  // 2. Handle Firestore Deletion
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  try {
    // If the transaction is linked to a loan, delete strictly from the loans collection
    if (loanId) {
      const loanRef = doc(
        firestoreDb,
        "users",
        currentUser.uid,
        "loans",
        loanId
      );
      await deleteDoc(loanRef);
      console.log(`Loan ${loanId} deleted from Firestore loans collection.`);
      return;
    }

    // Otherwise, delete from the transactions collection
    if (firestoreId) {
      const txRef = doc(
        firestoreDb,
        "users",
        currentUser.uid,
        "transactions",
        firestoreId
      );
      await deleteDoc(txRef);
    } else {
      const transactionsRef = collection(
        firestoreDb,
        "users",
        currentUser.uid,
        "transactions"
      );
      const q = query(transactionsRef, where("id", "==", numericId));
      const snapshot = await getDocs(q);

      const batch = writeBatch(firestoreDb);
      snapshot.forEach((document) => {
        batch.delete(document.ref);
      });
      await batch.commit();
    }

    console.log(`Transaction ${numericId} deleted successfully.`);
  } catch (error) {
    console.error("Error deleting record from Firestore:", error);
  }
};

// Profile Picture Functions
export const getUserProfilePicture = (): string | null => {
  try {
    const result = db.getFirstSync<{ profilePic: string }>(
      "SELECT profilePic FROM user_profile WHERE id = 1;"
    );
    return result?.profilePic || null;
  } catch (error) {
    console.error("Error fetching profile picture from DB:", error);
    return null;
  }
};

export const setUserProfilePicture = (uri: string): void => {
  db.runSync(
    "INSERT OR REPLACE INTO user_profile (id, profilePic) VALUES (1, ?);",
    [uri]
  );
};