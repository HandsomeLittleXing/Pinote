import React, { useCallback } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

/** 搜索栏组件 */
export const SearchBar: React.FC<SearchBarProps> = ({ value, onChange }) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    onChange('');
  }, [onChange]);

  return (
    <div className="relative">
      <Search
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
      />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder="搜索便签..."
        className="w-full rounded-lg border border-line/10 bg-muted py-2 pl-9 pr-8 text-sm text-ink placeholder:text-ink-subtle focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
      {value && (
        <button
          type="button"
          aria-label="清空搜索"
          className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-ink/5 hover:text-ink"
          onClick={handleClear}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
};
