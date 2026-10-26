import React, { useCallback, useEffect, useState } from 'react';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';
import { getApi } from '../utils/api';
import { cn } from '../utils/cn';

interface ShortcutRecorderProps {
  label: string;
  value: string;
  onApply: (value: string) => Promise<void>;
}

const MODIFIER_KEYS = ['Control', 'Alt', 'Shift', 'Meta'];
const MODIFIER_NAMES = ['Ctrl', 'Alt', 'Shift', 'Super'];

function normalizeKey(event: KeyboardEvent): string {
  const mapped: Record<string, string> = {
    ' ': 'Space',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Escape: 'Esc',
  };
  if (mapped[event.key]) return mapped[event.key];
  if (event.key.length === 1) return event.key.toUpperCase();
  return event.key;
}

function buildAccelerator(event: KeyboardEvent): string | null {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Super');

  if (MODIFIER_KEYS.includes(event.key)) {
    return parts.length > 0 ? parts.join('+') : null;
  }

  parts.push(normalizeKey(event));
  return parts.join('+');
}

/** 快捷键录制：录制期间暂停全局快捷键，冲突时显示错误并保留旧值 */
export const ShortcutRecorder: React.FC<ShortcutRecorderProps> = ({
  label,
  value,
  onApply,
}) => {
  const { toast } = useToast();
  const [recording, setRecording] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const stopRecording = useCallback(async () => {
    setRecording(false);
    try {
      await getApi().shortcuts.setRecording(false);
    } catch (err) {
      console.error('恢复全局快捷键失败:', err);
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setDraft('');
    setRecording(true);
    try {
      await getApi().shortcuts.setRecording(true);
    } catch (err) {
      console.error('暂停全局快捷键失败:', err);
      setRecording(false);
      setError('无法开始录制，请重试');
    }
  }, []);

  const cancel = useCallback(async () => {
    setDraft('');
    setError(null);
    await stopRecording();
  }, [stopRecording]);

  const apply = useCallback(async () => {
    const next = draft.trim();
    const parts = next.split('+');
    const last = parts[parts.length - 1];
    const hasModifier = MODIFIER_NAMES.some((name) => parts.includes(name)) && parts.length > 1;
    const isFunctionKey = /^F\d{1,2}$/.test(last);

    if (!next) {
      setError('请先按下组合键');
      return;
    }
    if (!hasModifier && !isFunctionKey) {
      setError('请至少包含一个修饰键（Ctrl/Alt/Shift），或使用 F1–F12');
      return;
    }
    if (MODIFIER_NAMES.includes(last)) {
      setError('请再按一个非修饰键');
      return;
    }

    setSaving(true);
    try {
      await onApply(next);
      setError(null);
      setDraft('');
      await stopRecording();
      toast({ title: '快捷键已更新', variant: 'success', duration: 1800 });
    } catch (err) {
      const raw = err instanceof Error ? err.message : '快捷键保存失败';
      setError(raw.replace(/^Error invoking remote method '[^']+': Error: /, ''));
      await stopRecording();
    } finally {
      setSaving(false);
    }
  }, [draft, onApply, stopRecording, toast]);

  useEffect(() => {
    if (!recording) return;

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        void cancel();
        return;
      }
      const accelerator = buildAccelerator(event);
      if (accelerator) setDraft(accelerator);
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [recording, cancel]);

  // 组件卸载时恢复全局快捷键
  useEffect(() => {
    return () => {
      void getApi().shortcuts.setRecording(false);
    };
  }, []);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink-muted">{label}</span>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'min-w-[140px] rounded-md border px-3 py-1.5 text-center font-mono text-sm',
              recording
                ? 'border-accent/40 bg-accent/5 text-accent'
                : 'border-line/10 bg-muted text-ink'
            )}
          >
            {recording ? draft || '按下组合键…' : value}
          </div>
          {recording ? (
            <>
              <Button size="sm" onClick={apply} loading={saving} disabled={!draft}>
                应用
              </Button>
              <Button size="sm" variant="ghost" onClick={cancel} disabled={saving}>
                取消
              </Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" onClick={startRecording}>
              录制
            </Button>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
};
