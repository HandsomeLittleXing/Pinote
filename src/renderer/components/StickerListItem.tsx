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
import type { Sticker } from '../../shared/types';

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
  query: string;
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
  query,
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

  return (
    <article
      role="button"
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
      className="group relative flex cursor-pointer flex-col gap-2.5 rounded-xl border border-line/10 bg-surface p-3.5 text-left transition-all duration-200 hover:-translate-y-px hover:shadow-glass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-1 h-2 w-2 shrink-0 rounded-full shadow-sm"
          style={{ backgroundColor: color }}
        />
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
          <Highlight text={title} query={query} />
        </h3>
        {sticker.isPinned && <Pin size={13} className="mt-0.5 shrink-0 text-accent" />}
        {sticker.reminder && !sticker.reminderTriggered && (
          <Bell size={13} className="mt-0.5 shrink-0 text-warning" />
        )}
        <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                size="sm"
                label="便签操作"
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

      {snippet && (
        <p className="line-clamp-2 text-xs leading-relaxed text-ink-muted">
          <Highlight text={snippet} query={query} />
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

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap gap-1">
          {sticker.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[11px] text-accent"
            >
              {tag}
            </span>
          ))}
          {sticker.tags.length > 3 && (
            <span className="text-[11px] text-ink-subtle">+{sticker.tags.length - 3}</span>
          )}
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-ink-subtle">{timeAgo}</span>
      </div>
    </article>
  );
};
