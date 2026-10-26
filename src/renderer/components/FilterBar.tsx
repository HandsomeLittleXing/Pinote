import React from 'react';
import { Chip } from './ui/Chip';

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
}

/** 列表筛选：全部 / 标签 / 置顶 / 待办 / 提醒 */
export const FilterBar: React.FC<FilterBarProps> = ({ tags, filter, onChange }) => {
  const toggle = (next: StickerFilter) => {
    onChange(filter.type === next.type ? { type: 'all' } : next);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Chip selected={filter.type === 'all'} onClick={() => onChange({ type: 'all' })}>
        全部
      </Chip>
      {tags.map((tag) => (
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
