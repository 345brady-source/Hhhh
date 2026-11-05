import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '../../lib/session';
import { date, last4, today, usdc, type Any } from '../../lib/format';
import { Chips, Figures, Screen, Section, Title } from '../../components/ui';

export default function Distributions() {
  const { view, investor, ws, colors: c } = useSession();
  const [year, setYear] = useState<string>('all');
  const [showAll, setShowAll] = useState(false);
  const years = useMemo<string[]>(() => (view ? Array.from(new Set<string>(view.payments.map((p: Any) => p.date.slice(0, 4)))).sort().reverse() : []), [view]);
  if (!view || !investor) return <Screen><Title>Distributions</Title></Screen>;
  const name = (id: string) => (ws.offerings.find((o: Any) => o.id === id) || {}).name || id;
  const list = view.payments.filter((p: Any) => year === 'all' || p.date.startsWith(year));
  const shown = showAll ? list : list.slice(0, 40);
  const paid = list.filter((p: Any) => p.status === 'paid').reduce((a: number, p: Any) => a + p.cents, 0);
  const bank = investor.payment && investor.payment.method === 'ach' ? investor.payment.bank : null;

  return (
    <Screen>
      <Title sub={bank ? `Paid by ACH to ${bank.type} account ending ${last4(bank.account)}` : 'Paid by check to your mailing address'}>Distributions</Title>
      <Figures
        items={[
          { label: 'Total received', value: usdc(view.totals.received), note: 'All investments' },
          { label: `Received in ${today().slice(0, 4)}`, value: usdc(view.totals.ytd), note: 'Year to date' },
          { label: 'Scheduled', value: usdc(view.totals.scheduled), note: view.totals.scheduled ? 'Approved, not yet paid' : 'None scheduled' }
        ]}
      />
      <Section label="Payment history">
        <Chips options={[['all', 'All years'], ...years.map((y) => [y, y] as [string, string])]} value={year} onChange={(v) => { setYear(v); setShowAll(false); }} />
        <Text style={{ color: c.fg3, fontSize: 13, marginTop: 10 }}>{list.length} payments · {usdc(paid)} paid</Text>
        {shown.map((p: Any) => (
          <View key={p.run.id + p.offeringId} style={[styles.row, { borderBottomColor: c.line }]} accessible accessibilityLabel={`${date(p.date)}, ${name(p.offeringId)}, ${usdc(p.cents)}, ${p.status === 'scheduled' ? 'scheduled' : 'paid'}`}>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={{ color: c.fg, fontSize: 15 }}>{date(p.date)}</Text>
              <Text style={{ color: c.fg3, fontSize: 13 }} numberOfLines={2}>{name(p.offeringId)} · {p.type}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Text style={{ color: c.fg, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{usdc(p.cents)}</Text>
              <Text style={{ color: p.status === 'scheduled' ? c.warn : c.fg3, fontSize: 12, fontWeight: p.status === 'scheduled' ? '600' : '400' }}>{p.status === 'scheduled' ? 'Scheduled' : 'Paid'}</Text>
            </View>
          </View>
        ))}
        {list.length > shown.length ? (
          <Pressable onPress={() => setShowAll(true)} accessibilityRole="button" style={{ paddingVertical: 14 }}>
            <Text style={{ color: c.brandText, fontSize: 15 }}>Show all {list.length} payments</Text>
          </Pressable>
        ) : null}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth }
});
