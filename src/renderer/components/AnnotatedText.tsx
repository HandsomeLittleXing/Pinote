import React, { useMemo } from 'react';
import { splitAnnotatedText } from '../../shared/ai';
import { escapeRegExp } from '../../shared/note';
import type { AnnotationSpan } from '../../shared/types';

interface AnnotatedTextProps {
  text: string;
  spans: AnnotationSpan[];
  query?: string;
  className?: string;
}

function SearchText({ text, query }: { text: string; query?: string }) {
  const trimmed = query?.trim() ?? '';
  if (!trimmed) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(trimmed)})`, 'ig'));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <mark key={index} className="rounded-sm bg-accent/20 px-0.5 text-ink">
            {part}
          </mark>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

/** 桌面端非破坏性语义标注：普通 span，不写入编辑器 HTML */
export function AnnotatedText({ text, spans, query, className }: AnnotatedTextProps) {
  const segments = useMemo(() => splitAnnotatedText(text, spans), [text, spans]);

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (!segment.annotation) {
          return <SearchText key={index} text={segment.text} query={query} />;
        }
        const { kind, importance } = segment.annotation;
        return (
          <span
            key={index}
            className={`anno anno-${kind}${importance >= 3 ? ' anno--strong' : ''}`}
            data-kind={kind}
            data-importance={importance}
          >
            <SearchText text={segment.text} query={query} />
          </span>
        );
      })}
    </span>
  );
}
