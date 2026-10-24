import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ChipProps {
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  className?: string;
}

/** 标签 chip：可选选中态与移除按钮 */
export function Chip({ children, selected = false, onClick, onRemove, className }: ChipProps) {
  const content = (
    <>
      <span className="truncate">{children}</span>
      {onRemove && (
        <span
          role="button"
          tabIndex={0}
          aria-label={`删除 ${String(children)}`}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.stopPropagation();
              onRemove();
            }
          }}
          className="rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100"
        >
          <X size={11} />
        </span>
      )}
    </>
  );

  const classes = cn(
    'inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors',
    selected ? 'bg-accent/10 text-accent' : 'bg-muted text-ink-muted hover:bg-muted/70',
    onClick && 'cursor-pointer',
    className
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {content}
      </button>
    );
  }

  return <span className={classes}>{content}</span>;
}
