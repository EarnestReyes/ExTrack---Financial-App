import { getFunctions, httpsCallable } from "firebase/functions";
import { getToken, type AppCheck } from "firebase/app-check";
import { app, auth } from "../firebase/client";

export const supportUsesWorker = process.env.EXPO_PUBLIC_AI_TRANSPORT === "worker";
const transportReady = !supportUsesWorker || process.env.EXPO_PUBLIC_WORKER_AI_VERIFIED === "true";
const freeAIReleaseEnabled = process.env.EXPO_PUBLIC_FREE_AI_RELEASE_ENABLED === "true";
export const supportChatEnabled = transportReady && freeAIReleaseEnabled && process.env.EXPO_PUBLIC_SUPPORT_CHAT_ENABLED === "true";
export const financialInsightsAIEnabled = transportReady && freeAIReleaseEnabled && process.env.EXPO_PUBLIC_AI_INSIGHTS_ENABLED === "true";
let pausedUntil = 0;
let workerAppCheck: AppCheck | null = null;
/** Register only an App Check instance initialized with a real platform provider. */
export function registerWorkerAppCheck(instance: AppCheck) {
  if (instance.app.name !== app.name || instance.app.options.appId !== app.options.appId) throw new Error("App Check project mismatch.");
  workerAppCheck = instance;
}
export interface SupportMessage { role: "user" | "model"; text: string }

async function callAI(operation: "supportChat" | "explainInsights", payload: object): Promise<string> {
  if (Date.now() < pausedUntil) throw new Error("AI usage is paused until tomorrow. Offline summaries and Help still work.");
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to use AI.");
  try {
    let data: { text?: unknown };
    if (supportUsesWorker) {
      const base = process.env.EXPO_PUBLIC_AI_WORKER_URL ?? "";
      // Restrict this preparation to the free workers.dev HTTPS endpoint; never accept user-supplied URLs.
      if (!/^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev\/?$/.test(base)) throw new Error("Worker URL not configured.");
      const idToken = await user.getIdToken();
      // Must already be initialized by a real platform App Check integration. No debug/bypass fallback.
      if (!workerAppCheck) {
        const { initializeWorkerAppCheck } = await import('../firebase/workerAppCheck');
        registerWorkerAppCheck(await initializeWorkerAppCheck());
      }
      const instance = workerAppCheck;
      if (!instance) throw new Error('Device attestation unavailable.');
      const appCheckToken = await getToken(instance);
      if (!appCheckToken.token || auth.currentUser?.uid !== user.uid) throw new Error("Account or attestation unavailable.");
      const response = await fetch(base.replace(/\/$/, "") + "/" + operation, {
        method: "POST", signal: AbortSignal.timeout(40000), redirect: "error",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + idToken, "X-Firebase-AppCheck": appCheckToken.token },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = new Error("Worker unavailable.") as Error & { code: string };
        error.code = response.status === 429 ? "functions/resource-exhausted" : response.status === 401 ? "functions/unauthenticated" : "functions/unavailable";
        throw error;
      }
      data = await response.json();
    } else {
      // Preserve the existing callable integration. Never automatically fall back to it from Workers.
      const call = httpsCallable(getFunctions(app), operation, { timeout: 30000 });
      data = (await call(payload)).data as { text?: unknown };
    }
    if (auth.currentUser?.uid !== user.uid) throw new Error("Account changed.");
    if (!data || typeof data.text !== "string" || !data.text.trim()) throw new Error("Empty response.");
    return data.text.slice(0, 2000);
  } catch (error: unknown) {
    const code = (error as { code?: string }).code;
    if (code === "functions/resource-exhausted") {
      pausedUntil = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1);
      throw new Error("AI usage is paused until tomorrow. Offline summaries and Help still work.");
    }
    if (code === "functions/unauthenticated") throw new Error("Sign in again and verify app attestation to use AI.");
    throw new Error("AI unavailable. Your offline summaries and Help still work.");
  }
}

export async function sendSupportMessage(messages: SupportMessage[]): Promise<string> {
  if (!supportChatEnabled) throw new Error("Support chat is not activated. Please use Help FAQs.");
  return callAI("supportChat", { messages, consent: true, policyVersion: "free-tier-v1" });
}

/** Called only after the existing explicit per-request preview/consent dialog. */
export async function explainFinancialSummary(summary: import('../../features/insights/services/localInsights').ExplanationSummary): Promise<string> {
  if (!financialInsightsAIEnabled) throw new Error("AI explanations are not activated. Offline figures remain available.");
  const minimal = { cashFlow: summary.cashFlow, spendingPattern: summary.spendingPattern, savingsActivity: summary.savingsActivity, loanAttention: summary.loanAttention };
  return callAI("explainInsights", { consent: true, policyVersion: "free-tier-v1", summary: minimal });
}
