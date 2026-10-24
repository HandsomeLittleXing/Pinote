import React, { forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { Tooltip } from './Tooltip';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 无障碍名称，同时作为 Tooltip 默认文案 */
  label: string;
  size?: 'sm' | 'md';
  active?: boolean;
  danger?: boolean;
  /** 传入后包裹 Tooltip；作为菜单触发器使用时建议不传，由外层组合 */
  tooltip?: string;
}

const sizeClass: Record<'sm' | 'md', string> = {
  sm: 'h-6 w-6',
  md: 'h-7 w-7',
};

/** 图标按钮：统一尺寸、状态与焦点环 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    label,
    tooltip,
    size = 'md',
    active = false,
    danger = false,
    className,
    children,
    type = 'button',
    ...props
  },
  ref
) {
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={active || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45',
        'disabled:pointer-events-none disabled:opacity-40',
        sizeClass[size],
        active
          ? 'bg-accent/10 text-accent'
          : 'text-ink-muted hover:bg-ink/5 hover:text-ink',
        danger && 'hover:bg-danger/10 hover:text-danger',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );

  if (!tooltip) return button;
  return <Tooltip label={tooltip}>{button}</Tooltip>;
});
