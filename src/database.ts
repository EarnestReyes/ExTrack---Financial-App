import * as SQLite from "expo-sqlite";

const db = SQLite.openDatabaseSync("finance.db");

export interface TransactionItem {
  id?: number;
  name: string;
  amount: number;
  type: string;
  category: string;
  date: string;
  time: string;
}

export const initDatabase = () => {
  // Create user_profile table if it doesn't exist
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
    ["theme"],
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

// Transaction CRUD Functions
export const fetchTransactionsFromDB = (): TransactionItem[] => {
  initDatabase();
  return db.getAllSync<TransactionItem>(
    "SELECT * FROM transactions ORDER BY id DESC",
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
    ],
  );
  return result.lastInsertRowId;
};

export const updateTransactionInDB = (transaction: TransactionItem) => {
  if (!transaction.id) return;
  initDatabase();
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
    ],
  );
};

export const deleteTransactionFromDB = (id: number) => {
  initDatabase();
  db.runSync("DELETE FROM transactions WHERE id = ?", [id]);
};

// Add to database.ts
export const getUserProfilePicture = (): string | null => {
  try {
    const result = db.getFirstSync<{ profilePic: string }>(
      "SELECT profilePic FROM user_profile WHERE id = 1;",
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
    [uri],
  );
};
