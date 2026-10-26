import React from 'react';
import { cn } from '../utils/cn';

interface WindowChromeProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * 列表/设置窗口的共享标题栏。
 * 右侧预留原生窗口按钮覆盖层的空间（约 150px）。
 */
export function WindowChrome({ icon, title, subtitle, actions, className }: WindowChromeProps) {
  return (
    <div
      className={cn(
        'flex h-10 shrink-0 items-center justify-between gap-3 border-b border-line/10 bg-surface px-4 pr-[150px]',
        className
      )}
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex min-w-0 items-center gap-2">
        {icon && <span className="shrink-0 text-ink-muted">{icon}</span>}
        <h1 className="truncate text-sm font-semibold text-ink">{title}</h1>
        {subtitle && <span className="shrink-0 text-xs text-ink-subtle">{subtitle}</span>}
      </div>
      {actions && (
        <div
          className="flex shrink-0 items-center gap-2"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
