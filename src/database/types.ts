import type { CanonicalLoan, LedgerEntry } from "../domain/finance";

export interface TransactionItem extends LedgerEntry {}

export interface LoanItem extends Partial<CanonicalLoan> {
  id?: number; firestoreId?: string; ownerUid?: string; title: string;
  totalAmount: number; monthlyPayment: number; annualExpense: number;
  durationMonths: number; startDate: string; endDate: string; createdAt?: string;
}

export interface SavedCard { id?: number; firestoreId?: string; ownerUid?: string; name: string; type: string; lastFour: string; expiry: string; amount?: number; createdAt?: string }

export interface CreditScoreMetrics { activeLoansCount: number; completedLoansCount: number; paymentHistoryCount: number; totalLoanAmount: number; totalMonthlyPayments: number; totalCurrentBalances: number; totalCreditLimits: number }

export type SyncState = "idle" | "syncing" | "pending" | "error";

export type Entity = "transactions" | "loans" | "cards" | "user_profile" | "credit_scores";
export interface StoredRow { ownerUid: string; entity: Entity; firestoreId: string; payload: string; deleted: number; dirty: number }
export interface PendingWrite { id: number; ownerUid: string; entity: Entity; firestoreId: string; action: "INSERT" | "UPDATE" | "DELETE"; payload: string }
