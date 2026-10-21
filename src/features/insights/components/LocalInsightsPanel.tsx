import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getDesignTheme } from '../../../constants/design';
import type { LoanItem, TransactionItem } from '../../../database/types';
import { explainFinancialSummary, financialInsightsAIEnabled } from '../../../services/ai/supportService';
import { buildLocalInsights } from '../services/localInsights';

export function LocalInsightsPanel({ entries, loans, dark, owner }: { entries: TransactionItem[]; loans: LoanItem[]; dark: boolean; owner?: string }) {
  const data = useMemo(() => buildLocalInsights(entries, loans), [entries, loans]);
  const c = getDesignTheme(dark);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const pending = useRef(false);
  useEffect(() => {
    generation.current++; pending.current = false; setText(''); setBusy(false);
    return () => { generation.current++; };
  }, [data, owner]);
  const money = (value: number | null) => value === null ? 'Review needed' : '\u20B1' + value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const explain = () => {
    if (pending.current || !owner) return;
    const captured = generation.current;
    Alert.alert('Share this limited summary with Google?',
      'Google\'s free tier may use prompts and responses to improve products, including human review. Do not share sensitive, confidential or personal information. Decline if these labels are sensitive to you.\n\nOnly these labels will be sent:\n' +
      Object.entries(data.summary).map(([key, value]) => `${key}: ${value}`).join('\n') +
      '\n\nNo amounts, names, account IDs, descriptions, category names, dates or documents are sent. Confirm only if you are 18+, in an eligible region, and agree to this request. Local figures stay available if you decline.',
      [{ text: 'Keep offline', style: 'cancel' }, { text: 'Share these labels', onPress: async () => {
        if (pending.current || generation.current !== captured) return;
        pending.current = true; setBusy(true); setText('');
        try {
          const result = await explainFinancialSummary(data.summary);
          if (generation.current === captured) setText(result);
        } catch (error) {
          if (generation.current === captured) setText(error instanceof Error ? error.message : 'AI unavailable; offline summaries remain available.');
        } finally {
          if (generation.current === captured) { pending.current = false; setBusy(false); }
        }
      } }]);
  };
  const metric = (label: string, value: string) => <View key={label} style={[styles.row, { borderColor: c.border }]}><Text style={[styles.label, { color: c.secondary }]}>{label}</Text><Text style={[styles.value, { color: c.text }]}>{value}</Text></View>;
  return <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
    <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>This month, clearly</Text>
    <Text style={[styles.note, { color: c.secondary }]}>Calculated from your recorded ledger. Always available without AI.</Text>
    {metric('Monthly income', money(data.monthly.income))}
    {metric('Monthly expenses', money(data.monthly.expenses))}
    {metric('Income less expenses', money(data.monthly.net))}
    {metric('Savings category allocations', money(data.savingsAllocations))}
    <Text style={[styles.note, { color: c.secondary }]}>Surplus is not a verified savings balance. Savings allocations are categorized expenses, not bank savings.</Text>
    <Text style={[styles.heading, { color: c.text }]}>Spending breakdown</Text>
    {data.breakdown.length ? data.breakdown.map(([name, amount]) => metric(name, money(amount))) : <Text style={[styles.note, { color: c.secondary }]}>No recorded spending this month.</Text>}
    {data.breakdown[0] && <Text style={[styles.note, { color: c.secondary }]}>Highest expense category: {data.breakdown[0][0]}.</Text>}
    <Text style={[styles.heading, { color: c.text }]}>Loans · all time</Text>
    {metric('Recorded principal', money(data.principal))}
    {metric('Remaining scheduled payments', money(data.remaining))}
    {data.legacyLoans > 0 && <Text style={[styles.note, { color: c.secondary }]}>{data.legacyLoans} historical loans excluded from these totals pending review.</Text>}
    {data.reminders.slice(0, 3).map(item => <Text key={item.installmentId} style={[styles.note, { color: c.text }]}>{item.title}: {item.status.toLowerCase()} {item.dueDate} · {money(item.amount)}. Confirm only after paying.</Text>)}
    {!data.reminders.length && <Text style={[styles.note, { color: c.secondary }]}>No unconfirmed installments in verified schedules.</Text>}
    {data.reminders.length > 3 && <Text style={[styles.note, { color: c.secondary }]}>{data.reminders.length - 3} more loan reminders are available in Activity.</Text>}
    {data.monthly.reviewCount > 0 && <Text style={[styles.note, { color: c.secondary }]}>{data.monthly.reviewCount} records excluded from monthly figures pending review.</Text>}
    <TouchableOpacity accessibilityRole="button" disabled={busy || !financialInsightsAIEnabled || !owner} onPress={explain}
      style={[styles.button, { backgroundColor: c.raised, opacity: busy || !financialInsightsAIEnabled ? 0.6 : 1 }]}>
      <Text style={{ color: c.accent, fontWeight: '600' }}>{busy ? 'Explaining…' : 'Explain with Gemini · optional'}</Text>
    </TouchableOpacity>
    {!financialInsightsAIEnabled && <Text style={[styles.note, { color: c.secondary }]}>AI is not activated. Hosting costs and free-tier eligibility must be verified first.</Text>}
    {!!text && <View accessibilityLiveRegion="polite"><Text style={[styles.heading, { color: c.text }]}>AI explanation · may be inaccurate</Text><Text selectable style={[styles.note, { color: c.text }]}>{text}</Text></View>}
  </View>;
}

const styles = StyleSheet.create({
  panel: { padding: 20, borderRadius: 24, borderWidth: 1, marginVertical: 16 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  heading: { fontSize: 15, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  note: { fontSize: 12, lineHeight: 20, marginVertical: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 13, lineHeight: 21, flexShrink: 1 }, value: { fontSize: 14, lineHeight: 21, fontWeight: '600', fontVariant: ['tabular-nums'] },
  button: { minHeight: 48, padding: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 14, marginTop: 20 },
});
