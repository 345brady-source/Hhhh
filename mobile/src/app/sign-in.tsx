/*
 * Sign in: email, then password, then a 6-digit code. The email decides which
 * sponsor's account opens; an investor with several sponsors chooses one.
 * Demo: any password works and the code is 482913. In production these steps
 * call the portal's authentication API.
 */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession, type Account } from '../lib/session';
import { AppMark, Lockup } from '../components/Logo';
import { Button, Field, Screen } from '../components/ui';
import { ChevronIcon } from '../components/icons';

const DEMO_CODE = '482913';
type Step = 'email' | 'password' | 'code' | 'choose';

export default function SignIn() {
  const { lookup, signIn, colors: c } = useSession();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [matches, setMatches] = useState<Account[]>([]);

  const active = matches.filter((m) => m.investor.onboarding.status === 'complete');

  function submitEmail() {
    setError('');
    const found = lookup(email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Enter the email address you use with your investment firm.');
    if (!found.length) return setError('We could not find an investor account for that email. Check the address, or contact the firm you invested with.');
    if (!found.some((m) => m.investor.onboarding.status === 'complete')) {
      const t = found[0].tenant;
      return setError(`This account is not activated yet. Use the activation link in your invitation email from ${t.shortName}, or call ${t.support.phone}.`);
    }
    setMatches(found);
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
    if (active.length > 1) return setStep('choose');
    await signIn(active[0].tenantId, active[0].investor.id, email.trim());
  }

  const single = active.length === 1 ? active[0] : null;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ height: insets.top, backgroundColor: c.bg }} />
      <Screen>
        <View style={styles.brand}>
          {single && step !== 'email' ? <Lockup tenant={single.tenant} size="lg" /> : (
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
              <Pressable onPress={() => { setStep('email'); setPassword(''); setError(''); setNote(''); }} accessibilityRole="button" hitSlop={8}>
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

        {step === 'choose' && (
          <View>
            <Text style={[styles.h1, { color: c.fg }]} accessibilityRole="header">Choose an account</Text>
            <Text style={[styles.lede, { color: c.fg2 }]}>Your email is linked to investments with {active.length} firms. You can switch later in Settings.</Text>
            {active.map((m) => (
              <Pressable key={m.tenantId} onPress={() => signIn(m.tenantId, m.investor.id, email.trim())} accessibilityRole="button" accessibilityLabel={`Open ${m.tenant.name}`} style={({ pressed }) => [styles.account, { borderColor: c.line, backgroundColor: pressed ? c.surface2 : c.surface }]}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Lockup tenant={m.tenant} />
                  <Text style={{ color: c.fg3, fontSize: 13 }}>{m.investor.title} · {m.investor.id}</Text>
                </View>
                <ChevronIcon color={c.fg3} />
              </Pressable>
            ))}
          </View>
        )}

        <View style={[styles.demo, { borderColor: c.line }]}>
          <Text style={{ color: c.fg3, fontSize: 12, lineHeight: 18 }}>Sample login for this preview: jordan.davis@example.com, any password, code 482913.</Text>
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
  account: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderWidth: 1, borderRadius: 4, marginBottom: 10 },
  demo: { marginTop: 40, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth }
});
