import { getFunctions, httpsCallable } from "firebase/functions";
import { app, auth } from "../firebase/client";
interface LowBalanceEmailParams { email: string; userName: string; balance: number }
export async function sendNegativeBalanceEmail({ balance }: LowBalanceEmailParams): Promise<boolean> {
  if (process.env.EXPO_PUBLIC_EMAIL_ALERTS_ENABLED !== "true" || !auth.currentUser?.emailVerified || !Number.isFinite(balance) || balance >= 0) return false;
  try { await httpsCallable(getFunctions(app), "sendLowBalanceAlert")({ balance }); return true; }
  catch { return false; }
}
