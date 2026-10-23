import { entryCentavos, isCanonicalLoan, ledgerKind, loanSchedule, localDate, mergeLedger, summarize, validDate } from '../../domain/finance';
import type { LoanItem, TransactionItem } from '../../database/types';
import { buildLocalInsights } from '../insights/services/localInsights';

export const CONTEXT_CATEGORIES = ['Food', 'Transportation', 'Bills', 'Shopping', 'Entertainment'] as const;
const MAX = 100000000000000;
export interface FinancialContext {
  version: 1;
  currency: 'PHP';
  period: { start: string; end: string; partial: boolean; completeness: 'unknown'; comparisonCurrentEnd: string; priorStart: string; priorEnd: string };
  recordedIncomeCents: number | null;
  recordedExpenseCents: number | null;
  categories: { code: typeof CONTEXT_CATEGORIES[number]; cents: number }[];
  cashFlow: { currentNetCents: number | null; comparableCurrentNetCents: number | null; priorNetCents: number | null };
  dueUnpaidLoanCents: number | null;
  quality: { ledgerUnavailable: boolean; loansUnavailable: boolean; noRecordedIncome: boolean; noRecordedExpenses: boolean; priorUnavailable: boolean; reviewRequired: boolean; legacyLoansExcluded: boolean; categoriesOmitted: boolean; refundSemanticsUnknown: true; savingsNotVerified: true };
}

function amount(value: number) {
  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > MAX) throw new Error('Amount unavailable or outside preview limits.');
  return cents;
}
function exact(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(value, key))) throw new Error('Invalid context fields.');
}
/** Validate this local preview only; this is not an approved network payload. */
export function validateFinancialContext(value: unknown): asserts value is FinancialContext {
  exact(value, ['version', 'currency', 'period', 'recordedIncomeCents', 'recordedExpenseCents', 'categories', 'cashFlow', 'dueUnpaidLoanCents', 'quality']);
  if (value.version !== 1 || value.currency !== 'PHP') throw new Error('Invalid context version or currency.');
  exact(value.period, ['start', 'end', 'partial', 'completeness', 'comparisonCurrentEnd', 'priorStart', 'priorEnd']);
  const p = value.period;
  for (const key of ['start', 'end', 'comparisonCurrentEnd', 'priorStart', 'priorEnd']) if (typeof p[key] !== 'string' || !validDate(p[key] as string)) throw new Error('Invalid context period.');
  if (typeof p.partial !== 'boolean' || p.completeness !== 'unknown' || String(p.start) > String(p.comparisonCurrentEnd) || String(p.comparisonCurrentEnd) > String(p.end) || String(p.priorStart) > String(p.priorEnd) || String(p.priorEnd) >= String(p.start)) throw new Error('Invalid context period.');
  const dayCount = (start: unknown, end: unknown) => (Date.parse(String(end)) - Date.parse(String(start))) / 86400000;
  if (dayCount(p.start, p.comparisonCurrentEnd) !== dayCount(p.priorStart, p.priorEnd)) throw new Error('Unequal comparison periods.');
  const money = (n: unknown, signed = false, nullable = true) => {
    if (n === null && nullable) return;
    if (typeof n !== 'number' || !Number.isSafeInteger(n) || Math.abs(n) > MAX || (!signed && n < 0)) throw new Error('Invalid context amount.');
  };
  money(value.recordedIncomeCents); money(value.recordedExpenseCents); money(value.dueUnpaidLoanCents);
  exact(value.cashFlow, ['currentNetCents', 'comparableCurrentNetCents', 'priorNetCents']);
  Object.values(value.cashFlow).forEach(n => money(n, true));
  if (!Array.isArray(value.categories) || value.categories.length > 5) throw new Error('Invalid categories.');
  const seen = new Set();
  for (const item of value.categories) {
    exact(item, ['code', 'cents']);
    if (!CONTEXT_CATEGORIES.includes(item.code as typeof CONTEXT_CATEGORIES[number]) || seen.has(item.code)) throw new Error('Invalid category code.');
    seen.add(item.code); money(item.cents, false, false);
  }
  exact(value.quality, ['ledgerUnavailable', 'loansUnavailable', 'noRecordedIncome', 'noRecordedExpenses', 'priorUnavailable', 'reviewRequired', 'legacyLoansExcluded', 'categoriesOmitted', 'refundSemanticsUnknown', 'savingsNotVerified']);
  if (Object.values(value.quality).some(v => typeof v !== 'boolean') || value.quality.refundSemanticsUnknown !== true || value.quality.savingsNotVerified !== true) throw new Error('Invalid quality indicators.');
  if (value.quality.ledgerUnavailable) {
    if (value.recordedIncomeCents !== null || value.recordedExpenseCents !== null || value.cashFlow.currentNetCents !== null || value.categories.length || value.dueUnpaidLoanCents !== null || value.quality.noRecordedIncome || value.quality.noRecordedExpenses) throw new Error('Unavailable ledger cannot contain calculated totals.');
  } else {
    if (value.recordedIncomeCents === null || value.recordedExpenseCents === null || value.cashFlow.currentNetCents !== (value.recordedIncomeCents as number) - (value.recordedExpenseCents as number)) throw new Error('Inconsistent ledger totals.');
    if (value.categories.reduce((sum, item) => sum + item.cents, 0) > (value.recordedExpenseCents as number)) throw new Error('Category totals exceed recorded expenses.');
    if (value.quality.noRecordedIncome !== (value.recordedIncomeCents === 0) || value.quality.noRecordedExpenses !== (value.recordedExpenseCents === 0)) throw new Error('Inconsistent missing-income or expense indicators.');
  }
  if (value.quality.priorUnavailable && (value.cashFlow.priorNetCents !== null || value.cashFlow.comparableCurrentNetCents !== null)) throw new Error('Unavailable comparisons must not contain values.');
  if ((value.quality.loansUnavailable || value.quality.legacyLoansExcluded || value.quality.reviewRequired) && value.dueUnpaidLoanCents !== null) throw new Error('Unreliable obligations must be unavailable.');
}

/** Pure local projection: never returns identities, notes, titles or raw entries. */
export function buildFinancialContext(entries: TransactionItem[] | null, loans: LoanItem[] | null, now = new Date()): FinancialContext {
  const end = localDate(now);
  if (!validDate(end)) throw new Error('Invalid reporting date.');
  const [year, month, day] = end.split('-').map(Number);
  const start = end.slice(0, 7) + '-01';
  const previous = new Date(Date.UTC(year, month - 1, 0));
  const comparableDays = Math.min(day, previous.getUTCDate());
  const priorStart = previous.toISOString().slice(0, 7) + '-01';
  const priorEnd = priorStart.slice(0, 8) + String(comparableDays).padStart(2, '0');
  const comparisonCurrentEnd = start.slice(0, 8) + String(comparableDays).padStart(2, '0');
  if (entries && entries.some(e => !e || typeof e.type !== 'string' || typeof e.name !== 'string' || typeof e.category !== 'string' || !validDate(e.date) || entryCentavos(e) === null || (!e.firestoreId && e.id === undefined))) throw new Error('Ledger records need review before preview.');
  const ledger = mergeLedger(entries ?? [], []);
  const uniqueLoans = new Map<string, LoanItem>();
  let legacy = false;
  for (const loan of loans ?? []) {
    if (!loan || !loan.firestoreId || !isCanonicalLoan(loan)) { legacy = true; continue; }
    if (uniqueLoans.has(loan.firestoreId) && JSON.stringify(uniqueLoans.get(loan.firestoreId)) !== JSON.stringify(loan)) throw new Error('Conflicting loan records.');
    uniqueLoans.set(loan.firestoreId, loan);
  }
  const insights = buildLocalInsights(ledger, [...uniqueLoans.values()], now);
  const current = insights.monthly;
  const comparable = summarize(ledger, start, comparisonCurrentEnd);
  const prior = summarize(ledger, priorStart, priorEnd);
  const priorAvailable = entries !== null && prior.entries.length > 0 && prior.reviewCount === 0;
  let dueCents = 0;
  for (const [id, loan] of uniqueLoans) {
    const schedule = loanSchedule(id, loan, ledger, end)!;
    for (const installment of schedule.installments) if (installment.status === 'Due' || installment.status === 'Overdue') dueCents += amount(installment.amount);
  }
  if (!Number.isSafeInteger(dueCents) || dueCents > MAX) throw new Error('Loan aggregate exceeds preview limits.');
  const categories = insights.breakdown.filter(([code]) => CONTEXT_CATEGORIES.includes(code as typeof CONTEXT_CATEGORIES[number])).slice(0, 5).map(([code, value]) => ({ code: code as typeof CONTEXT_CATEGORIES[number], cents: amount(value) }));
  const review = ledger.some(entry => ledgerKind(entry) === 'review');
  const result: FinancialContext = {
    version: 1, currency: 'PHP', period: { start, end, partial: day !== new Date(Date.UTC(year, month, 0)).getUTCDate(), completeness: 'unknown', comparisonCurrentEnd, priorStart, priorEnd },
    recordedIncomeCents: entries ? amount(current.income) : null, recordedExpenseCents: entries ? amount(current.expenses) : null,
    categories: entries ? categories : [],
    cashFlow: { currentNetCents: entries ? amount(current.net) : null, comparableCurrentNetCents: priorAvailable && comparable.reviewCount === 0 ? amount(comparable.net) : null, priorNetCents: priorAvailable ? amount(prior.net) : null },
    dueUnpaidLoanCents: entries && loans && !legacy && !review ? dueCents : null,
    quality: { ledgerUnavailable: entries === null, loansUnavailable: loans === null, noRecordedIncome: entries !== null && current.income === 0, noRecordedExpenses: entries !== null && current.expenses === 0, priorUnavailable: !priorAvailable, reviewRequired: review, legacyLoansExcluded: legacy, categoriesOmitted: insights.breakdown.length > categories.length, refundSemanticsUnknown: true, savingsNotVerified: true },
  };
  validateFinancialContext(result);
  return result;
}
