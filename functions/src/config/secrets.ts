import {defineSecret, defineString} from "firebase-functions/params";

export const smtpUser = defineSecret("SMTP_USER");
export const smtpPassword = defineSecret("SMTP_PASSWORD");
export const geminiKey = defineSecret("GEMINI_API_KEY");
export const geminiModel = defineString("GEMINI_SUPPORT_MODEL", {default: ""});
