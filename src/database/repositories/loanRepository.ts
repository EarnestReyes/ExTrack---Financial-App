import { getFunctions, httpsCallable } from "firebase/functions";
import { isCanonicalLoan } from "../../domain/finance";
import { app, auth } from "../../services/firebase/client";
import { assertOwner, newId, owner } from "../access";
import { syncFromFirestore } from "../sync/syncService";
import type { LoanItem } from "../types";
import { readOwned } from "./ownedRecordRepository";
import { save } from "./shared";

export const fetchLoansFromDB = () => readOwned<LoanItem>(auth.currentUser?.uid, "loans").map((loan) => isCanonicalLoan(loan) ? { ...loan, totalAmount: loan.principalCentavos / 100, monthlyPayment: loan.installmentCentavos / 100, annualExpense: 0 } : loan);

export async function insertLoanToDB(loan: LoanItem) {
  const uid = owner();
  if (!loan.title.trim() || !isCanonicalLoan(loan)) throw new Error("Enter principal, installment, duration and payment dates.");
  const id = newId();
  return save(uid, "loans", id, { ownerUid: uid, schemaVersion: 2, title: loan.title.trim(), principalCentavos: loan.principalCentavos,
    installmentCentavos: loan.installmentCentavos, durationMonths: loan.durationMonths, startDate: loan.startDate,
    dueDay: loan.dueDay, firstDueDate: loan.firstDueDate, endDate: loan.endDate, createdAt: new Date().toISOString() }, "INSERT");
}

export async function updateLoanInDB(_loan: LoanItem): Promise<void> { throw new Error("Loan changes require review; historical amounts will not be reinterpreted."); }

export async function deleteLoanFromDB(_id?: number | string, _firestoreId?: string): Promise<void> { throw new Error("Loan deletion is disabled during data preservation."); }

export async function deleteMasterLoanFromDB(_id: string): Promise<void> { throw new Error("Financial history deletion is disabled."); }

export async function confirmLoanInstallment(loanId: string, number: number) {
  const uid = owner();
  await syncFromFirestore();
  assertOwner(uid);
  try { await httpsCallable(getFunctions(app), "confirmLoanPayment", { timeout: 30000 })({ loanId, number }); }
  catch { throw new Error("Payment was not confirmed locally. Check connectivity and service setup, then refresh before retrying. Retrying the same installment is safe."); }
  assertOwner(uid);
  await syncFromFirestore();
}
