import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getDesignTheme } from '../../constants/design';
import { entryCentavos, ledgerKind, type LedgerEntry } from '../../domain/finance';

const categoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  Food: 'restaurant-outline', Shopping: 'bag-handle-outline', Transportation: 'car-outline',
  Bills: 'receipt-outline', Entertainment: 'play-outline', Health: 'medkit-outline',
  Education: 'school-outline', Salary: 'briefcase-outline', Allowance: 'wallet-outline',
  Freelance: 'laptop-outline', Gift: 'gift-outline', Savings: 'shield-checkmark-outline',
};

export function TransactionRow({ entry, dark, onPress }: {
  entry: LedgerEntry; dark: boolean; onPress: () => void;
}) {
  const colors = getDesignTheme(dark);
  const { name, category, date } = entry;
  const kind = ledgerKind(entry);
  const cents = entryCentavos(entry);
  const review = kind === 'review' || cents === null;
  const sign = !review && kind === 'income' ? '+' : !review && kind === 'expense' ? '-' : '';
  const amount = cents === null ? 'Review' : sign + '\u20B1' + (cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${name}, ${category}, ${date}, ${amount}. Open transaction actions.`}
    style={({ pressed }) => [styles.row, { borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 }]}>
    <View style={[styles.icon, { backgroundColor: colors.raised }]}><Ionicons name={categoryIcons[category] ?? 'swap-horizontal-outline'} size={20} color={colors.accent} /></View>
    <View style={styles.copy}><Text style={[styles.name, { color: colors.text }]}>{name}</Text><Text style={[styles.detail, { color: colors.secondary }]}>{review ? 'Needs review' : category} · {date}</Text></View>
    <Text style={[styles.amount, { color: !review && kind === 'income' ? colors.positive : !review && kind === 'expense' ? colors.negative : colors.text }]}>{amount}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 80, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 }, name: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  detail: { fontSize: 12, lineHeight: 19, marginTop: 3 },
  amount: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'], maxWidth: '43%', textAlign: 'right' },
});
