import React from 'react';
import { visibleAiTags } from '../../shared/ai';
import { Check, Clock3, RefreshCw, Sparkles } from 'lucide-react';
import { ANNOTATION_KINDS, ANNOTATION_META } from '../../shared/ai';
import type { AIAnnotation } from '../../shared/types';

interface AiResultPanelProps {
  annotation: AIAnnotation | null;
  currentTags: string[];
  hasReminder: boolean;
  busy?: boolean;
  onAdoptTag: (tag: string) => void;
  onAdoptAllTags: () => void;
  onSetReminder: (iso: string) => void;
  onRerun: () => void;
}

function formatDue(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** 桌面便签窗口里的 AI 结果面板（放在 Popover 内） */
export function AiResultPanel({
  annotation,
  currentTags,
  hasReminder,
  busy,
  onAdoptTag,
  onAdoptAllTags,
  onSetReminder,
  onRerun,
}: AiResultPanelProps) {
  if (!annotation) {
    return (
      <div className="flex w-[260px] flex-col items-center gap-2 py-4 text-center">
        <Sparkles size={20} className="text-ink-subtle" />
        <p className="text-xs text-ink-muted">还没有 AI 整理结果</p>
        <button
          type="button"
          onClick={onRerun}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-on-accent"
        >
          立即整理
        </button>
      </div>
    );
  }

  const counts: Record<string, number> = {};
  for (const span of annotation.spans) {
    counts[span.kind] = (counts[span.kind] ?? 0) + 1;
  }

  const reminder = annotation.suggestedReminder;

  return (
    <div
      className="flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-1"
      style={{ width: 'min(260px, calc(100vw - 48px))' }}
    >
      {annotation.summary ? (
        <p className="text-[13px] font-medium leading-relaxed text-ink">
          <span className="text-accent">✦ </span>
          {annotation.summary}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1">
        {ANNOTATION_KINDS.filter((kind) => counts[kind]).map((kind) => (
          <span
            key={kind}
            className={`anno anno-${kind} px-1.5 py-0.5 text-[11px]`}
            title={ANNOTATION_META[kind].hint}
          >
            {ANNOTATION_META[kind].label} {counts[kind]}
          </span>
        ))}
      </div>

      {visibleAiTags(annotation.tags).length > 0 ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[11px] font-medium text-ink-muted">
              AI 标签
            </span>
            <button
              type="button"
              onClick={onAdoptAllTags}
              disabled={currentTags.length >= 3}
              className="shrink-0 text-[11px] text-accent hover:underline"
            >
              采纳可用建议
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {visibleAiTags(annotation.tags).map((tag) => {
              const adopted = currentTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onAdoptTag(tag)}
                  disabled={!adopted && currentTags.length >= 3}
                  className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] transition-colors ${
                    adopted ? 'border-accent/40 bg-accent/10 text-accent' : 'ai-tag'
                  }`}
                >
                  {adopted ? <Check size={10} /> : <span>✦</span>}
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {reminder ? (
        <div className="rounded-md bg-accent/10 p-2.5">
          <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-ink">
            <Clock3 size={12} className="text-accent" /> 提醒建议
          </div>
          <p className="text-[11px] text-ink-muted">
            {reminder.text}
            {reminder.dueAt ? ` · ${formatDue(reminder.dueAt)}` : ''}
          </p>
          {reminder.dueAt && !hasReminder ? (
            <button
              type="button"
              onClick={() => onSetReminder(reminder.dueAt!)}
              className="mt-2 rounded-md bg-accent px-2 py-1 text-[11px] font-medium text-on-accent"
            >
              设为提醒
            </button>
          ) : hasReminder ? (
            <p className="mt-1 text-[10px] text-ink-subtle">已有提醒，未覆盖</p>
          ) : null}
        </div>
      ) : null}

      {annotation.todos.length > 0 ? (
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-ink-muted">待办</span>
          {annotation.todos.map((todo, index) => (
            <p key={`${todo}-${index}`} className="text-[11px] leading-relaxed text-ink">
              · {todo}
            </p>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onRerun}
        disabled={busy}
        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line/20 py-1.5 text-[11px] text-ink-muted transition-colors hover:bg-muted disabled:opacity-50"
      >
        <RefreshCw size={12} className={busy ? 'animate-spin' : ''} />
        {busy ? '整理中…' : '重新整理'}
      </button>
    </div>
  );
}
