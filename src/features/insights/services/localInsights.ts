import { loanSchedule, localDate, periodStart, summarize } from '../../../domain/finance';
import type { LoanItem, TransactionItem } from '../../../database/types';

export interface ExplanationSummary {
  cashFlow: 'surplus' | 'deficit' | 'balanced';
  spendingPattern: 'concentrated' | 'spread' | 'none';
  savingsActivity: 'recorded' | 'none';
  loanAttention: 'needed' | 'none';
}

/** Local ledger calculations only. No network, records mutation, or AI arithmetic. */
export function buildLocalInsights(entries: TransactionItem[], loans: LoanItem[], now = new Date()) {
  const today = localDate(now);
  const monthly = summarize(entries, periodStart('Month', now), today);
  const breakdown = Object.entries(monthly.categories).sort((a, b) => b[1] - a[1]);
  const schedules = loans.map(loan => ({ loan, schedule: loanSchedule(loan.firestoreId!, loan, entries, today) }));
  const reminders = schedules.flatMap(({ loan, schedule }) => {
    const next = schedule?.installments.find(item => item.status !== 'Paid');
    return next ? [{ title: loan.title, ...next }] : [];
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const canonical = schedules.filter(item => item.schedule !== null);
  const total = (field: 'principalCentavos' | 'remainingCentavos') => {
    const cents = canonical.reduce((sum, item) => sum + (field === 'principalCentavos' ? item.loan.principalCentavos! : item.schedule!.remainingCentavos), 0);
    return Number.isSafeInteger(cents) ? cents / 100 : null;
  };
  const savingsAllocations = monthly.categories.Savings ?? 0;
  const summary: ExplanationSummary = {
    cashFlow: monthly.net > 0 ? 'surplus' : monthly.net < 0 ? 'deficit' : 'balanced',
    spendingPattern: !monthly.expenses ? 'none' : (breakdown[0]?.[1] ?? 0) >= monthly.expenses / 2 ? 'concentrated' : 'spread',
    savingsActivity: savingsAllocations > 0 ? 'recorded' : 'none',
    loanAttention: reminders.some(item => item.status === 'Due' || item.status === 'Overdue') ? 'needed' : 'none',
  };
  return { monthly, breakdown, savingsAllocations, reminders, summary,
    principal: total('principalCentavos'), remaining: total('remainingCentavos'),
    legacyLoans: schedules.length - canonical.length };
}
