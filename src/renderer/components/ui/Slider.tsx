import React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '../../utils/cn';

interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange: (value: number) => void;
  /** 无障碍名称 */
  label: string;
  className?: string;
}

/** 单值滑杆 */
export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  label,
  className,
}: SliderProps) {
  return (
    <SliderPrimitive.Root
      className={cn('relative flex h-4 w-full touch-none select-none items-center', className)}
      value={[value]}
      min={min}
      max={max}
      step={step}
      aria-label={label}
      onValueChange={([next]) => onValueChange(next)}
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-ink/20">
        <SliderPrimitive.Range className="absolute h-full bg-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-3.5 w-3.5 rounded-full border-2 border-surface bg-accent shadow-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45" />
    </SliderPrimitive.Root>
  );
}
