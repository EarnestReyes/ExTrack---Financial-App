import * as SQLite from "expo-sqlite";
import { collection, deleteDoc, doc, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { auth, db as firestoreDb } from "./config/firebase";// Adjust path to your firebase config file

const db = SQLite.openDatabaseSync("finance.db");

export interface TransactionItem {
  id?: number | string;
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

    // Auto-generate doc ID for instant insert
    const docRef = doc(userTransactionsRef);

    setDoc(docRef, {
      id: insertedId,
      name: transaction.name,
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category,
      date: transaction.date,
      time: transaction.time,
      createdAt: new Date().toISOString(),
    }).catch((error) => console.error("Error writing transaction to Firestore:", error));
  }

  return insertedId;
};

export const updateTransactionInDB = (transaction: TransactionItem) => {
  if (!transaction.id) return;
  initDatabase();

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
      transaction.id,
    ]
  );

  // 2. Update in Firebase Firestore
  const currentUser = auth.currentUser;
  if (currentUser) {
    const docRef = doc(
      firestoreDb,
      "users",
      currentUser.uid,
      "transactions",
      transaction.id.toString()
    );

    updateDoc(docRef, {
      name: transaction.name,
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category,
      date: transaction.date,
      time: transaction.time,
      updatedAt: new Date().toISOString(),
    }).catch((error) => console.error("Error updating transaction in Firestore:", error));
  }
};

export const deleteTransactionFromDB = (id: number | string) => {
  initDatabase();

  // 1. Delete from local SQLite
  db.runSync("DELETE FROM transactions WHERE id = ?", [id]);

  // 2. Delete from Firebase Firestore
  const currentUser = auth.currentUser;
  if (currentUser) {
    const docRef = doc(
      firestoreDb,
      "users",
      currentUser.uid,
      "transactions",
      id.toString()
    );

    deleteDoc(docRef).catch((error) =>
      console.error("Error deleting transaction from Firestore:", error)
    );
  }
};

// Batch Sync function to upload all existing local records to Firebase
export const syncLocalDataToFirebase = async (): Promise<boolean> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("Cannot sync: No authenticated user logged in.");
    return false;
  }

  const localTransactions = fetchTransactionsFromDB();
  if (localTransactions.length === 0) {
    return true;
  }

  try {
    const batch = writeBatch(firestoreDb);
    const userTransactionsRef = collection(
      firestoreDb,
      "users",
      currentUser.uid,
      "transactions"
    );

    localTransactions.forEach((transaction) => {
      // Calling doc() without a second argument forces an auto-generated random unique ID
      const docRef = doc(userTransactionsRef);

      batch.set(
        docRef,
        {
          id: transaction.id, // Keeps the local SQLite ID inside the document body
          name: transaction.name,
          amount: transaction.amount,
          type: transaction.type,
          category: transaction.category,
          date: transaction.date,
          time: transaction.time,
          syncedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    });

    await batch.commit();
    console.log("All local transactions successfully synced to Firebase!");
    return true;
  } catch (error) {
    console.error("Failed to batch sync local data to Firebase:", error);
    return false;
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