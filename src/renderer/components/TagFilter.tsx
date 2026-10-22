import React from 'react';

interface TagFilterProps {
  tags: string[];
  selectedTag: string | null;
  onTagSelect: (tag: string | null) => void;
}

/** 标签过滤器 */
export const TagFilter: React.FC<TagFilterProps> = ({ tags, selectedTag, onTagSelect }) => {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
          selectedTag === null
            ? 'bg-blue-500 text-white shadow-sm'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
        onClick={() => onTagSelect(null)}
      >
        全部
      </button>
      {tags.map((tag) => (
        <button
          key={tag}
          className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
            selectedTag === tag
              ? 'bg-blue-500 text-white shadow-sm'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
          onClick={() => onTagSelect(tag === selectedTag ? null : tag)}
        >
          {tag}
        </button>
      ))}
    </div>
  );
};
