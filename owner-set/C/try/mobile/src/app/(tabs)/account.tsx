import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { NS } from '../../core';
import { useSession } from '../../lib/session';
import { date, last4 } from '../../lib/format';
import { KV, Screen, Section, Title } from '../../components/ui';

export default function Account() {
  const { investor, tenant, colors: c } = useSession();
  if (!investor || !tenant) return <Screen><Title>Account</Title></Screen>;
  const bank = investor.payment && investor.payment.method === 'ach' ? investor.payment.bank : null;
  const typeLabel = (NS.ENTITY_TYPES[investor.type] || {}).label || investor.type;
  const phoneDigits = String(tenant.support.phone).replace(/[^\d+]/g, '');
  return (
    <Screen>
      <Title sub={`${investor.title} · Account ${investor.id}`}>Account</Title>
      <Section label="Investor" style={{ marginTop: 4 }}>
        <KV label="Account title" value={investor.title} />
        <KV label="Investing as" value={typeLabel} />
        <KV label="Primary contact" value={investor.contact} />
        <KV label="Email" value={investor.email} />
        <KV label="Phone" value={investor.phone || '—'} />
        <KV label="Mailing address" value={investor.address || '—'} />
      </Section>
      <Section label="Distribution payments">
        <KV label="Method" value={bank ? 'Direct deposit (ACH)' : 'Check by mail'} />
        {bank ? <KV label="Account" value={`${bank.type === 'savings' ? 'Savings' : 'Checking'} ending ${last4(bank.account)}`} /> : null}
        {bank ? <KV label="Routing number" value={`ending ${last4(bank.routing)}`} /> : null}
      </Section>
      <Section label="Tax and accreditation">
        <KV label="Tax form" value={investor.taxForm ? `${investor.taxForm} on file` : 'Not provided'} />
        <KV label="Taxpayer ID" value={investor.tinLast4 ? `ending ${investor.tinLast4}` : 'Not provided'} />
        <KV label="Accreditation" value={investor.accreditation && investor.accreditation.basis ? 'Verified accredited investor' : 'Not provided'} sub={investor.accreditation && investor.accreditation.date ? `Verified ${date(investor.accreditation.date)}` : undefined} />
      </Section>
      <Section label="Investor relations">
        <Text style={{ color: c.fg, fontSize: 15, fontWeight: '600', marginTop: 12 }}>{tenant.support.team}</Text>
        <Text style={{ color: c.fg3, fontSize: 13, marginTop: 2 }}>{tenant.support.hours}</Text>
        <View style={styles.contact}>
          <Pressable onPress={() => Linking.openURL(`tel:${phoneDigits}`)} accessibilityRole="button" accessibilityLabel={`Call ${tenant.support.phone}`} style={[styles.contactBtn, { borderColor: c.lineStrong }]}>
            <Text style={{ color: c.fg, fontSize: 15, fontWeight: '600' }}>Call</Text>
            <Text style={{ color: c.fg3, fontSize: 13 }}>{tenant.support.phone}</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(`mailto:${tenant.support.email}`)} accessibilityRole="button" accessibilityLabel={`Email ${tenant.support.email}`} style={[styles.contactBtn, { borderColor: c.lineStrong }]}>
            <Text style={{ color: c.fg, fontSize: 15, fontWeight: '600' }}>Email</Text>
            <Text style={{ color: c.fg3, fontSize: 13 }} numberOfLines={1}>{tenant.support.email}</Text>
          </Pressable>
        </View>
        <Text style={{ color: c.fg3, fontSize: 13, marginTop: 14, lineHeight: 19 }}>To change your details or bank account, contact {tenant.support.team}. Bank changes are confirmed by phone before they take effect.</Text>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  contact: { flexDirection: 'row', gap: 10, marginTop: 14 },
  contactBtn: { flex: 1, borderWidth: 1, borderRadius: 4, paddingVertical: 12, paddingHorizontal: 12, gap: 2 }
});
