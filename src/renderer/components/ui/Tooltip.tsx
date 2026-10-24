import React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '../../utils/cn';

export const TooltipProvider = TooltipPrimitive.Provider;

interface TooltipProps {
  label: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

/** 统一 Tooltip：使用反色背景，亮/暗模式自动适配 */
export function Tooltip({ label, children, side = 'bottom', className }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-[70] max-w-[min(220px,calc(100vw-20px))] rounded-md bg-ink px-2 py-1 text-[11px] font-medium leading-relaxed text-canvas shadow-float',
            'animate-fadeIn',
            className
          )}
        >
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
