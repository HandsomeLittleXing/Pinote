import React from 'react';
import { cn } from '../../utils/cn';

export type StatusBadgeStatus = 'connected' | 'disconnected' | 'syncing' | 'error' | 'disabled';

const statusConfig: Record<
  StatusBadgeStatus,
  { label: string; dot: string; text: string }
> = {
  connected: { label: '已连接', dot: 'bg-success', text: 'text-success' },
  disconnected: { label: '未连接', dot: 'bg-ink-subtle', text: 'text-ink-muted' },
  syncing: { label: '同步中', dot: 'bg-accent animate-pulse', text: 'text-accent' },
  error: { label: '异常', dot: 'bg-danger', text: 'text-danger' },
  disabled: { label: '未启用', dot: 'bg-ink-subtle', text: 'text-ink-subtle' },
};

interface StatusBadgeProps {
  status: StatusBadgeStatus;
  label?: string;
  className?: string;
}

/** 状态徽标：圆点 + 文案 */
export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium',
        config.text,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {label ?? config.label}
    </span>
  );
}
