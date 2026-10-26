import React from 'react';
import { cn } from '../../utils/cn';

/** 骨架屏占位 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-ink/10', className)} />;
}
