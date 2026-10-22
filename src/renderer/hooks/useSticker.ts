import { useState, useEffect, useCallback } from 'react';
import { getApi } from '../utils/api';
import type { Sticker, StickerColor } from '../../shared/types';

/** 便签数据读写 Hook */
export function useSticker(stickerId: string) {
  const [sticker, setSticker] = useState<Sticker | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSticker = useCallback(async () => {
    try {
      const data = await getApi().sticker.getById(stickerId);
      setSticker(data);
    } catch (error) {
      console.error('加载便签失败:', error);
    } finally {
      setLoading(false);
    }
  }, [stickerId]);

  useEffect(() => {
    loadSticker();
  }, [loadSticker]);

  const updateContent = useCallback(
    async (content: string) => {
      try {
        const updated = await getApi().sticker.update(stickerId, { content });
        setSticker(updated);
      } catch (error) {
        console.error('更新内容失败:', error);
      }
    },
    [stickerId]
  );

  const updateColor = useCallback(
    async (color: StickerColor) => {
      try {
        const updated = await getApi().sticker.setColor(stickerId, color);
        setSticker(updated);
      } catch (error) {
        console.error('更新颜色失败:', error);
      }
    },
    [stickerId]
  );

  const togglePin = useCallback(async () => {
    try {
      const updated = await getApi().sticker.togglePin(stickerId);
      setSticker(updated);
    } catch (error) {
      console.error('切换置顶失败:', error);
    }
  }, [stickerId]);

  const updateOpacity = useCallback(
    async (opacity: number) => {
      try {
        const updated = await getApi().sticker.setOpacity(stickerId, opacity);
        setSticker(updated);
      } catch (error) {
        console.error('更新透明度失败:', error);
      }
    },
    [stickerId]
  );

  const updateTags = useCallback(
    async (tags: string[]) => {
      try {
        const updated = await getApi().sticker.setTags(stickerId, tags);
        setSticker(updated);
      } catch (error) {
        console.error('更新标签失败:', error);
      }
    },
    [stickerId]
  );

  const setReminder = useCallback(
    async (reminder: string | null) => {
      try {
        const updated = await getApi().sticker.setReminder(stickerId, reminder);
        setSticker(updated);
      } catch (error) {
        console.error('设置提醒失败:', error);
      }
    },
    [stickerId]
  );

  const hideWindow = useCallback(async () => {
    try {
      await getApi().window.close();
    } catch (error) {
      console.error('隐藏窗口失败:', error);
    }
  }, []);

  const saveWindowState = useCallback(
    async (state: { x: number; y: number; width: number; height: number }) => {
      try {
        await getApi().window.saveState(state);
      } catch (error) {
        console.error('保存窗口状态失败:', error);
      }
    },
    []
  );

  return {
    sticker,
    loading,
    updateContent,
    updateColor,
    togglePin,
    updateOpacity,
    updateTags,
    setReminder,
    hideWindow,
    saveWindowState,
    reload: loadSticker,
  };
}
