export interface SupportMessage { role: "user" | "model"; text: string }

/** Validates bounded support conversation input.
 * @param {unknown} data Untrusted request.
 * @return {SupportMessage[]} Validated messages.
 */
export function supportMessages(data: unknown): SupportMessage[] {
  if (!data || typeof data !== "object") throw new Error("Invalid request.");
  if (Object.keys(data).some((key) => key !== "messages")) {
    throw new Error("Unexpected request fields.");
  }
  const messages = (data as {messages?: unknown}).messages;
  if (!Array.isArray(messages) || messages.length < 1 ||
  messages.length > 12) throw new Error("Use 1 to 12 messages.");
  let total = 0;
  const result = messages.map((message, index) => {
    if (!message || typeof message !== "object" || !["user",
      "model"].includes(message.role) ||
      typeof message.text !== "string" || !message.text.trim() ||
  message.text.length > 2000 ||
      Object.keys(message).some((key) => !["role", "text"].includes(key)) ||
      message.role !== (
        index % 2 === 0 ? "user" : "model")) {
      throw new Error("Invalid conversation.");
    }
    total += message.text.length;
    return {role: message.role, text: message.text.trim()} as SupportMessage;
  });
  if (total > 12000 ||
  result[result.length - 1]?.role !== "user") {
    throw new Error(
      "Conversation is too large or incomplete.");
  }
  return result;
}

/** Validates installment identity.
 * @param {unknown} data Untrusted request.
 * @return {object} Validated installment.
 */
export function paymentRequest(data: unknown): {
  loanId: string; number: number} {
  const request = data as {loanId?: unknown; number?: unknown} | null;
  if (!request || typeof request.loanId !== "string" ||
  !/^[A-Za-z0-9_-]{1,128}$/.test(request.loanId) ||
    !Number.isInteger(request.number) || Number(request.number) < 1 ||
  Number(request.number) > 600) throw new Error("Invalid installment.");
  return {loanId: request.loanId, number: Number(request.number)};
}

/** Rejects ambiguous or invalid legacy loan values.
 * @param {object} loan Stored loan.
 * @return {boolean} Whether amounts are canonical.
 */
export function validCanonicalLoan(loan: Record<string, unknown>) {
  return loan.schemaVersion === 2 && Number.isSafeInteger(
    loan.principalCentavos) && Number(loan.principalCentavos) > 0 &&
  Number(loan.principalCentavos) <= 100000000000 &&
    Number.isSafeInteger(loan.installmentCentavos) && Number(
    loan.installmentCentavos) > 0 && Number(
    loan.installmentCentavos) <= 100000000000 &&
    Number.isInteger(loan.durationMonths) && Number(
    loan.durationMonths) > 0 && Number(loan.durationMonths) <= 600;
}
