/*
 * Small key-value storage. On iPhone this is the Keychain (expo-secure-store);
 * in the web preview it falls back to browser storage.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const PREFIX = 'sd.';

export async function getItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage ? globalThis.localStorage.getItem(PREFIX + key) : null;
    return await SecureStore.getItemAsync(PREFIX + key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string | null): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (!globalThis.localStorage) return;
      if (value == null) globalThis.localStorage.removeItem(PREFIX + key);
      else globalThis.localStorage.setItem(PREFIX + key, value);
      return;
    }
    if (value == null) await SecureStore.deleteItemAsync(PREFIX + key);
    else await SecureStore.setItemAsync(PREFIX + key, value);
  } catch {
    /* storage is a convenience; the app works without it */
  }
}
