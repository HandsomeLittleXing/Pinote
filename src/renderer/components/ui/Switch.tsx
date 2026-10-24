import React from 'react';
import { cn } from '../../utils/cn';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** 无障碍名称 */
  label: string;
  disabled?: boolean;
  className?: string;
}

/** 开关：36×20，开为强调色 */
export function Switch({ checked, onCheckedChange, label, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45',
        'disabled:pointer-events-none disabled:opacity-50',
        checked ? 'bg-accent' : 'bg-ink/20',
        className
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}
