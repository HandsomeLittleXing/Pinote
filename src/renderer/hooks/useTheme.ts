import { useState, useEffect, useCallback } from 'react';
import type { AppSettings, SkinId, ThemeMode } from '../../shared/types';
import { normalizeSkinId } from '../../shared/skins';
import { getApi } from '../utils/api';

/** 深色/浅色模式 + 皮肤 Hook */
export function useTheme() {
  const [isDark, setIsDark] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [skin, setSkin] = useState<SkinId>('glass');
  const [aiEnabled, setAiEnabled] = useState(false);

  const applySettings = useCallback((settings: AppSettings, systemTheme?: 'light' | 'dark') => {
    setThemeMode(settings.themeMode);
    setSkin(normalizeSkinId(settings.skin));
    setAiEnabled(!!settings.aiEnabled);
    if (settings.themeMode === 'system') {
      if (systemTheme) setIsDark(systemTheme === 'dark');
    } else {
      setIsDark(settings.themeMode === 'dark');
    }
  }, []);

  const fetchTheme = useCallback(async () => {
    try {
      const settings = await getApi().settings.get();
      const current = await getApi().theme.getCurrent();
      applySettings(settings, current === 'dark' ? 'dark' : 'light');
    } catch (error) {
      console.error('获取主题失败:', error);
    }
  }, [applySettings]);

  useEffect(() => {
    void fetchTheme();

    // 主进程广播的是最终生效主题，直接采用即可（手动/跟随系统都适用）
    const unsubscribeTheme = getApi().theme.onChanged((theme: string) => {
      setIsDark(theme === 'dark');
    });
    // 皮肤等设置变化会广播完整设置
    const unsubscribeSettings = getApi().settings.onChanged((settings) => {
      applySettings(settings);
    });

    return () => {
      unsubscribeTheme();
      unsubscribeSettings();
    };
  }, [applySettings, fetchTheme]);

  // 把主题 class 和 data-skin 挂到 <html>，确保 Portal 到 body 的菜单/浮层也能继承
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.dataset.skin = skin;
  }, [isDark, skin]);

  const changeThemeMode = useCallback(async (mode: ThemeMode) => {
    try {
      await getApi().settings.set({ themeMode: mode });
      setThemeMode(mode);
      setIsDark(
        mode === 'dark' ||
          (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      );
    } catch (error) {
      console.error('切换主题失败:', error);
    }
  }, []);

  return { isDark, themeMode, skin, aiEnabled, changeThemeMode };
}
