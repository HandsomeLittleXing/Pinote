import React, { forwardRef } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '../../utils/cn';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

/** 浮层内容：玻璃面板，支持点击外部与 Esc 关闭（由 Radix 提供） */
export const PopoverContent = forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(function PopoverContent(
  { className, sideOffset = 8, align = 'end', ...props },
  ref
) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        collisionPadding={8}
        className={cn(
          'glass-panel z-50 max-h-[calc(100vh-20px)] w-[calc(100vw-20px)] max-w-[260px] overflow-y-auto rounded-lg p-3 animate-scaleIn',
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
});
