import * as SQLite from "expo-sqlite";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
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
      firestoreId TEXT,
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
      firestoreId TEXT,
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
      firestoreId TEXT,
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

export const insertTransactionToDB = (transaction: TransactionItem): number => {
  initDatabase();

  const result = db.runSync(
    "INSERT INTO transactions (firestoreId, loanId, name, amount, type, category, date, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      transaction.firestoreId || null,
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
  const currentUser = auth.currentUser;

  if (currentUser) {
    const userTransactionsRef = collection(
      firestoreDb,
      "users",
      currentUser.uid,
      "transactions"
    );

    const docRef = transaction.firestoreId
      ? doc(userTransactionsRef, transaction.firestoreId)
      : doc(userTransactionsRef);

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
      console.warn("Offline or failed sync writing transaction to Firestore:", error)
    );
  }

  return insertedId;
};

export const updateTransactionInDB = async (transaction: TransactionItem): Promise<void> => {
  if (!transaction.id) return;
  initDatabase();

  const numericId = Number(transaction.id);

  db.runSync(
    "UPDATE transactions SET name = ?, amount = ?, type = ?, category = ?, date = ?, time = ?, loanId = ? WHERE id = ?",
    [
      transaction.name,
      transaction.amount,
      transaction.type,
      transaction.category,
      transaction.date,
      transaction.time,
      transaction.loanId || null,
      numericId,
    ]
  );

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
    console.warn("Offline: Firestore transaction update postponed.", error);
  }
};

export const deleteTransactionFromDB = async (
  id: number | string,
  firestoreId?: string,
  loanId?: string | null
): Promise<void> => {
  initDatabase();

  const numericId = Number(id);

  if (!isNaN(numericId) && numericId > 0) {
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

    if (!isNaN(numericId) && numericId > 0) {
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
    console.warn("Offline: Firestore transaction deletion deferred.", error);
  }
};

// ==========================================
// Loan CRUD Functions
// ==========================================
export const fetchLoansFromDB = (): LoanItem[] => {
  initDatabase();
  return db.getAllSync<LoanItem>(
    "SELECT * FROM loans ORDER BY id DESC"
  );
};

export const insertLoanToDB = (loan: LoanItem): number => {
  initDatabase();

  const createdAt = loan.createdAt || new Date().toISOString();

  const result = db.runSync(
    "INSERT INTO loans (firestoreId, title, totalAmount, monthlyPayment, annualExpense, durationMonths, startDate, endDate, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      loan.firestoreId || null,
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

  if (currentUser) {
    const userLoansRef = collection(
      firestoreDb,
      "users",
      currentUser.uid,
      "loans"
    );

    const docRef = loan.firestoreId
      ? doc(userLoansRef, loan.firestoreId)
      : doc(userLoansRef);

    setDoc(docRef, {
      id: insertedId,
      title: loan.title,
      totalAmount: loan.totalAmount,
      monthlyPayment: loan.monthlyPayment,
      annualExpense: loan.annualExpense,
      durationMonths: loan.durationMonths,
      startDate: loan.startDate,
      endDate: loan.endDate,
      createdAt: createdAt,
    }).catch((error) =>
      console.warn("Offline or failed sync writing loan to Firestore:", error)
    );
  }

  return insertedId;
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
        for (const document of snapshot.docs) {
          await setDoc(
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
        }
      }
    }
  } catch (error) {
    console.warn("Offline: Firestore loan update deferred.", error);
  }
};

export const deleteLoanFromDB = async (
  id?: number | string,
  firestoreId?: string
): Promise<void> => {
  initDatabase();

  const numericId = id ? Number(id) : undefined;

  if (numericId && !isNaN(numericId) && numericId > 0) {
    db.runSync("DELETE FROM loans WHERE id = ?", [numericId]);
  }

  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const userPath = `users/${currentUser.uid}`;

  try {
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
  } catch (error) {
    console.warn("Offline: Firestore loan deletion deferred.", error);
  }
};

export const deleteMasterLoanFromDB = async (loanId: string): Promise<void> => {
  initDatabase();

  db.runSync("DELETE FROM transactions WHERE loanId = ?", [loanId]);
  db.runSync("DELETE FROM loans WHERE firestoreId = ? OR id = ?", [loanId, Number(loanId) || -1]);

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
    console.warn("Offline: Firestore master loan deletion postponed.", error);
  }
};

// ==========================================
// Profile Picture Functions
// ==========================================
export const setUserProfilePicture = async (profilePicUri: string): Promise<boolean> => {
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
      setDoc(
        userRef,
        {
          photoURL: profilePicUri,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      ).catch((err) => console.warn("Offline: Firestore photoURL sync skipped.", err));
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
      console.warn("Offline: Remote collection cleanup skipped on logout.", error);
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
      console.warn("Offline: Firestore cards deletion postponed.", error);
    }
  }
};

// ==========================================
// AUTOMATIC MONTHLY LOAN PAYMENTS
// ==========================================

export const processAutomaticLoanPayments = async (): Promise<void> => {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    console.log("No authenticated user. Loan payment check skipped.");
    return;
  }

  try {
    initDatabase();
    const userPath = `users/${currentUser.uid}`;
    const loansRef = collection(firestoreDb, userPath, "loans");
    const transactionsRef = collection(firestoreDb, userPath, "transactions");

    const loanSnapshot = await getDocs(loansRef);

    if (loanSnapshot.empty) {
      console.log("No loans found.");
      return;
    }

    const today = new Date();

    for (const loanDoc of loanSnapshot.docs) {
      const loan = loanDoc.data() as LoanItem;

      if (!loan.startDate) continue;

      const startDate = new Date(loan.startDate);
      if (isNaN(startDate.getTime())) {
        console.warn(`Invalid start date for loan ${loanDoc.id}`);
        continue;
      }

      // Explicitly pull totalAmount as the payment value
      const paymentAmount = Number(loan.totalAmount) || 0;
      const duration = Math.max(1, Number(loan.durationMonths) || 1);

      const paymentDay = startDate.getDate();
      const createdDate = loan.createdAt ? new Date(loan.createdAt) : startDate;

      let paymentDate = new Date(
        createdDate.getFullYear(),
        createdDate.getMonth(),
        paymentDay
      );

      if (paymentDate < createdDate) {
        paymentDate = new Date(
          createdDate.getFullYear(),
          createdDate.getMonth() + 1,
          paymentDay
        );
      }

      const endDate = loan.endDate
        ? new Date(loan.endDate)
        : new Date(
            startDate.getFullYear(),
            startDate.getMonth() + duration,
            paymentDay
          );

      let paymentIndex = 1;

      while (paymentDate <= today && paymentDate <= endDate) {
        const year = paymentDate.getFullYear();
        const month = String(paymentDate.getMonth() + 1).padStart(2, "0");
        const day = String(paymentDate.getDate()).padStart(2, "0");

        const paymentDateString = `${year}-${month}-${day}`;
        const paymentId = `${loanDoc.id}_${paymentDateString}`;

        // Local SQLite check to ensure idempotency
        const localExisting = db.getFirstSync<{ id: number }>(
          "SELECT id FROM transactions WHERE loanId = ? AND date = ? LIMIT 1",
          [loanDoc.id, paymentDateString]
        );

        if (localExisting) {
          console.log(`${loan.title}: Payment #${paymentIndex} (${paymentDateString}) already recorded locally.`);
          paymentIndex++;
          paymentDate = new Date(
            paymentDate.getFullYear(),
            paymentDate.getMonth() + 1,
            paymentDay
          );
          continue;
        }

        // Firestore check if missing locally
        const paymentRef = doc(transactionsRef, paymentId);
        const existingPayment = await getDoc(paymentRef);

        if (!existingPayment.exists()) {
          const paymentTime = paymentDate.toTimeString().slice(0, 5);

          const result = db.runSync(
            `INSERT INTO transactions
            (firestoreId, loanId, name, amount, type, category, date, time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              paymentId,
              loanDoc.id,
              `${loan.title} Loan Payment`,
              paymentAmount,
              "Expense",
              "Bills",
              paymentDateString,
              paymentTime,
            ]
          );

          const transaction = {
            id: result.lastInsertRowId,
            name: `${loan.title} Loan Payment`,
            amount: paymentAmount, // DEDUCTS FULL totalAmount
            type: "Expense",
            category: "Bills",
            date: paymentDateString,
            time: paymentTime,
            loanId: loanDoc.id,
            loanPaymentNumber: paymentIndex,
            automatic: true,
            loanPaymentDate: paymentDateString,
            createdAt: new Date().toISOString(),
          };

          await setDoc(paymentRef, transaction);

          console.log(
            `Created payment #${paymentIndex} for ${loan.title}: ₱${paymentAmount} on ${paymentDateString}`
          );
        } else {
          console.log(`${loan.title}: Payment #${paymentIndex} already exists in Firestore.`);
        }

        paymentIndex++;
        paymentDate = new Date(
          paymentDate.getFullYear(),
          paymentDate.getMonth() + 1,
          paymentDay
        );
      }
    }

    console.log("Loan payment check completed.");
  } catch (error) {
    console.error("Error processing automatic loan payments:", error);
  }
};