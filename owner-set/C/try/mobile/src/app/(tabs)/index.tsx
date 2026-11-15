/* Investments: notices from the sponsor, totals, current and completed investments, and per-investment distribution dates. */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { NS } from '../../core';
import { useSession } from '../../lib/session';
import { date, redemption, today, usd, usdc, type Any } from '../../lib/format';
import { Figures, RowLink, Screen, Section, Title } from '../../components/ui';

export default function Investments() {
  const { view, investor, tenant, ws, dismissNotice, colors: c } = useSession();
  if (!view || !investor) {
    return (
      <Screen>
        <Title>Investments</Title>
        <Text style={{ color: c.fg3, fontSize: 15 }}>No investments are recorded for this account yet.</Text>
      </Screen>
    );
  }
  const now = today();
  const notices: Any[] = NS.noticesFor(ws, investor);
  const scheduled = view.payments.filter((p: Any) => p.status === 'scheduled');
  const figs = [
    { label: 'Invested', value: usd(view.totals.invested), note: `${view.active.length} active` },
    { label: 'Distributions received', value: usdc(view.totals.received), note: 'All investments' },
    { label: `Received in ${now.slice(0, 4)}`, value: usdc(view.totals.ytd), note: 'Year to date' }
  ];
  if (scheduled.length) figs.push({ label: 'Scheduled', value: usdc(view.totals.scheduled), note: `Next ${date(scheduled[scheduled.length - 1].date)}` });

  return (
    <Screen key={tenant ? tenant.id : 'none'}>
      <Title sub={`${investor.title} · Account ${investor.id} · As of ${date(now, 'long')}`}>Investments</Title>

      {notices.length ? (
        <View style={[styles.notices, { borderColor: c.lineStrong }]}>
          {notices.map((n: Any, i: number) => {
            const subject = NS.mergeNotice(n.subject, investor, tenant, n, NS.noticeInvestment(ws, investor, n));
            return (
              <View key={n.id} style={[styles.notice, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }]}>
                <Text style={[styles.noticeDate, { color: c.fg3 }]}>{date(n.date).toUpperCase()}</Text>
                <Text style={{ color: c.fg, fontSize: 15, fontWeight: '600' }}>{subject}</Text>
                <View style={styles.noticeActions}>
                  <Pressable onPress={() => { dismissNotice(n.id); router.push({ pathname: '/documents', params: { off: n.audience === 'all' ? 'all' : n.audience } }); }} accessibilityRole="button" hitSlop={8}>
                    <Text style={{ color: c.brandText, fontSize: 14, textDecorationLine: 'underline' }}>View documents</Text>
                  </Pressable>
                  <Pressable onPress={() => dismissNotice(n.id)} accessibilityRole="button" accessibilityLabel="Dismiss notice" hitSlop={8}>
                    <Text style={{ color: c.fg3, fontSize: 14 }}>Dismiss</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      <Figures items={figs} />

      <Section label="Current investments">
        {view.active.map((p: Any) => {
          const [time, when] = redemption(p.offering);
          return (
            <RowLink key={p.offering.id} onPress={() => router.push(`/investment/${p.offering.id}`)} label={`${p.offering.name}, ${time} to redemption`}>
              <Text style={[styles.name, { color: c.fg }]}>{p.offering.name}</Text>
              <Text style={[styles.meta, { color: c.fg3 }]}>{p.offering.type}</Text>
              <View style={styles.grid}>
                <Cell label="Invested" value={usd(p.invested)} />
                <Cell label="Distributions received" value={usdc(p.received)} />
                <Cell label="Date invested" value={date(p.date)} />
                <Cell label="Time to redemption" value={time} sub={when} strong />
              </View>
            </RowLink>
          );
        })}
        {view.active.length > 1 ? (
          <View style={[styles.total, { borderTopColor: c.fg }]}>
            <Text style={[styles.totalLabel, { color: c.fg }]}>Total</Text>
            <Text style={[styles.totalValue, { color: c.fg }]}>{usd(view.totals.invested)} invested</Text>
          </View>
        ) : null}
      </Section>

      {view.exited.length ? (
        <Section label="Completed investments">
          {view.exited.map((p: Any) => (
            <RowLink key={p.offering.id} onPress={() => router.push(`/investment/${p.offering.id}`)} label={p.offering.name}>
              <Text style={[styles.name, { color: c.fg }]}>{p.offering.name}</Text>
              <View style={styles.grid}>
                <Cell label="Invested" value={usd(p.invested)} />
                <Cell label="Distributions received" value={usdc(p.received)} />
                <Cell label="Completed" value={p.exit.value} sub={p.exit.remaining} />
              </View>
            </RowLink>
          ))}
        </Section>
      ) : null}

      <Section label="Recent distributions" right={<Pressable onPress={() => router.push('/distributions')} hitSlop={8}><Text style={{ color: c.brandText, fontSize: 13 }}>All</Text></Pressable>}>
        {view.active.map((p: Any) => {
          const last = p.payments.find((x: Any) => x.status === 'paid');
          const next = NS.nextDistribution(ws, p.offering);
          return (
            <View key={p.offering.id} style={[styles.dist, { borderBottomColor: c.line }]}>
              <Text style={[styles.name, { color: c.fg }]} numberOfLines={2}>{p.offering.name}</Text>
              <View style={styles.grid}>
                <Cell label="Last distribution" value={last ? date(last.date) : '—'} sub={last ? usdc(last.cents) : undefined} />
                <Cell label="Next distribution" value={next ? date(next.date) : 'No set schedule'} sub={next ? (next.scheduled ? 'Scheduled payment' : next.schedule) : undefined} strong={!!next} />
              </View>
            </View>
          );
        })}
      </Section>
    </Screen>
  );
}

function Cell({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  const { colors: c } = useSession();
  return (
    <View style={styles.cell}>
      <Text style={[styles.cellLabel, { color: c.fg3 }]}>{label}</Text>
      <Text style={[styles.cellValue, { color: c.fg, fontWeight: strong ? '600' : '400' }]}>{value}</Text>
      {sub ? <Text style={[styles.cellSub, { color: c.fg3 }]}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notices: { borderTopWidth: 1, borderBottomWidth: 1, marginBottom: 20 },
  notice: { paddingVertical: 12, gap: 4 },
  noticeDate: { fontSize: 11, fontWeight: '600', letterSpacing: 0.6 },
  noticeActions: { flexDirection: 'row', gap: 20, marginTop: 6 },
  name: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 13, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, rowGap: 10 },
  cell: { width: '50%', paddingRight: 10, gap: 2 },
  cellLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },
  cellValue: { fontSize: 15, fontVariant: ['tabular-nums'] },
  cellSub: { fontSize: 12 },
  total: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, marginTop: -1 },
  totalLabel: { fontSize: 15, fontWeight: '600' },
  totalValue: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  dist: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth }
});
