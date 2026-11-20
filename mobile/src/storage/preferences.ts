import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AISource, SkinId, ThemeMode } from '@shared/types';
import { normalizeSkinId } from '@shared/skins';
import { resolveAiSource } from '@shared/aiSource';
import { getCredentials } from './credentials';

const KEY = 'stickernote.preferences.v1';

export interface MobilePreferences {
  themeMode: ThemeMode;
  skin: SkinId;
  aiEnabled: boolean;
  aiSource: AISource;
  /** 已同意的 AI 隐私说明版本；0 表示尚未同意 */
  aiConsentVersion: number;
  showAiSummary: boolean;
  showAiTags: boolean;
  /** Mote 皮肤下是否显示小墨 */
  showMascot: boolean;
}

export const DEFAULT_PREFERENCES: MobilePreferences = {
  themeMode: 'system',
  skin: 'glass',
  aiEnabled: false,
  aiSource: 'device',
  aiConsentVersion: 0,
  showAiSummary: true,
  showAiTags: true,
  showMascot: true,
};

function normalizeMode(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export async function getPreferences(): Promise<MobilePreferences> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<MobilePreferences>;
    const linked = !parsed.aiSource && parsed.aiEnabled ? !!(await getCredentials()).token : false;
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      skin: normalizeSkinId(parsed.skin),
      themeMode: normalizeMode(parsed.themeMode),
      aiConsentVersion:
        typeof parsed.aiConsentVersion === 'number' ? parsed.aiConsentVersion : 0,
      aiSource: resolveAiSource(parsed.aiSource, !!parsed.aiEnabled, linked),
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export async function savePreferences(
  partial: Partial<MobilePreferences>
): Promise<MobilePreferences> {
  const current = await getPreferences();
  const updated = { ...current, ...partial };
  updated.aiSource = resolveAiSource(updated.aiSource, updated.aiEnabled, false);
  await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  return updated;
}
