import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'stickernote.sync-credentials';

export interface SyncCredentials {
  serverUrl: string;
  deviceId: string | null;
  token: string | null;
  lastSyncedAt: string | null;
}

const DEFAULT_CREDENTIALS: SyncCredentials = {
  serverUrl: '',
  deviceId: null,
  token: null,
  lastSyncedAt: null,
};

export async function getCredentials(): Promise<SyncCredentials> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { ...DEFAULT_CREDENTIALS };
  try {
    return { ...DEFAULT_CREDENTIALS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CREDENTIALS };
  }
}

export async function setCredentials(partial: Partial<SyncCredentials>): Promise<SyncCredentials> {
  const current = await getCredentials();
  const updated = { ...current, ...partial };
  await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  return updated;
}

export async function clearCredentials(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
