import React from 'react';
import { Chip } from './ui/Chip';

interface TagFilterProps {
  tags: string[];
  selectedTag: string | null;
  onTagSelect: (tag: string | null) => void;
}

/** 标签过滤器 */
export const TagFilter: React.FC<TagFilterProps> = ({ tags, selectedTag, onTagSelect }) => {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip selected={selectedTag === null} onClick={() => onTagSelect(null)}>
        全部
      </Chip>
      {tags.map((tag) => (
        <Chip
          key={tag}
          selected={selectedTag === tag}
          onClick={() => onTagSelect(tag === selectedTag ? null : tag)}
        >
          {tag}
        </Chip>
      ))}
    </div>
  );
};
