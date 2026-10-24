import React, { useState, useCallback, useRef } from 'react';
import { Plus } from 'lucide-react';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';

interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
}

/** 标签输入组件 */
export const TagInput: React.FC<TagInputProps> = ({ tags, onTagsChange }) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddTag = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed]);
    }
    setInputValue('');
    inputRef.current?.focus();
  }, [inputValue, tags, onTagsChange]);

  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      onTagsChange(tags.filter((tag) => tag !== tagToRemove));
    },
    [tags, onTagsChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddTag();
      } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
        handleRemoveTag(tags[tags.length - 1]);
      }
    },
    [handleAddTag, inputValue, tags, handleRemoveTag]
  );

  return (
    <div>
      <div className="mb-2 text-xs font-medium text-ink-muted">标签</div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <Chip key={tag} onRemove={() => handleRemoveTag(tag)}>
            {tag}
          </Chip>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入标签后回车"
          className="min-w-0 flex-1 rounded-md border border-line/10 bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-subtle focus:border-transparent focus:outline-none focus:ring-1 focus:ring-accent/40"
        />
        <Button size="sm" onClick={handleAddTag} disabled={!inputValue.trim()}>
          <Plus size={12} /> 添加
        </Button>
      </div>
    </div>
  );
};
