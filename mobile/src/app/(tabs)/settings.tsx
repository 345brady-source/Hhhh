import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useSession } from '../../lib/session';
import { Lockup } from '../../components/Logo';
import { Button, Screen, Section, Segmented, Title } from '../../components/ui';

export default function Settings() {
  const { appearance, setAppearance, faceId, setFaceId, biometricsAvailable, accounts, session, switchAccount, signOut, tenant, colors: c } = useSession();
  const [faceMsg, setFaceMsg] = useState('');
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const version = Constants.expoConfig?.version || '1.0.0';

  async function toggleFace(on: boolean) {
    setFaceMsg('');
    const ok = await setFaceId(on);
    if (!ok) setFaceMsg('Face ID was not turned on. Try again, or check Face ID in your iPhone settings.');
  }

  return (
    <Screen topInset>
      <Title sub="Preferences for this device">Settings</Title>

      <Section label="Appearance" style={{ marginTop: 4 }}>
        <View style={{ marginTop: 14 }}>
          <Segmented label="Appearance" options={[['light', 'Light'], ['dark', 'Dark'], ['system', 'Match device']]} value={appearance} onChange={setAppearance} />
        </View>
      </Section>

      <Section label="Security">
        <View style={[styles.row, { borderBottomColor: c.line }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: c.fg, fontSize: 15 }}>Unlock with Face ID</Text>
            <Text style={{ color: c.fg3, fontSize: 13 }}>{biometricsAvailable ? 'Asks for Face ID when you open the app' : 'Face ID is not set up on this device'}</Text>
          </View>
          <Switch value={faceId} onValueChange={toggleFace} disabled={!biometricsAvailable} trackColor={{ true: c.brand, false: c.surface3 }} accessibilityLabel="Unlock with Face ID" />
        </View>
        {faceMsg ? <Text style={{ color: c.bad, fontSize: 13, marginTop: 8 }}>{faceMsg}</Text> : null}
        <Text style={{ color: c.fg3, fontSize: 13, marginTop: 10 }}>Two-step verification is on for your account.</Text>
      </Section>

      {accounts.length > 1 ? (
        <Section label="Accounts">
          {accounts.map((a) => {
            const on = a.tenantId === session?.tenantId;
            return (
              <Pressable key={a.tenantId} onPress={() => switchAccount(a.tenantId)} disabled={on} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${a.tenant.name}${on ? ', current account' : ''}`} style={[styles.row, { borderBottomColor: c.line }]}>
                <View style={{ flex: 1 }}>
                  <Lockup tenant={a.tenant} size="sm" />
                </View>
                <Text style={{ color: on ? c.fg : c.brandText, fontSize: 14, fontWeight: on ? '600' : '400' }}>{on ? 'Current' : 'Switch'}</Text>
              </Pressable>
            );
          })}
        </Section>
      ) : null}

      <View style={{ marginTop: 32, gap: 12 }}>
        <Button title="Sign out" kind="secondary" onPress={signOut} />
        {deleteStep === 0 ? (
          <Button title="Request account deletion" kind="danger" onPress={() => setDeleteStep(1)} />
        ) : deleteStep === 1 ? (
          <View style={[styles.box, { borderColor: c.lineStrong }]}>
            <Text style={{ color: c.fg, fontSize: 15, lineHeight: 21 }}>
              {tenant ? tenant.shortName : 'Your investment firm'} will close your portal login. Your investment records are kept as required by law, and statements will be sent by mail.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <View style={{ flex: 1 }}><Button title="Cancel" kind="secondary" onPress={() => setDeleteStep(0)} /></View>
              <View style={{ flex: 1 }}><Button title="Request deletion" kind="danger" onPress={() => setDeleteStep(2)} /></View>
            </View>
          </View>
        ) : (
          <Text style={{ color: c.fg2, fontSize: 14, lineHeight: 20 }}>
            Request recorded. {tenant ? tenant.support.team : 'Investor relations'} will confirm by email. In this preview, no request is sent.
          </Text>
        )}
      </View>

      <Text style={{ color: c.fg3, fontSize: 12, textAlign: 'center', marginTop: 36 }}>Shareholder Desk {version}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  box: { borderWidth: 1, borderRadius: 4, padding: 14 }
});
