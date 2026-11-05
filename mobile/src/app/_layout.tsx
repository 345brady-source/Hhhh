import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '../lib/session';
import { Lockup } from '../components/Logo';
import { LockIcon } from '../components/icons';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <Root />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const { ready, session, locked, tenant, colors: c, scheme } = useSession();
  if (!ready) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, primary: c.brandText, background: c.bg, card: c.bg, text: c.fg, border: c.line } };
  return (
    <ThemeProvider value={theme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerTintColor: c.brandText,
          headerStyle: { backgroundColor: c.bg },
          headerTitleStyle: { color: c.fg },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          // The firm's logo heads every page after sign-in.
          headerTitle: () => (tenant ? <Lockup tenant={tenant} size="sm" /> : null),
          contentStyle: { backgroundColor: c.bg }
        }}
      >
        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="investment/[id]" options={{ title: 'Investment' }} />
          <Stack.Screen name="document/[id]" options={{ title: 'Document', presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
      {session && locked ? <LockScreen /> : null}
    </ThemeProvider>
  );
}

/** Covers the app until biometric unlock (Face ID, Touch ID, fingerprint or face) succeeds. */
function LockScreen() {
  const { tenant, unlock, signOut, biometricLabel, colors: c } = useSession();
  useEffect(() => {
    unlock();
  }, [unlock]);
  return (
    <View style={[StyleSheet.absoluteFill, styles.lock, { backgroundColor: c.bg }]} accessibilityViewIsModal>
      {tenant ? <Lockup tenant={tenant} size="lg" /> : null}
      <View style={{ alignItems: 'center', gap: 8 }}>
        <LockIcon color={c.fg3} size={28} />
        <Text style={{ color: c.fg2, fontSize: 15 }}>Locked</Text>
      </View>
      <Pressable onPress={unlock} accessibilityRole="button" style={[styles.btn, { backgroundColor: c.brand }]}>
        <Text style={{ color: c.brandInk, fontSize: 16, fontWeight: '600' }}>Unlock with {biometricLabel}</Text>
      </Pressable>
      <Pressable onPress={signOut} accessibilityRole="button" hitSlop={12}>
        <Text style={{ color: c.brandText, fontSize: 15 }}>Sign in with password instead</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  lock: { alignItems: 'center', justifyContent: 'center', gap: 28, padding: 24 },
  btn: { minHeight: 48, paddingHorizontal: 24, borderRadius: 4, alignItems: 'center', justifyContent: 'center' }
});
