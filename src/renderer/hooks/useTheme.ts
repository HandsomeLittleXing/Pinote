import { useState, useEffect, useCallback } from 'react';
import { getApi } from '../utils/api';

/** 深色/浅色模式 Hook */
export function useTheme() {
  const [isDark, setIsDark] = useState(false);
  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>('system');

  const fetchTheme = useCallback(async () => {
    try {
      const settings = await getApi().settings.get();
      setThemeMode(settings.themeMode);

      if (settings.themeMode === 'system') {
        const current = await getApi().theme.getCurrent();
        setIsDark(current === 'dark');
      } else {
        setIsDark(settings.themeMode === 'dark');
      }
    } catch (error) {
      console.error('获取主题失败:', error);
    }
  }, []);

  useEffect(() => {
    fetchTheme();

    const unsubscribe = getApi().theme.onChanged((theme: string) => {
      if (themeMode === 'system') {
        setIsDark(theme === 'dark');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [fetchTheme, themeMode]);

  const changeThemeMode = useCallback(async (mode: 'system' | 'light' | 'dark') => {
    try {
      await getApi().settings.set({ themeMode: mode });
      setThemeMode(mode);
      setIsDark(mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches));
    } catch (error) {
      console.error('切换主题失败:', error);
    }
  }, []);

  return { isDark, themeMode, changeThemeMode };
}
