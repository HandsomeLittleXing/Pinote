import React from 'react';
import { cn } from '../../utils/cn';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/** 空状态：玻璃圆 + 图标 + 标题 + 说明 + 操作 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex h-full flex-col items-center justify-center px-6 py-10 text-center',
        className
      )}
    >
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-line/10 bg-surface/70 text-ink-subtle shadow-glass backdrop-blur">
        {icon}
      </div>
      <h3 className="text-sm font-medium text-ink">{title}</h3>
      {description && (
        <p className="mt-1 max-w-[280px] text-xs leading-relaxed text-ink-subtle">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
