import React, { useEffect, useRef } from 'react';
import { cn } from '../utils/cn';

export type MascotMood = 'idle' | 'thinking' | 'happy' | 'sleepy';

interface MascotProps {
  size?: number;
  mood?: MascotMood;
  className?: string;
}

/**
 * 桌面端小墨：珠光墨团 + 眼睛跟随鼠标。
 * 只改 CSS 变量，不在 React 里逐帧 setState。
 */
export function Mascot({ size = 28, mood = 'idle', className }: MascotProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const handleMove = (event: MouseEvent) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const node = ref.current;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        if (rect.width === 0) return;
        const dx = Math.max(-3, Math.min(3, (event.clientX - (rect.left + rect.width / 2)) / 28));
        const dy = Math.max(-2.5, Math.min(2.5, (event.clientY - (rect.top + rect.height / 2)) / 28));
        node.style.setProperty('--eye-x', `${dx}px`);
        node.style.setProperty('--eye-y', `${dy}px`);
      });
    };
    window.addEventListener('mousemove', handleMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn('frost-mascot', `frost-mascot--${mood}`, className)}
      style={{ width: size, height: size }}
    >
      <span className="frost-mascot__eye">
        <span className="frost-mascot__pupil" />
      </span>
      <span className="frost-mascot__eye">
        <span className="frost-mascot__pupil" />
      </span>
    </div>
  );
}
