import React, { useState } from 'react';
import { Chip } from './ui/Chip';
import { Popover, PopoverContent, PopoverTrigger } from './ui/Popover';

export type StickerFilter =
  | { type: 'all' }
  | { type: 'tag'; tag: string }
  | { type: 'pinned' }
  | { type: 'task' }
  | { type: 'reminder' };

interface FilterBarProps {
  tags: string[];
  filter: StickerFilter;
  onChange: (filter: StickerFilter) => void;
  className?: string;
}

/** 列表筛选：全部 / 标签 / 置顶 / 待办 / 提醒 */
export const FilterBar: React.FC<FilterBarProps> = ({ tags, filter, onChange, className = '' }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const visibleTags = tags.slice(0, 4);
  if (filter.type === 'tag' && !visibleTags.includes(filter.tag)) visibleTags.push(filter.tag);
  const hiddenTags = tags.filter((tag) => !visibleTags.includes(tag));
  const toggle = (next: StickerFilter) => {
    onChange(filter.type === next.type ? { type: 'all' } : next);
  };

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <Chip selected={filter.type === 'all'} onClick={() => onChange({ type: 'all' })}>
        全部
      </Chip>
      {visibleTags.map((tag) => (
        <Chip
          key={tag}
          selected={filter.type === 'tag' && filter.tag === tag}
          onClick={() =>
            onChange(filter.type === 'tag' && filter.tag === tag ? { type: 'all' } : { type: 'tag', tag })
          }
        >
          {tag}
        </Chip>
      ))}
      {hiddenTags.length > 0 && <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild><button type="button" className="rounded-full border border-line/20 px-3 py-1 text-xs text-ink-muted">更多标签</button></PopoverTrigger>
        <PopoverContent className="space-y-2">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标签"
            className="w-full rounded-lg border border-line/20 bg-surface px-2 py-1.5 text-xs text-ink" />
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {hiddenTags.filter((tag) => tag.toLowerCase().includes(query.trim().toLowerCase())).map((tag) =>
              <button key={tag} type="button" onClick={() => { onChange({ type: 'tag', tag }); setOpen(false); }}
                className="block w-full rounded-lg px-2 py-1.5 text-left text-xs text-ink hover:bg-muted">{tag}</button>)}
          </div>
        </PopoverContent>
      </Popover>}
      <span className="mx-1 h-4 w-px bg-line/10" />
      <Chip selected={filter.type === 'pinned'} onClick={() => toggle({ type: 'pinned' })}>
        置顶
      </Chip>
      <Chip selected={filter.type === 'task'} onClick={() => toggle({ type: 'task' })}>
        待办
      </Chip>
      <Chip selected={filter.type === 'reminder'} onClick={() => toggle({ type: 'reminder' })}>
        提醒
      </Chip>
    </div>
  );
};
