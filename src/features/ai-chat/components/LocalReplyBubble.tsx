import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getDesignTheme } from '../../../constants/design';
import type { LocalAssistantReply } from '../localAssistant';

/** Presentation only: all amounts and classifications come unchanged from the local engine. */
export function LocalReplyBubble({ reply, dark }: { reply: LocalAssistantReply; dark: boolean }) {
  const c = getDesignTheme(dark);
  const [expanded, setExpanded] = useState(false);
  return <View>
    <Text style={[styles.intro, { color: c.text }]}>Here is your local snapshot.</Text>
    <View style={[styles.card, { backgroundColor: c.background, borderColor: c.border }]}>
      {reply.facts.map((fact, index) => {
        const split = fact.indexOf(':');
        return split > 0 && !fact.startsWith('Period:') ? <View key={index} style={[styles.row, { borderColor: c.border }]}>
          <Text style={[styles.label, { color: c.secondary }]}>{fact.slice(0, split)}</Text>
          <Text selectable style={[styles.value, { color: c.text }]}>{fact.slice(split + 1).trim().replace(/\.$/, '')}</Text>
        </View> : <Text key={index} selectable style={[styles.note, { color: c.secondary }]}>{fact}</Text>;
      })}
    </View>
    {reply.limitation.includes('Some records require review') && <Text style={[styles.note, { color: c.negative }]}>Some records were excluded and need review.</Text>}
    <View style={styles.actions}>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded }} style={styles.action} onPress={() => setExpanded(!expanded)}><Text style={{ color: c.accent }}>General guidance {expanded ? '−' : '+'}</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Read limitations for this reply" style={styles.action} onPress={() => Alert.alert('About this snapshot', reply.limitation)}><Text style={{ color: c.secondary }}>Details</Text></TouchableOpacity>
    </View>
    {expanded && <Text selectable style={[styles.guidance, { color: c.text }]}>{reply.guidance}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  intro: { fontSize: 15, lineHeight: 22, marginBottom: 10 },
  card: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 12, lineHeight: 19, flexShrink: 1 }, value: { fontSize: 14, lineHeight: 20, fontWeight: '600', fontVariant: ['tabular-nums'], flexShrink: 1 },
  note: { fontSize: 12, lineHeight: 19, paddingVertical: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, action: { minHeight: 44, justifyContent: 'center' },
  guidance: { fontSize: 14, lineHeight: 22 },
});
