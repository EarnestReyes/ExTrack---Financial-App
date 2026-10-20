import { loanSchedule, summarize } from "../../domain/finance";
import { assertOwner, newId, owner } from "../access";
import { syncFromFirestore } from "../sync/syncService";
import type { CreditScoreMetrics } from "../types";
import { fetchLoansFromDB } from "./loanRepository";
import { save } from "./shared";
import { fetchTransactionsFromDB } from "./transactionRepository";

export async function fetchCreditScoreMetricsFromFirestore(): Promise<CreditScoreMetrics> {
  const uid = owner();
  await syncFromFirestore();
  assertOwner(uid);
  const entries = fetchTransactionsFromDB(), loans = fetchLoansFromDB(), summary = summarize(entries);
  const schedules = loans.map((loan) => loanSchedule(loan.firestoreId!, loan, entries)).filter((schedule) => schedule !== null);
  return { activeLoansCount: schedules.filter((s) => s.status === "Active").length, completedLoansCount: schedules.filter((s) => s.status === "Paid").length,
    paymentHistoryCount: entries.filter((entry) => entry.confirmedPayment).length, totalLoanAmount: 0, totalMonthlyPayments: 0,
    totalCurrentBalances: summary.expenses, totalCreditLimits: summary.income };
}

export async function saveCreditScoreToFirestore(userId: string, score: number, tier: string, paymentHistoryScore: number, creditUtilizationPct: number, isEstimated = true) {
  const uid = owner(); if (userId !== uid) throw new Error("Owner mismatch.");
  // Append a new estimate; do not overwrite an existing legacy/latest snapshot.
  save(uid, "credit_scores", newId(), { userId: uid, score, tier, paymentHistoryScore, creditUtilizationPct, isEstimated, updatedAt: new Date().toISOString() }, "INSERT");
}
