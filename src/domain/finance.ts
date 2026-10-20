/** Money is calculated in integer centavos. Card balances are never ledger income.
 * Available balance means recorded opening balances + income - expenses, not bank funds.
 */
export interface LedgerEntry {
  id?: number;
  firestoreId?: string;
  ownerUid?: string;
  userId?: string;
  name: string;
  amount: number;
  amountCentavos?: number;
  type: string;
  category: string;
  date: string;
  time: string;
  loanId?: string | null;
  installmentId?: string;
  confirmedPayment?: boolean;
  automatic?: boolean;
}

export function moneyToCentavos(value: number | string): number {
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error("Enter a positive amount with at most two decimals.");
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 100000000000) throw new Error("Amount is outside the supported range.");
  return cents;
}

export function localDate(date = new Date()): string {
  // One reporting calendar across clients and payment Functions.
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === value;
}

export type LedgerKind = "income" | "expense" | "transfer" | "opening balance" | "review";
export function ledgerKind(entry: LedgerEntry): LedgerKind {
  // Historical generated card records are retained for review, excluded from totals.
  if (entry.category === "Card" || /^Card (Deposit|Balance):/.test(entry.name)) return "review";
  if (entry.automatic && !entry.confirmedPayment) return "review";
  const kind = entry.type.trim().toLowerCase();
  if (["income", "inflow", "credit"].includes(kind)) return "income";
  if (["expense", "outflow", "debit", "loan", "loan payment", "loan deduction", "deduction"].includes(kind)) return "expense";
  if (kind === "transfer" || kind === "opening balance") return kind;
  return "review";
}

export function entryCentavos(entry: LedgerEntry): number | null {
  if (entry.amountCentavos !== undefined) {
    return Number.isSafeInteger(entry.amountCentavos) && entry.amountCentavos > 0 && entry.amountCentavos <= 100000000000 ? entry.amountCentavos : null;
  }
  try { return moneyToCentavos(entry.amount); } catch { return null; }
}

export function mergeLedger(local: LedgerEntry[], remote: LedgerEntry[]): LedgerEntry[] {
  // A local numeric row ID is never a cloud identity.
  const entries = new Map<string, LedgerEntry>();
  for (const entry of [...remote, ...local]) {
    const key = entry.firestoreId ? `cloud:${entry.firestoreId}` : `local:${entry.id}`;
    entries.set(key, entry);
  }
  return [...entries.values()].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
}

export type Period = "Day" | "Week" | "Month" | "Year" | "All Time";
export function periodStart(period: Period, today = new Date()): string {
  const date = new Date(`${localDate(today)}T00:00:00Z`);
  if (period === "All Time") return "0000-01-01";
  if (period === "Week") date.setUTCDate(date.getUTCDate() - 6);
  if (period === "Month") date.setUTCDate(1);
  if (period === "Year") date.setUTCMonth(0, 1);
  return date.toISOString().slice(0, 10);
}

export function summarize(entries: LedgerEntry[], start = "0000-01-01", end = localDate()) {
  let incomeCentavos = 0, expenseCentavos = 0, openingCentavos = 0, confirmedLoanPaymentCentavos = 0, reviewCount = 0;
  const categories: Record<string, number> = {};
  const filtered = mergeLedger(entries, []).filter((e) => validDate(e.date) && e.date >= start && e.date <= end);
  for (const entry of filtered) {
    const cents = entryCentavos(entry), kind = ledgerKind(entry);
    if (cents === null || kind === "review") { reviewCount++; continue; }
    if (kind === "income") incomeCentavos += cents;
    if (kind === "opening balance") openingCentavos += cents;
    if (kind === "expense") {
      expenseCentavos += cents;
      categories[entry.category || "Uncategorized"] = (categories[entry.category || "Uncategorized"] || 0) + cents;
      if (entry.confirmedPayment && entry.loanId && entry.installmentId) confirmedLoanPaymentCentavos += cents;
    }
  }
  if (![incomeCentavos, expenseCentavos, openingCentavos].every(Number.isSafeInteger)) throw new Error("Ledger total exceeds safe monetary limits.");
  return { income: incomeCentavos / 100, expenses: expenseCentavos / 100, net: (incomeCentavos - expenseCentavos) / 100,
    availableBalance: (openingCentavos + incomeCentavos - expenseCentavos) / 100,
    confirmedLoanPayments: confirmedLoanPaymentCentavos / 100, reviewCount,
    categories: Object.fromEntries(Object.entries(categories).map(([key, cents]) => [key, cents / 100])), entries: filtered };
}

export function chartData(entries: LedgerEntry[], period: Period, today = new Date()) {
  const start = periodStart(period, today), end = localDate(today);
  const buckets = new Map<string, { date: string; income: number; expense: number; balance: number }>();
  let balance = Math.round(summarize(entries, "0000-01-01", previousDate(start)).availableBalance * 100);
  if (period === "All Time") throw new Error("Select a bounded period for chart data.");
  const cursor = new Date(`${start}T00:00:00Z`);
  while (cursor.toISOString().slice(0, 10) <= end) {
    const day = cursor.toISOString().slice(0, 10), key = period === "Year" ? day.slice(0, 7) : day;
    const summary = summarize(entries, day, day);
    balance += Math.round(summary.availableBalance * 100);
    const bucket = buckets.get(key) || { date: key, income: 0, expense: 0, balance: 0 };
    bucket.income = (Math.round(bucket.income * 100) + Math.round(summary.income * 100)) / 100;
    bucket.expense = (Math.round(bucket.expense * 100) + Math.round(summary.expenses * 100)) / 100;
    bucket.balance = balance / 100;
    buckets.set(key, bucket);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return [...buckets.values()];
}

function previousDate(date: string) {
  const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10);
}

export interface CanonicalLoan {
  schemaVersion: 2;
  principalCentavos: number;
  installmentCentavos: number;
  durationMonths: number;
  startDate: string;
  dueDay: number;
  firstDueDate: string;
}

/** Preserve a calendar date explicitly chosen in the native date picker. */
export function inputDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function scheduleDates(startDate: string, dueDay: number, duration: number) {
  if (!validDate(startDate) || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31 || !Number.isInteger(duration) || duration < 1 || duration > 600) throw new Error("Invalid loan schedule.");
  const [year, month] = startDate.split("-").map(Number);
  const due = (offset: number) => new Date(Date.UTC(year, month - 1 + offset, Math.min(dueDay, new Date(Date.UTC(year, month + offset, 0)).getUTCDate()))).toISOString().slice(0, 10);
  const offset = due(0) < startDate ? 1 : 0;
  return { firstDueDate: due(offset), endDate: due(offset + duration - 1) };
}

export function isCanonicalLoan(loan: Partial<CanonicalLoan>): loan is CanonicalLoan {
  return loan.schemaVersion === 2 && Number.isSafeInteger(loan.principalCentavos) && loan.principalCentavos! > 0 && loan.principalCentavos! <= 100000000000 &&
    Number.isSafeInteger(loan.installmentCentavos) && loan.installmentCentavos! > 0 && loan.installmentCentavos! <= 100000000000 &&
    Number.isInteger(loan.durationMonths) && loan.durationMonths! > 0 && loan.durationMonths! <= 600 &&
    Number.isInteger(loan.dueDay) && loan.dueDay! >= 1 && loan.dueDay! <= 31 &&
    validDate(loan.startDate || "") && validDate(loan.firstDueDate || "") && loan.firstDueDate! >= loan.startDate!;
}

export function loanSchedule(loanId: string, loan: Partial<CanonicalLoan>, entries: LedgerEntry[], today = localDate()) {
  if (!isCanonicalLoan(loan)) return null; // Never infer the meaning of legacy amounts.
  const [y, m] = loan.firstDueDate.split("-").map(Number);
  const installments = Array.from({ length: loan.durationMonths }, (_, index) => {
    const month = new Date(Date.UTC(y, m - 1 + index, 1));
    const dueDate = index === 0 ? loan.firstDueDate : new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), Math.min(loan.dueDay, new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate()))).toISOString().slice(0, 10);
    const installmentId = `${loanId}_${index + 1}`;
    const paid = entries.some((e) => e.loanId === loanId && e.installmentId === installmentId && e.confirmedPayment && entryCentavos(e) === loan.installmentCentavos);
    const status = paid ? "Paid" : dueDate < today ? "Overdue" : dueDate === today ? "Due" : "Upcoming";
    return { installmentId, number: index + 1, dueDate, amount: loan.installmentCentavos / 100, status };
  });
  const paidCount = installments.filter((i) => i.status === "Paid").length;
  return { installments, totalScheduledCentavos: loan.installmentCentavos * loan.durationMonths,
    confirmedPaymentCentavos: paidCount * loan.installmentCentavos,
    remainingCentavos: (loan.durationMonths - paidCount) * loan.installmentCentavos,
    status: paidCount === loan.durationMonths ? "Paid" : "Active" };
}
