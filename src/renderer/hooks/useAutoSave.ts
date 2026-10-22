import { useState, useEffect, useRef, useCallback } from 'react';

/** 自动保存 Hook（500ms 防抖） */
export function useAutoSave(
  stickerId: string,
  content: string,
  saveCallback: (id: string, content: string) => Promise<void>
): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');

  const debouncedSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      if (content !== lastSavedRef.current && content !== undefined) {
        lastSavedRef.current = content;
        try {
          await saveCallback(stickerId, content);
        } catch (error) {
          console.error('自动保存失败:', error);
        }
      }
    }, 500);
  }, [stickerId, content, saveCallback]);

  useEffect(() => {
    if (content !== undefined) {
      debouncedSave();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [content, debouncedSave]);
}
