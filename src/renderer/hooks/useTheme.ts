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

    // 主进程广播的是最终生效主题，直接采用即可（手动/跟随系统都适用）
    const unsubscribe = getApi().theme.onChanged((theme: string) => {
      setIsDark(theme === 'dark');
    });

    return () => {
      unsubscribe();
    };
  }, [fetchTheme]);

  // 把暗色 class 挂到 <html>，确保 Portal 到 body 的菜单/浮层也能继承暗色 token
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

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
