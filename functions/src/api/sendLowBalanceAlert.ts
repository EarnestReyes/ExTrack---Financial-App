import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as nodemailer from "nodemailer";
import {protectedOptions} from "../config/options";
import {smtpUser, smtpPassword} from "../config/secrets";
import {limit} from "../middleware/requestLimits";

export const sendLowBalanceAlert = onCall({...protectedOptions,
  secrets: [smtpUser, smtpPassword]}, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const email = request.auth.token.email;
  const balance = request.data?.balance;
  if (typeof email !== "string" ||
  request.auth.token.email_verified !== true ||
  typeof balance !== "number" || !Number.isFinite(balance) ||
  balance >= 0 || Math.abs(balance) > 1000000000) {
    throw new HttpsError("invalid-argument",
      "A verified account and a negative recorded balance are " +
"required.");
  }
  if (!smtpUser.value() || !smtpPassword.value()) {
    throw new HttpsError(
      "unavailable", "Email alerts are not configured.");
  }
  await limit(request.auth.uid, "email", 1);
  try {
    const transporter = nodemailer.createTransport({service: "gmail",
      auth: {user: smtpUser.value(), pass: smtpPassword.value()}});
    await transporter.sendMail({from: smtpUser.value(), to: email,
      subject: "ExTrack recorded balance alert",
      text: "Your recorded ExTrack balance is PHP " + balance.toFixed(
        2) + ". This is based on your ledger, not a bank balance."});
    return {success: true};
  } catch {
    throw new HttpsError("unavailable", "Unable to send the alert right now.");
  }
});
