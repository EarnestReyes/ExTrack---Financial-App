import { auth } from "../services/firebase/client";
import { ownedDatabase } from "./connection";

export const initDatabase = () => { if (auth.currentUser) ownedDatabase(auth.currentUser.uid); };

export async function clearAllDataAndDatabase(): Promise<void> { throw new Error("Cache clearing must not delete financial records."); }

export { getCurrentUser } from "./access";
export * from "./repositories/cardRepository";
export * from "./repositories/creditScoreRepository";
export * from "./repositories/loanRepository";
export * from "./repositories/profileRepository";
export * from "./repositories/settingsRepository";
export * from "./repositories/transactionRepository";
export { subscribeFinancialData } from "./sync/events";
export * from "./sync/syncService";
export * from "./types";
