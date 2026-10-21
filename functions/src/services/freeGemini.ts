import {createHash} from "node:crypto";
import {defineString} from "firebase-functions/params";
import {HttpsError} from "firebase-functions/v2/https";
import {store} from "../config/firebase";
import {geminiKey, geminiModel} from "../config/secrets";

const enabled = defineString("AI_ENABLED", {default: "false"});
const verified = defineString("AI_FREE_TIER_VERIFIED", {default: "false"});
const model = "gemini-2.5-flash-lite";

/** Fail closed until an operator has verified the unbilled Gemini project. */
export function assertFreeAI() {
  if (enabled.value() !== "true" || verified.value() !== "true" ||
      geminiModel.value() !== model || !geminiKey.value()) {
    throw new HttpsError("unavailable", "AI is not activated. " +
      "Your offline summaries and Help remain available.");
  }
}

/** Reserve attempts across support and insights; never refund failures.
 * @param {string} uid Authenticated owner.
 */
async function reserve(uid: string) {
  const day = new Date().toISOString().slice(0, 10);
  const owner = createHash("sha256").update(uid).digest("hex");
  const globalRef = store.doc("service_limits/ai_global");
  const userRef = store.doc("service_limits/ai_" + owner);
  await store.runTransaction(async (tx) => {
    const global = (await tx.get(globalRef)).data();
    const user = (await tx.get(userRef)).data();
    const globalCount = global?.day === day ? Number(global.count) : 0;
    const userCount = user?.day === day ? Number(user.count) : 0;
    if (global?.blockedDay === day || globalCount >= 20 || userCount >= 5 ||
        !Number.isFinite(globalCount) || !Number.isFinite(userCount)) {
      throw new HttpsError("resource-exhausted",
        "AI usage is paused. Use offline summaries and Help; try tomorrow.");
    }
    tx.set(globalRef, {day, count: globalCount + 1});
    tx.set(userRef, {day, count: userCount + 1});
  });
}

/** Bounded call; no tools, retries, paid-model fallback or prompt logging.
 * @param {string} uid Authenticated account.
 * @param {string} instruction Server-owned instructions.
 * @param {object[]} contents Validated bounded content.
 * @return {Promise<{text: string}>} Untrusted explanatory text.
 */
export async function freeGemini(uid: string, instruction: string,
  contents: {role: string; parts: {text: string}[]}[]) {
  assertFreeAI();
  await reserve(uid);
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      model + ":generateContent", {
        method: "POST", signal: AbortSignal.timeout(20000),
        headers: {"Content-Type": "application/json",
          "x-goog-api-key": geminiKey.value()},
        body: JSON.stringify({systemInstruction: {parts: [{text: instruction}]},
          contents, generationConfig: {maxOutputTokens: 512,
            thinkingConfig: {thinkingBudget: 0}}}),
      });
    if (response.status === 429) {
      const day = new Date().toISOString().slice(0, 10);
      const ref = store.doc("service_limits/ai_global");
      await store.runTransaction(async (tx) => {
        const previous = (await tx.get(ref)).data();
        tx.set(ref, {...previous, blockedDay: day});
      });
      throw new HttpsError("resource-exhausted",
        "Gemini free quota is exhausted. AI is paused until tomorrow.");
    }
    if (!response.ok) throw new Error("Provider unavailable");
    const result = await response.json() as {candidates?: {content?: {
      parts?: {text?: string}[]}}[]};
    const text = result.candidates?.[0]?.content?.parts?.map((part) =>
      part.text || "").join("").trim();
    if (!text) throw new Error("Empty response");
    return {text: text.slice(0, 2000)};
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("unavailable",
      "AI is unavailable. Your offline summaries and Help still work.");
  }
}
