import React from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { Bell, Copy, Ellipsis, Eye, EyeOff, Pin, PinOff, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from './ui/DropdownMenu';
import { IconButton } from './ui/IconButton';
import { getBackgroundColor } from '../utils/colors';
import { extractTitle } from '../utils/position';
import { escapeRegExp, extractSnippet, getChecklistProgress } from '../utils/note';
import { isAIUsable, noteToPlainText } from '../../shared/ai';
import { AnnotatedText } from './AnnotatedText';
import type { Sticker } from '../../shared/types';
import type { SkinId } from '../../shared/types';
import { resolveGlassCardColor } from '../../shared/palette';
import { getStickerDoodleForId, getStickerScatterVariant, STICKER_DOODLES } from '../../shared/stickerDoodles';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

interface HighlightProps {
  text: string;
  query: string;
}

/** 搜索命中高亮（文本已做过标签剥离，安全） */
const Highlight: React.FC<HighlightProps> = ({ text, query }) => {
  const trimmed = query.trim();
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
};

interface StickerListItemProps {
  sticker: Sticker;
  isDark: boolean;
  skin: SkinId;
  variant?: 'featured' | 'compact' | 'standard';
  query: string;
  showAiSummary?: boolean;
  showAiTags?: boolean;
  onFocus: (id: string) => void;
  onDelete: (sticker: Sticker) => void;
  onToggleVisible: (id: string) => void;
  onTogglePin: (id: string) => void;
  onCopy: (sticker: Sticker) => void;
}

/** 列表卡片 */
export const StickerListItem: React.FC<StickerListItemProps> = ({
  sticker,
  isDark,
  skin,
  variant = 'standard',
  query,
  showAiSummary = true,
  showAiTags = true,
  onFocus,
  onDelete,
  onToggleVisible,
  onTogglePin,
  onCopy,
}) => {
  const title = extractTitle(sticker.content);
  const snippet = extractSnippet(sticker.content, title, 120);
  const progress = getChecklistProgress(sticker.content);
  const timeAgo = dayjs(sticker.updatedAt).fromNow();
  const color = getBackgroundColor(sticker.color, isDark);
  const glass = skin === 'glass' ? resolveGlassCardColor(sticker.color, isDark) : null;
  const doodle = glass ? STICKER_DOODLES[getStickerDoodleForId(sticker.id)] : null;
  const scatter = glass ? getStickerScatterVariant(sticker.id) : undefined;
  const featured = glass !== null && variant === 'featured';
  const compact = glass !== null && variant === 'compact';
  const freshAI = isAIUsable(sticker.ai, noteToPlainText(sticker.content))
    ? sticker.ai
    : null;
  const spans = freshAI?.spans ?? [];
  const summary =
    freshAI?.summary && showAiSummary ? freshAI.summary : null;
  const aiTags =
    freshAI && showAiTags
      ? freshAI.tags.filter((tag) => !sticker.tags.includes(tag)).slice(0, compact ? 1 : 2)
      : [];
  const compactPreview = summary ?? snippet;
  const hasFeaturePreview = Boolean(summary || snippet || progress.total > 0);

  return (
    <div className="sticker-list-card min-w-0">
      <article
        role="button"
        data-scatter={scatter}
        tabIndex={0}
        aria-label={`打开便签：${title}`}
        onClick={() => onFocus(sticker.id)}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === 'Enter') {
            event.preventDefault();
            onFocus(sticker.id);
          } else if (event.key === 'Delete') {
            event.preventDefault();
            onDelete(sticker);
          }
        }}
        className={`group relative flex h-full cursor-pointer flex-col gap-2.5 rounded-xl border border-line/10 bg-surface p-3.5 text-left transition-all duration-200 hover:-translate-y-px hover:shadow-glass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 ${glass ? 'glass-note-card' : ''} ${featured ? 'glass-note-card--featured' : ''} ${compact ? 'glass-note-card--compact' : ''}`}
        style={glass ? { color: glass.ink, '--note-tint': glass.tint, '--note-surface': glass.surface } as React.CSSProperties : undefined}
      >
      {doodle && <svg className="sticker-card-doodle" viewBox={doodle.viewBox}
        aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3.8"
        strokeLinecap="round" strokeLinejoin="round">
        {doodle.paths.map((path, index) => <path key={index} d={path} />)}
      </svg>}
      <div className="flex items-start gap-2">
        <span
          className="mt-1 h-2 w-2 shrink-0 rounded-full shadow-sm"
          style={{ backgroundColor: glass?.tint ?? color }}
        />
        <h3 className={`min-w-0 flex-1 text-ink ${featured ? 'line-clamp-2 text-lg font-semibold' : compact ? 'truncate text-[13px] font-semibold' : 'truncate text-sm font-medium'}`}>
          {query ? (
            <Highlight text={title} query={query} />
          ) : (
            <AnnotatedText text={title} spans={spans} />
          )}
        </h3>
        {sticker.isPinned && <Pin size={13} className="mt-0.5 shrink-0 text-accent" />}
        {sticker.reminder && !sticker.reminderTriggered && (
          <Bell size={13} className="mt-0.5 shrink-0 text-warning" />
        )}
        <div className={`shrink-0 transition-opacity ${featured || compact ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                size="sm"
                label="便签操作"
                className={featured ? 'glass-feature-action' : undefined}
                onClick={(event) => event.stopPropagation()}
              >
                <Ellipsis size={14} />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onToggleVisible(sticker.id)}>
                {sticker.isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                {sticker.isVisible ? '隐藏' : '显示'}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onTogglePin(sticker.id)}>
                {sticker.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                {sticker.isPinned ? '取消置顶' : '置顶'}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onCopy(sticker)}>
                <Copy size={14} /> 复制内容
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => onDelete(sticker)}
                className="data-[highlighted]:bg-danger/10 data-[highlighted]:text-danger"
              >
                <Trash2 size={14} /> 删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className={featured && hasFeaturePreview ? 'glass-feature-body' : 'contents'}>
        {compact && compactPreview ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-ink-muted">
            {query ? (
              <Highlight text={compactPreview} query={query} />
            ) : summary ? (
              compactPreview
            ) : (
              <AnnotatedText text={compactPreview} spans={spans} />
            )}
          </p>
        ) : null}

        {!compact && summary && (
          <p className="line-clamp-1 text-xs leading-relaxed text-ink">
            <span className="font-semibold text-accent">✦ </span>
            {summary}
          </p>
        )}

        {!compact && snippet && (
          <p className={`${featured ? 'line-clamp-3 text-sm' : summary ? 'line-clamp-1 text-xs' : 'line-clamp-2 text-xs'} leading-relaxed text-ink-muted`}>
            {query ? (
              <Highlight text={snippet} query={query} />
            ) : (
              <AnnotatedText text={snippet} spans={spans} />
            )}
          </p>
        )}

        {progress.total > 0 && (
          <div className="flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink/10">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              />
            </div>
            <span className="text-[11px] tabular-nums text-ink-subtle">
              {progress.done}/{progress.total}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap gap-1">
          {sticker.tags.slice(0, compact ? 1 : 3).map((tag) => (
            <span
              key={tag}
              className="max-w-full truncate rounded-md bg-accent/10 px-1.5 py-0.5 text-[11px] text-accent"
            >
              {tag}
            </span>
          ))}
          {sticker.tags.length > (compact ? 1 : 3) && (
            <span className="text-[11px] text-ink-subtle">+{sticker.tags.length - (compact ? 1 : 3)}</span>
          )}
          {aiTags.map((tag) => (
            <span
              key={`ai-${tag}`}
              className="ai-tag rounded-md border px-1.5 py-0.5 text-[11px]"
            >
              ✦ {tag}
            </span>
          ))}
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-ink-subtle">{timeAgo}</span>
      </div>
      </article>
    </div>
  );
};
