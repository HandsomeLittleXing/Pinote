import * as SecureStore from 'expo-secure-store';

const KEY = 'pinote.device-ai-key';

export async function getDeviceAIKey(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}

export async function saveDeviceAIKey(value: string): Promise<void> {
  const key = value.trim();
  if (!key || key.length > 512) throw new Error('请输入有效的 API Key');
  if (!(await SecureStore.isAvailableAsync())) throw new Error('设备安全存储不可用，无法保存 API Key');
  await SecureStore.setItemAsync(KEY, key);
}

export async function deleteDeviceAIKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
