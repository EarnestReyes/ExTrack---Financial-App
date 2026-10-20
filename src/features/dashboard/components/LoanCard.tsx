import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getDesignTheme } from '../../../constants/design';
import type { LoanItem, TransactionItem } from '../../../database/types';
import { loanSchedule } from '../../../domain/finance';

export function LoanCard({ loan, transactions, dark, onPress }: { loan: LoanItem; transactions: TransactionItem[]; dark: boolean; onPress: () => void }) {
  const colors = getDesignTheme(dark);
  const schedule = loanSchedule(loan.firestoreId!, loan, transactions);
  const money = (amount: number) => '\u20B1' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const paid = schedule?.installments.filter(item => item.status === 'Paid').length ?? 0;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${loan.title}. View schedule and confirm a payment.`} onPress={onPress}
    style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.65 : 1 }]}>
    <View style={styles.header}><View style={[styles.icon, { backgroundColor: colors.raised }]}><Ionicons name="business-outline" size={20} color={colors.accent} /></View><Text style={[styles.title, { color: colors.text }]}>{loan.title}</Text><Ionicons name="chevron-forward" size={18} color={colors.secondary} /></View>
    <View style={styles.values}><View style={{ flex: 1 }}><Text style={[styles.label, { color: colors.secondary }]}>Principal</Text><Text style={[styles.amount, { color: colors.text }]}>{schedule ? money((loan.principalCentavos ?? 0) / 100) : 'Review needed'}</Text></View><View style={{ flex: 1 }}><Text style={[styles.label, { color: colors.secondary }]}>Monthly installment</Text><Text style={[styles.amount, { color: colors.text }]}>{money(loan.monthlyPayment ?? 0)}</Text></View></View>
    <View style={[styles.footer, { borderColor: colors.border }]}><Text style={[styles.label, { color: colors.secondary }]}>{schedule ? `${paid} of ${schedule.installments.length} payments confirmed` : 'Historical loan · verify original amounts'}</Text><Text style={[styles.link, { color: colors.accent }]}>View</Text></View>
  </Pressable>;
}
const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, padding: 18, marginTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontWeight: '600', fontSize: 15, lineHeight: 22 },
  values: { flexDirection: 'row', gap: 12, paddingVertical: 22 },
  label: { fontSize: 12, lineHeight: 20 }, amount: { fontSize: 18, lineHeight: 26, fontWeight: '600', fontVariant: ['tabular-nums'], marginTop: 3 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  link: { fontSize: 12, fontWeight: '600' },
});
