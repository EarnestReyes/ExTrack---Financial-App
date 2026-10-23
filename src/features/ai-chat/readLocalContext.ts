import { readOwned } from '../../database/repositories/ownedRecordRepository';
import type { LoanItem, TransactionItem } from '../../database/types';
import { buildFinancialContext } from './financialContext';
import { localDate } from '../../domain/finance';

/** Local read only; no cloud sync or AI transport dependency. */
export function readLocalContext(owner: string, period: 'current' | 'prior' = 'current', now = new Date()) {
  if (!owner) return null;
  try {
    const [year, month] = localDate(now).split('-').map(Number);
    const date = period === 'prior' ? new Date(Date.UTC(year, month - 1, 0, 4)) : now;
    // Current schedules cannot reconstruct whether a later payment was unpaid at a past date.
    return buildFinancialContext(readOwned<TransactionItem>(owner, 'transactions'), period === 'prior' ? null : readOwned<LoanItem>(owner, 'loans'), date);
  }
  catch { return null; }
}
