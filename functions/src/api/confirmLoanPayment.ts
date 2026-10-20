import {onCall, HttpsError} from "firebase-functions/v2/https";
import {protectedOptions} from "../config/options";
import {store} from "../config/firebase";
import {limit} from "../middleware/requestLimits";
import {paymentRequest, validCanonicalLoan} from "../utils/validation";

export const confirmLoanPayment = onCall(protectedOptions, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  let input;
  try {
    input = paymentRequest(request.data);
  } catch {
    throw new HttpsError("invalid-argument", "Invalid installment.");
  }
  const uid = request.auth.uid;
  await limit(uid, "payment", 20);
  const loanRef = store.doc("users/" + uid + "/loans/" + input.loanId);
  const installmentId = input.loanId + "_" + input.number;
  const transactionRef = store.doc("users/" + uid +
  "/transactions/payment_" + installmentId);
  return store.runTransaction(async (tx) => {
    const loan = (await tx.get(loanRef)).data();
    const existing = await tx.get(transactionRef);
    if (!loan || loan.ownerUid !== uid || !validCanonicalLoan(loan) ||
  input.number > loan.durationMonths) {
      throw new HttpsError(
        "failed-precondition",
        "This loan needs review before confirming payments.");
    }
    if (existing.exists) {
      const payment = existing.data();
      if (payment?.loanId !== input.loanId ||
  payment?.installmentId !== installmentId ||
        payment?.confirmedPayment !== true || payment?.ownerUid !== uid ||
        payment?.amountCentavos !== loan.installmentCentavos ||
        payment?.type !== "Expense") {
        throw new HttpsError(
          "failed-precondition", "Payment identifier needs review.");
      }
      return {transactionId: transactionRef.id, alreadyConfirmed: true};
    }
    const now = new Date();
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila", year: "numeric", month: "2-digit",
      day: "2-digit"}).format(now);
    tx.create(transactionRef, {ownerUid: uid, name: loan.title +
  " installment " + input.number,
    amount: loan.installmentCentavos / 100,
    amountCentavos: loan.installmentCentavos, type: "Expense",
    category: "Loan Repayment", date,
    time: new Intl.DateTimeFormat("en-GB", {timeZone: "Asia/Manila",
      hour: "2-digit", minute: "2-digit"}).format(now),
    loanId: input.loanId, installmentId, confirmedPayment: true,
    createdAt: now.toISOString()});
    return {transactionId: transactionRef.id, alreadyConfirmed: false};
  });
});
