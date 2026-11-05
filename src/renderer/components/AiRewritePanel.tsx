import React, { useState } from 'react';
import type { AIRewriteResponse } from '../../shared/types';

interface Props {
  sourceText: string;
  result: AIRewriteResponse;
  onApply: (selectedIds: string[]) => void;
  onClose: () => void;
}

export function AiRewritePanel({ sourceText, result, onApply, onClose }: Props) {
  const [selected, setSelected] = useState<string[]>(result.supplements.map((item) => item.id));
  const toggle = (id: string) => setSelected((current) => current.includes(id)
    ? current.filter((item) => item !== id) : [...current, id]);
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-canvas p-4 text-ink">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">AI 整理并补充</h2>
          <button type="button" onClick={onClose} className="rounded-lg border border-line/20 px-3 py-1.5 text-xs">关闭</button>
        </div>
        <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2">
          <section className="min-w-0 rounded-xl border border-line/20 bg-surface p-3">
            <h3 className="mb-2 text-xs font-semibold text-ink-muted">原文</h3>
            <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{sourceText}</p>
          </section>
          <section className="min-w-0 rounded-xl border border-line/20 bg-surface p-3">
            <h3 className="mb-2 text-xs font-semibold text-ink-muted">整理后的原文</h3>
            <div className="space-y-2 text-[13px] leading-relaxed">
              {result.organizedBlocks.map((block, index) =>
                <p key={index} className={`break-words ${block.type === 'heading' ? 'font-semibold' : ''}`}>
                  {block.type === 'bullet' ? '• ' : ''}{block.text}
                </p>)}
            </div>
          </section>
        </div>
        {result.supplements.length > 0 && <section className="space-y-2">
          <h3 className="text-xs font-semibold text-ink-muted">AI 补充建议</h3>
          {result.supplements.map((item) => <label key={item.id} className="flex gap-2 rounded-xl border border-line/20 bg-surface p-3 text-[13px]">
            <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
            <span className="break-words">{item.text}</span>
          </label>)}
        </section>}
        <p className="text-xs text-ink-muted">应用会替换原有富文本格式；请核对 AI 整理和补充内容。</p>
        <button type="button" onClick={() => onApply(selected)} className="rounded-xl bg-accent px-4 py-2 text-sm text-white">
          {selected.length ? '应用整理与补充' : '只应用整理'}
        </button>
      </div>
    </div>
  );
}
