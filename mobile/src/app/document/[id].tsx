import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { NS } from '../../core';
import { useSession } from '../../lib/session';
import { date, type Any } from '../../lib/format';
import { Lockup } from '../../components/Logo';
import { KV, Screen } from '../../components/ui';

export default function DocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { view, ws, tenant, investor, colors: c } = useSession();
  const doc: Any = view ? NS.investorDocs(ws, view).find((d: Any) => d.id === id) : null;
  if (!doc || !tenant || !investor) return <Screen><Text style={{ color: c.fg3 }}>Document not found.</Text></Screen>;
  const off = doc.offeringId ? ws.offerings.find((o: Any) => o.id === doc.offeringId) : null;
  return (
    <Screen>
      {/* Cover page on the sponsor's letterhead, as in the portal. */}
      <View style={[styles.paper, { borderColor: c.line }]}>
        <Lockup tenant={tenant} size="sm" />
        <View style={[styles.rule, { backgroundColor: c.brand }]} />
        <Text style={[styles.kicker, { color: c.brandText }]}>{String(doc.cat).toUpperCase()}</Text>
        <Text style={[styles.docTitle, { color: c.fg }]}>{doc.title}</Text>
        <Text style={{ color: c.fg2, fontSize: 14 }}>{off ? off.name : 'All investments'}</Text>
        <Text style={{ color: c.fg3, fontSize: 13, marginTop: 10 }}>Prepared for {investor.title}</Text>
      </View>
      <View style={{ marginTop: 20 }}>
        <KV label="Date" value={date(doc.date, 'long')} />
        <KV label="Investment" value={off ? off.name : 'All investments'} />
        <KV label="Type" value={doc.cat} />
        <KV label="Pages" value={String(doc.pages)} />
        <KV label="Format" value="PDF" />
      </View>
      <Text style={{ color: c.fg3, fontSize: 13, lineHeight: 19, marginTop: 16 }}>
        Sample document. In the live app the PDF opens here, and you can save or share it from the iPhone share sheet.
      </Text>
      <Pressable onPress={() => router.back()} accessibilityRole="button" style={[styles.close, { borderColor: c.lineStrong }]}>
        <Text style={{ color: c.fg, fontSize: 16, fontWeight: '600' }}>Close</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  paper: { borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 8, borderRadius: 2 },
  rule: { height: 2, marginVertical: 6 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  docTitle: { fontSize: 20, fontWeight: '600' },
  close: { marginTop: 24, minHeight: 48, borderWidth: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center' }
});
