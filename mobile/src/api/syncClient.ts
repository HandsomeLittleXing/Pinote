import * as Device from 'expo-device';
import { Platform } from 'react-native';
import type { Sticker } from '@shared/types';
import { getCredentials, setCredentials } from '../storage/credentials';
import { getAllStickersRaw, applyRemoteSticker, getStickerById } from '../storage/db';

export interface RedeemResult {
  deviceId: string;
  syncSpaceId: string;
  token: string;
}

/** 用配对码兑换 token，加入桌面端所在的同步空间 */
export async function redeemPairingCode(serverUrl: string, code: string): Promise<RedeemResult> {
  const res = await fetch(`${serverUrl}/pairing/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      deviceName: Device.deviceName ?? `${Platform.OS}-device`,
      platform: Platform.OS,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`配对失败 (${res.status}): ${body}`);
  }
  const result = (await res.json()) as RedeemResult;
  await setCredentials({
    serverUrl,
    deviceId: result.deviceId,
    token: result.token,
    lastSyncedAt: null,
  });
  return result;
}

async function request(path: string, init: RequestInit): Promise<unknown> {
  const creds = await getCredentials();
  if (!creds.token) {
    throw new Error('尚未配对，无法同步');
  }
  const res = await fetch(`${creds.serverUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${creds.token}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`请求失败 (${res.status}): ${body}`);
  }
  return res.json();
}

/** 增量双向同步：推送本地变更，拉取服务端变更并以"最后写入优先"合并 */
export async function syncNow(): Promise<{ pulled: number }> {
  const creds = await getCredentials();
  if (!creds.token) {
    throw new Error('尚未配对');
  }

  const local = await getAllStickersRaw();
  const since = creds.lastSyncedAt;
  // 与服务器时间存在时钟偏差时，用重叠窗口避免漏推；服务端按 updatedAt 去重
  const pushFrom = since ? new Date(since).getTime() - 10 * 60 * 1000 : 0;
  const changes = local.filter((s) => new Date(s.updatedAt).getTime() > pushFrom);

  const res = (await request('/sync', {
    method: 'POST',
    body: JSON.stringify({ since, changes }),
  })) as { serverTime: string; changes: Sticker[] };

  for (const remote of res.changes) {
    const existing = await getStickerById(remote.id);
    if (!existing || new Date(remote.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
      await applyRemoteSticker(remote);
    }
  }

  await setCredentials({ lastSyncedAt: res.serverTime });
  return { pulled: res.changes.length };
}

export async function isPaired(): Promise<boolean> {
  const creds = await getCredentials();
  return !!creds.token;
}

export async function unpair(): Promise<void> {
  await setCredentials({ deviceId: null, token: null, lastSyncedAt: null });
}
