import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { NS } from '../../core';
import { useSession } from '../../lib/session';
import { date, type Any } from '../../lib/format';
import { Chips, RowLink, Screen, Section, Title } from '../../components/ui';

export default function Documents() {
  const { view, ws, colors: c } = useSession();
  const params = useLocalSearchParams<{ off?: string }>();
  const [cat, setCat] = useState('all');
  const [off, setOff] = useState<string>('all');
  // A notice can open this tab filtered to one investment.
  useEffect(() => {
    if (params.off) setOff(String(params.off));
  }, [params.off]);
  if (!view) return <Screen><Title>Documents</Title></Screen>;
  const all: Any[] = NS.investorDocs(ws, view);
  const cats = Array.from(new Set(all.map((d) => d.cat))) as string[];
  const list = all.filter((d) => (cat === 'all' || d.cat === cat) && (off === 'all' || d.offeringId === off));
  const name = (id: string | null) => (id ? (ws.offerings.find((o: Any) => o.id === id) || {}).name || '' : 'All investments');
  const offName = off === 'all' ? '' : name(off);

  return (
    <Screen>
      <Title sub="Reports, tax documents, statements and agreements">Documents</Title>
      {offName ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Text style={{ color: c.fg2, fontSize: 14 }}>Showing {offName}</Text>
          <Pressable onPress={() => { setOff('all'); router.setParams({ off: undefined }); }} accessibilityRole="button" hitSlop={8}>
            <Text style={{ color: c.brandText, fontSize: 14, textDecorationLine: 'underline' }}>Show all investments</Text>
          </Pressable>
        </View>
      ) : null}
      <Chips options={[['all', 'All types'], ...cats.map((x) => [x, x] as [string, string])]} value={cat} onChange={setCat} />
      <Section label={`${list.length} document${list.length === 1 ? '' : 's'}`}>
        {list.length ? (
          list.map((d) => (
            <RowLink key={d.id} onPress={() => router.push(`/document/${d.id}`)} label={`${d.title}, ${name(d.offeringId)}, ${date(d.date)}`}>
              <Text style={{ color: c.fg, fontSize: 15, fontWeight: '500' }}>{d.title}</Text>
              <Text style={{ color: c.fg3, fontSize: 13, marginTop: 2 }} numberOfLines={2}>
                {date(d.date)} · {name(d.offeringId)} · {d.cat}
              </Text>
            </RowLink>
          ))
        ) : (
          <Text style={{ color: c.fg3, fontSize: 15, paddingVertical: 16 }}>No documents match.</Text>
        )}
      </Section>
    </Screen>
  );
}
