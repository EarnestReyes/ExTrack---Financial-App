import { getFunctions, httpsCallable } from "firebase/functions";
import { app, auth } from "../firebase/client";

export const supportChatEnabled = process.env.EXPO_PUBLIC_SUPPORT_CHAT_ENABLED === "true";
export interface SupportMessage { role: "user" | "model"; text: string }

export async function sendSupportMessage(messages: SupportMessage[]): Promise<string> {
  if (!supportChatEnabled) throw new Error("Support chat is not configured yet. Please use the Help FAQs.");
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Sign in to use support chat.");
  const call = httpsCallable<{ messages: SupportMessage[] }, { text: string }>(getFunctions(app), "supportChat", { timeout: 30000 });
  try {
    const result = await call({ messages });
    if (auth.currentUser?.uid !== uid) throw new Error("Account changed.");
    if (typeof result.data.text !== "string" || !result.data.text.trim()) throw new Error("Empty response.");
    return result.data.text;
  } catch (error: unknown) {
    const code = (error as { code?: string }).code;
    if (code === "functions/resource-exhausted") throw new Error("Please wait a minute before sending another message.");
    if (code === "functions/unauthenticated") throw new Error("Sign in again to use support chat.");
    throw new Error("Support chat is unavailable. Check your connection and try again.");
  }
}
