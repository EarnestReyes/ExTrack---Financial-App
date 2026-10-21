import { Ionicons } from '@expo/vector-icons';
import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getDesignTheme } from '../../../constants/design';

export function SettingsSection({ title, dark, children }: PropsWithChildren<{ title: string; dark: boolean }>) {
  const c = getDesignTheme(dark);
  return <View style={styles.section}><Text accessibilityRole="header" style={[styles.sectionTitle, { color: c.secondary }]}>{title}</Text><View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>{children}</View></View>;
}

export function SettingsRow({ title, subtitle, icon, dark, onPress, accessory, last = false, disabled = false }: {
  title: string; subtitle?: string; icon: keyof typeof Ionicons.glyphMap; dark: boolean;
  onPress?: () => void; accessory?: ReactNode; last?: boolean; disabled?: boolean;
}) {
  const c = getDesignTheme(dark);
  const body = <><View style={[styles.icon, { backgroundColor: c.raised }]}><Ionicons name={icon} size={19} color={c.accent} /></View><View style={styles.copy}><Text style={[styles.title, { color: c.text }]}>{title}</Text>{!!subtitle && <Text style={[styles.subtitle, { color: c.secondary }]}>{subtitle}</Text>}</View>{accessory ?? (onPress ? <Ionicons name="chevron-forward" size={17} color={c.secondary} /> : null)}</>;
  const row = [styles.row, { borderBottomColor: last ? 'transparent' : c.border, opacity: disabled ? 0.6 : 1 }];
  return onPress ? <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [row, { backgroundColor: pressed ? c.raised : 'transparent' }]}>{body}</Pressable> : <View style={row}>{body}</View>;
}
const styles = StyleSheet.create({
  section: { marginBottom: 22 }, sectionTitle: { fontSize: 11, lineHeight: 18, letterSpacing: 1.2, fontWeight: '700', marginBottom: 8, marginLeft: 14, textTransform: 'uppercase' },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden', paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 }, title: { fontSize: 14, lineHeight: 21, fontWeight: '600' }, subtitle: { fontSize: 11, lineHeight: 18, marginTop: 2 },
});
