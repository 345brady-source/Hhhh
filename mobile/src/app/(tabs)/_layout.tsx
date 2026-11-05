import React from 'react';
import { Tabs } from 'expo-router/tabs';
import { useSession } from '../../lib/session';
import { Lockup } from '../../components/Logo';
import { AccountIcon, DistributionsIcon, DocumentsIcon, InvestmentsIcon, SettingsIcon } from '../../components/icons';

export default function TabsLayout() {
  const { colors: c, tenant } = useSession();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.brandText,
        tabBarInactiveTintColor: c.fg3,
        tabBarStyle: { backgroundColor: c.bg, borderTopColor: c.line },
        headerStyle: { backgroundColor: c.bg },
        headerTitleStyle: { color: c.fg, fontWeight: '600' },
        headerShadowVisible: false,
        headerTitleAlign: 'left',
        headerShown: false
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Investments',
          headerShown: true,
          headerTitle: () => (tenant ? <Lockup tenant={tenant} size="sm" /> : null),
          tabBarIcon: ({ color }) => <InvestmentsIcon color={color} />
        }}
      />
      <Tabs.Screen name="distributions" options={{ title: 'Distributions', tabBarIcon: ({ color }) => <DistributionsIcon color={color} /> }} />
      <Tabs.Screen name="documents" options={{ title: 'Documents', tabBarIcon: ({ color }) => <DocumentsIcon color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: ({ color }) => <AccountIcon color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => <SettingsIcon color={color} /> }} />
    </Tabs>
  );
}
