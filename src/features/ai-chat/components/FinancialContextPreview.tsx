import { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getDesignTheme } from '../../../constants/design';
import { readOwned } from '../../../database/repositories/ownedRecordRepository';
import { subscribeFinancialData } from '../../../database/sync/events';
import type { LoanItem, TransactionItem } from '../../../database/types';
import { buildFinancialContext, type FinancialContext } from '../financialContext';

export function FinancialContextPreview({ owner, dark }: { owner?: string; dark: boolean }) {
  const [snapshot, setSnapshot] = useState<{ owner?: string; context?: FinancialContext; failed?: boolean }>({});
  const [expanded, setExpanded] = useState(false);
  const c = getDesignTheme(dark);
  useEffect(() => {
    if (!owner) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      if (!active) return;
      clearTimeout(timer);
      try {
        const context = buildFinancialContext(readOwned<TransactionItem>(owner, 'transactions'), readOwned<LoanItem>(owner, 'loans'));
        setSnapshot({ owner, context });
      } catch { setSnapshot({ owner, failed: true }); }
      // Refresh the reporting day at Manila midnight, without polling or syncing.
      const shifted = Date.now() + 8 * 3600000;
      timer = setTimeout(refresh, 86400000 - shifted % 86400000 + 100);
    };
    refresh();
    const unsubscribe = subscribeFinancialData(refresh);
    const app = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { active = false; clearTimeout(timer); unsubscribe(); app.remove(); };
  }, [owner]);
  const data = snapshot.owner === owner ? snapshot.context : undefined;
  const money = (cents: number | null) => cents === null ? 'Unavailable' : 'PHP ' + (cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const row = (label: string, value: string) => <View key={label} style={[styles.row, { borderColor: c.border }]}><Text style={[styles.label, { color: c.secondary }]}>{label}</Text><Text style={[styles.value, { color: c.text }]}>{value}</Text></View>;
  return <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
    <Text style={[styles.badge, { color: c.accent }]}>LOCAL PREVIEW / NOTHING SENT</Text>
    <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>Your recorded month</Text>
    <Text style={[styles.note, { color: c.secondary }]}>Read-only figures from this device. No Worker or Gemini request. This preview does not attach data to chat.</Text>
    {!owner ? <Text style={{ color: c.secondary }}>Sign in to view your local summary.</Text> : !data ? <Text accessibilityLiveRegion="polite" style={{ color: c.secondary }}>{snapshot.owner === owner && snapshot.failed ? 'Preview unavailable. Some local records need review; no figures were guessed.' : 'Reading local records...'}</Text> : <>
      <Text style={[styles.note, { color: c.secondary }]}>{data.period.start} to {data.period.end} / {data.period.partial ? 'month in progress' : 'calendar month ended'}. Record completeness is unknown.</Text>
      {row('Recorded income', money(data.recordedIncomeCents))}
      {row('Recorded expenses', money(data.recordedExpenseCents))}
      {row('Income less expenses', money(data.cashFlow.currentNetCents))}
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded }} style={styles.toggle} onPress={() => setExpanded(!expanded)}><Text style={{ color: c.accent, fontWeight: '600' }}>{expanded ? 'Hide context details' : 'Review context and uncertainties'}</Text></TouchableOpacity>
      {expanded && <>
        <Text style={[styles.heading, { color: c.text }]}>Potential future context / v{data.version}</Text>
        <Text style={[styles.note, { color: c.secondary }]}>These aggregate fields could be proposed for sharing only after privacy review and explicit consent. Names, notes, account identifiers and transaction rows are excluded.</Text>
        {data.categories.map(item => row(item.code, money(item.cents)))}
        {!data.categories.length && <Text style={[styles.note, { color: c.secondary }]}>No allowlisted spending categories to show.</Text>}
        {row('Comparable current net', money(data.cashFlow.comparableCurrentNetCents))}
        {row('Comparable prior net', money(data.cashFlow.priorNetCents))}
        <Text style={[styles.note, { color: c.secondary }]}>Comparison: {data.period.start} to {data.period.comparisonCurrentEnd}, versus {data.period.priorStart} to {data.period.priorEnd}. Equal elapsed days; missing history is not zero.</Text>
        {row('Unpaid installments due as of today', money(data.dueUnpaidLoanCents))}
        <Text style={[styles.note, { color: c.secondary }]}>Due obligations include overdue installments, not future payments. They are not subtracted again from net cash flow.</Text>
        <Text style={[styles.heading, { color: c.text }]}>What remains uncertain</Text>
        <Text style={[styles.note, { color: c.secondary }]}>{[
          data.quality.noRecordedIncome && 'No income recorded; income is not assumed.',
          data.quality.noRecordedExpenses && 'No expenses recorded; spending completeness is unknown.',
          data.quality.priorUnavailable && 'Comparable prior records are unavailable or need review.',
          data.quality.reviewRequired && 'Some records were excluded by existing ledger rules.',
          data.quality.legacyLoansExcluded && 'Legacy or unidentified loans prevent a reliable obligation total.',
          data.quality.categoriesOmitted && 'Custom or non-allowlisted categories are omitted; the list is not total spending.',
          'Refund semantics are unverified. Totals reflect recorded classifications.',
          'Surplus and Savings-category expenses are not verified savings. Savings rate and budget remaining are unavailable.',
          'Local records may be incomplete or unsynced. Currency is the current PHP reporting convention, not currency conversion.',
        ].filter(Boolean).join('\n\n')}</Text>
      </>}
    </>}
  </View>;
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 22, padding: 18, marginBottom: 24 },
  badge: { fontSize: 10, letterSpacing: 1, fontWeight: '700', marginBottom: 10 },
  title: { fontSize: 21, fontWeight: '700' }, heading: { fontSize: 14, fontWeight: '600', marginTop: 16 },
  note: { fontSize: 12, lineHeight: 20, marginVertical: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 12, flexShrink: 1 }, value: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  toggle: { minHeight: 48, justifyContent: 'center', marginTop: 8 },
});
