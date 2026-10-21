import {onCall, HttpsError} from "firebase-functions/v2/https";
import {protectedOptions} from "../config/options";
import {geminiKey} from "../config/secrets";
import {limit} from "../middleware/requestLimits";
import {assertFreeAI, freeGemini} from "../services/freeGemini";

export const explainInsights = onCall({...protectedOptions, maxInstances: 1,
  secrets: [geminiKey]}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const data = request.data;
  const choices: Record<string, string[]> = {
    cashFlow: ["surplus", "deficit", "balanced"],
    spendingPattern: ["concentrated", "spread", "none"],
    savingsActivity: ["recorded", "none"],
    loanAttention: ["needed", "none"],
  };
  if (!data || data.consent !== true ||
      data.policyVersion !== "free-tier-v1" ||
      Object.keys(data).some((key) =>
        !["consent", "summary", "policyVersion"].includes(key)) ||
      !data.summary || typeof data.summary !== "object" ||
      Object.keys(data.summary).length !== 4 ||
      Object.entries(choices).some(([key, values]) =>
        !values.includes(data.summary[key]))) {
    throw new HttpsError("invalid-argument",
      "Explicit consent and a category-only summary are required.");
  }
  assertFreeAI();
  await limit(request.auth.uid, "insights", 5);
  const summary = Object.fromEntries(Object.keys(choices).map((key) =>
    [key, data.summary[key]]));
  return freeGemini(request.auth.uid,
    "Explain these qualitative labels from ExTrack's local deterministic " +
    "ledger summary in a short friendly paragraph. You receive no amounts " +
    "or records. Do not calculate, invent numbers, infer identities, give " +
    "personal financial advice or claim to verify bank balances. Surplus " +
    "means recorded income exceeded expenses, not confirmed savings. " +
    "SavingsActivity refers to categorized expense entries, not bank " +
    "savings. LoanAttention means due/overdue unconfirmed installments; " +
    "never imply payment or perform an action. Direct the user to the " +
    "verified on-screen figures and manual confirmation where relevant.",
    [{role: "user", parts: [{text: JSON.stringify(summary)}]}]);
});
