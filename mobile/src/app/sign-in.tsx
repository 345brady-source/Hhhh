/*
 * Sign in: email, then password, then a 6-digit code. Each login belongs to
 * one firm, so signing in opens that firm's account directly (no firm list).
 * If the device already knows the firm (from its invitation link or the last
 * sign-in), its logo shows from the first screen.
 * Demo: any password works and the code is 482913. In production these steps
 * call the portal's authentication API.
 */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession, type Account } from '../lib/session';
import { AppMark, Lockup } from '../components/Logo';
import { Button, Field, Screen } from '../components/ui';

const DEMO_CODE = '482913';
type Step = 'email' | 'password' | 'code';

export default function SignIn() {
  const { lookup, signIn, firm, colors: c } = useSession();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [account, setAccount] = useState<Account | null>(null);

  function submitEmail() {
    setError('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Enter the email address you use with your investment firm.');
    const found = lookup(email);
    // The login's own firm. The firm this device is tied to settles the rare
    // case of one email registered separately with two firms.
    const acc = (firm && found.find((m) => m.tenantId === firm.id)) || (found.length === 1 ? found[0] : null);
    if (!found.length) return setError('We could not find an investor account for that email. Check the address, or contact the firm you invested with.');
    if (!acc) return setError("This email is registered with more than one firm. Open Shareholder Desk from the link in your firm's invitation email to sign in to that firm.");
    if (acc.investor.onboarding.status !== 'complete') {
      return setError(`This account is not activated yet. Use the activation link in your invitation email from ${acc.tenant.shortName}, or call ${acc.tenant.support.phone}.`);
    }
    setAccount(acc);
    setStep('password');
  }
  function submitPassword() {
    setError('');
    if (!password) return setError('Enter your password.');
    setStep('code');
  }
  async function submitCode() {
    setError('');
    if (code.replace(/\D/g, '') !== DEMO_CODE) return setError('That code is not correct. Check your authenticator app and try again.');
    if (account) await signIn(account.tenantId, account.investor.id, email.trim());
  }

  const shown = step !== 'email' && account ? account.tenant : firm;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ height: insets.top, backgroundColor: c.bg }} />
      <Screen>
        <View style={styles.brand}>
          {shown ? <Lockup tenant={shown} size="lg" /> : (
            <>
              <AppMark size={44} />
              <Text style={[styles.appName, { color: c.fg }]}>Shareholder Desk</Text>
            </>
          )}
        </View>

        {step === 'email' && (
          <View>
            <Text style={[styles.h1, { color: c.fg }]} accessibilityRole="header">Sign in</Text>
            <Text style={[styles.lede, { color: c.fg2 }]}>See your investments, distributions and documents.</Text>
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" autoComplete="email" returnKeyType="next" onSubmitEditing={submitEmail} error={error} />
            <Button title="Continue" onPress={submitEmail} />
          </View>
        )}

        {step === 'password' && (
          <View>
            <Text style={[styles.h1, { color: c.fg }]} accessibilityRole="header">Enter your password</Text>
            <Text style={[styles.lede, { color: c.fg2 }]}>{email.trim()}</Text>
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" autoComplete="password" returnKeyType="go" onSubmitEditing={submitPassword} error={error} autoFocus />
            <Button title="Continue" onPress={submitPassword} />
            <View style={styles.links}>
              <Pressable onPress={() => setNote(`We would email a password reset link to ${email.trim()}.`)} accessibilityRole="button" hitSlop={8}>
                <Text style={[styles.link, { color: c.brandText }]}>Forgot your password?</Text>
              </Pressable>
              <Pressable onPress={() => { setStep('email'); setAccount(null); setPassword(''); setError(''); setNote(''); }} accessibilityRole="button" hitSlop={8}>
                <Text style={[styles.link, { color: c.brandText }]}>Use a different email</Text>
              </Pressable>
            </View>
            {note ? <Text style={[styles.note, { color: c.fg2 }]}>{note}</Text> : null}
          </View>
        )}

        {step === 'code' && (
          <View>
            <Text style={[styles.h1, { color: c.fg }]} accessibilityRole="header">Enter your code</Text>
            <Text style={[styles.lede, { color: c.fg2 }]}>Open your authenticator app and enter the 6-digit code.</Text>
            <Field label="Verification code" value={code} onChangeText={(v) => setCode(v.replace(/[^\d ]/g, ''))} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={7} returnKeyType="done" onSubmitEditing={submitCode} error={error} autoFocus />
            <Button title="Verify" onPress={submitCode} />
          </View>
        )}

        <View style={[styles.demo, { borderColor: c.line }]}>
          <Text style={{ color: c.fg3, fontSize: 12, lineHeight: 18 }}>Sample logins for this preview, one per firm: jordan.davis@example.com (Kestrel Bay), jordan.davis@example.org (Ashwell Ridge), jordan.davis@example.net (Greywater). Any password, code 482913.</Text>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 28, marginBottom: 40 },
  appName: { fontSize: 20, fontWeight: '700', letterSpacing: -0.2 },
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: -0.3, marginBottom: 8 },
  lede: { fontSize: 15, lineHeight: 21, marginBottom: 24 },
  links: { marginTop: 18, gap: 14 },
  link: { fontSize: 15, textDecorationLine: 'underline' },
  note: { marginTop: 16, fontSize: 14 },
  demo: { marginTop: 40, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth }
});
