import React, { useState } from 'react';
import { Platform, StyleSheet, Switch, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useSession } from '../../lib/session';
import { Button, Screen, Section, Segmented, Title } from '../../components/ui';

export default function Settings() {
  const { appearance, setAppearance, faceId, setFaceId, biometricsAvailable, biometricLabel: bio, signOut, tenant, colors: c } = useSession();
  const [faceMsg, setFaceMsg] = useState('');
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const version = Constants.expoConfig?.version || '1.0.0';

  async function toggleFace(on: boolean) {
    setFaceMsg('');
    const ok = await setFaceId(on);
    if (!ok) setFaceMsg(`Unlock with ${bio} was not turned on. Try again, or check your ${Platform.OS === 'ios' ? 'iPhone' : 'phone'} settings.`);
  }

  return (
    <Screen>
      <Title sub="Preferences for this device">Settings</Title>

      <Section label="Appearance" style={{ marginTop: 4 }}>
        <View style={{ marginTop: 14 }}>
          <Segmented label="Appearance" options={[['light', 'Light'], ['dark', 'Dark'], ['system', 'Match device']]} value={appearance} onChange={setAppearance} />
        </View>
      </Section>

      <Section label="Security">
        <View style={[styles.row, { borderBottomColor: c.line }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: c.fg, fontSize: 15 }}>Unlock with {bio}</Text>
            <Text style={{ color: c.fg3, fontSize: 13 }}>{biometricsAvailable ? 'Asked each time you open the app' : `Not set up on this ${Platform.OS === 'ios' ? 'iPhone' : 'phone'}. Turn it on in your phone settings first.`}</Text>
          </View>
          <Switch value={faceId} onValueChange={toggleFace} disabled={!biometricsAvailable} trackColor={{ true: c.brand, false: c.surface3 }} accessibilityLabel={`Unlock with ${bio}`} />
        </View>
        {faceMsg ? <Text style={{ color: c.bad, fontSize: 13, marginTop: 8 }}>{faceMsg}</Text> : null}
        <Text style={{ color: c.fg3, fontSize: 13, marginTop: 10 }}>Two-step verification is on for your account.</Text>
      </Section>

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
