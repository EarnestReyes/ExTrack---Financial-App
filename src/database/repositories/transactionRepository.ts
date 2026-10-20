import { moneyToCentavos, validDate } from "../../domain/finance";
import { auth } from "../../services/firebase/client";
import { newId, owner } from "../access";
import type { TransactionItem } from "../types";
import { readOwned } from "./ownedRecordRepository";
import { ownedRecord, save } from "./shared";

export const fetchTransactionsFromDB = () => readOwned<TransactionItem>(auth.currentUser?.uid, "transactions");

function transactionPayload(transaction: TransactionItem, uid: string) {
  if (transaction.ownerUid && transaction.ownerUid !== uid) throw new Error("Record owner mismatch.");
  if (!transaction.name.trim() || !transaction.category.trim() || !validDate(transaction.date) || !["Income", "Expense", "Transfer", "Opening Balance"].includes(transaction.type)) throw new Error("Check transaction details.");
  const amountCentavos = moneyToCentavos(transaction.amount);
  return { ownerUid: uid, name: transaction.name.trim(), category: transaction.category, amountCentavos,
    amount: amountCentavos / 100, type: transaction.type, date: transaction.date, time: transaction.time,
    loanId: transaction.loanId || null, updatedAt: new Date().toISOString() };
}

export async function insertTransactionToDB(transaction: TransactionItem) {
  const uid = owner(), id = newId();
  return save(uid, "transactions", id, { ...transactionPayload(transaction, uid), createdAt: new Date().toISOString() }, "INSERT");
}

export async function updateTransactionInDB(transaction: TransactionItem) {
  const uid = owner();
  const previous = ownedRecord<TransactionItem>("transactions", transaction.firestoreId);
  if (previous.confirmedPayment) throw new Error("Confirmed loan payments require reconciliation and cannot be edited here.");
  const payload = transactionPayload({ ...transaction, loanId: previous.loanId }, uid);
  save(uid, "transactions", previous.firestoreId!, { ...previous, ...payload,
    _expectedUpdatedAt: (previous as TransactionItem & {updatedAt?: string}).updatedAt || null }, "UPDATE");
}

export async function deleteTransactionFromDB(_id?: number | string, firestoreId?: string, _loanId?: string | null) {
  const row = ownedRecord<TransactionItem>("transactions", firestoreId);
  if (row.confirmedPayment) throw new Error("Confirmed payments cannot be deleted here. Request reconciliation.");
  save(owner(), "transactions", row.firestoreId!, { ...row }, "DELETE");
}
