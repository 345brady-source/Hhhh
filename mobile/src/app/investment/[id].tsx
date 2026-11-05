import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { NS } from '../../core';
import { useSession } from '../../lib/session';
import { date, redemption, usd, usdc, type Any } from '../../lib/format';
import { Figures, HoldBar, KV, RowLink, Screen, Section, Title } from '../../components/ui';

export default function InvestmentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { view, ws, tenant, colors: c } = useSession();
  const [all, setAll] = useState(false);
  const p = view ? view.positions.find((x: Any) => x.offering.id === id) : null;
  if (!p) {
    return (
      <Screen>
        <Title>Investment not found</Title>
        <Text style={{ color: c.fg3, fontSize: 15 }}>This investment is not on your account.</Text>
      </Screen>
    );
  }
  const o = p.offering;
  const x = p.exit;
  const e = o.exit || {};
  const [time, when] = redemption(o);
  const next = NS.nextDistribution(ws, o);
  const dist = o.distribution || {};
  const terms = (o.terms || []).filter((t: Any) => t.show && t.label);
  const docs: Any[] = NS.investorDocs(ws, view).filter((d: Any) => d.offeringId === o.id);
  const pays = all ? p.payments : p.payments.slice(0, 12);
  return (
    <Screen>
      <Stack.Screen options={{ title: o.shortName || '' }} />
      <Title sub={`${o.type}${o.summary ? ' · ' + o.summary : ''}`}>{o.name}</Title>
      <Figures
        items={[
          { label: 'Your investment', value: usd(p.invested), note: `Funded ${date(p.date)}` },
          { label: 'Distributions received', value: usdc(p.received), note: `${p.payments.filter((q: Any) => q.status === 'paid').length} payments` },
          { label: 'Distributions', value: dist.frequency || '—', note: next ? `Next ${date(next.date)}` : dist.target || undefined },
          { label: x.state === 'exited' ? 'Completed' : 'Time to redemption', value: x.state === 'exited' ? x.value : time, note: x.state === 'exited' ? x.remaining : when }
        ]}
      />

      {x.state !== 'exited' ? (
        <Section label="Time to redemption">
          <Text style={{ color: c.fg, fontSize: 17, fontWeight: '600', marginTop: 12 }}>{time}</Text>
          <HoldBar progress={x.progress} windowStart={x.windowStart} />
          {x.progress != null ? (
            <View style={styles.tlLabels}>
              <Text style={{ color: c.fg3, fontSize: 12 }}>Closed {date(o.closeDate)}</Text>
              <Text style={{ color: c.fg3, fontSize: 12 }}>{e.basis === 'range' ? `Window ${date(e.from, 'my')} – ${date(e.to, 'my')}` : when}</Text>
            </View>
          ) : null}
          {e.note ? <Text style={{ color: c.fg2, fontSize: 14, lineHeight: 20, marginTop: 10 }}>{e.note}</Text> : null}
        </Section>
      ) : null}

      {terms.length ? (
        <Section label="Key terms">
          {terms.map((t: Any) => (
            <KV key={t.label} label={t.label} value={t.value || '—'} />
          ))}
        </Section>
      ) : null}

      {o.update ? (
        <Section label="Latest update">
          <Text style={{ color: c.fg2, fontSize: 15, lineHeight: 22, marginTop: 12 }}>{o.update}</Text>
          <Text style={{ color: c.fg3, fontSize: 12, marginTop: 6 }}>{tenant?.shortName}</Text>
        </Section>
      ) : null}

      <Section label="Distributions from this investment">
        {pays.length ? (
          pays.map((q: Any) => (
            <View key={q.run.id} style={[styles.row, { borderBottomColor: c.line }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: c.fg, fontSize: 15 }}>{date(q.date)}</Text>
                <Text style={{ color: c.fg3, fontSize: 13 }}>{q.type}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <Text style={{ color: c.fg, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{usdc(q.cents)}</Text>
                <Text style={{ color: q.status === 'scheduled' ? c.warn : c.fg3, fontSize: 12 }}>{q.status === 'scheduled' ? 'Scheduled' : 'Paid'}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={{ color: c.fg3, fontSize: 15, paddingVertical: 14 }}>No distributions yet.</Text>
        )}
        {!all && p.payments.length > 12 ? (
          <Pressable onPress={() => setAll(true)} accessibilityRole="button" style={{ paddingVertical: 14 }}>
            <Text style={{ color: c.brandText, fontSize: 15 }}>Show all {p.payments.length}</Text>
          </Pressable>
        ) : null}
      </Section>

      {docs.length ? (
        <Section label="Documents">
          {docs.map((d) => (
            <RowLink key={d.id} onPress={() => router.push(`/document/${d.id}`)} label={d.title}>
              <Text style={{ color: c.fg, fontSize: 15, fontWeight: '500' }}>{d.title}</Text>
              <Text style={{ color: c.fg3, fontSize: 13, marginTop: 2 }}>{date(d.date)} · {d.cat}</Text>
            </RowLink>
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tlLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth }
});
