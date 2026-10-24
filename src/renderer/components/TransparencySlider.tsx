import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Slider } from './ui/Slider';

interface TransparencySliderProps {
  opacity: number;
  onChange: (value: number) => void;
}

/** 背景不透明度滑块 */
export const TransparencySlider: React.FC<TransparencySliderProps> = ({ opacity, onChange }) => {
  const percentage = Math.round(Math.min(1, Math.max(0.3, opacity)) * 100);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted">背景不透明度</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs tabular-nums text-ink-muted">
          {percentage}%
        </span>
      </div>
      <Slider
        value={percentage}
        min={30}
        max={100}
        step={5}
        label="背景不透明度"
        onValueChange={(value) => onChange(value / 100)}
      />
      <div className="mt-1 flex justify-between">
        <span className="text-[10px] text-ink-subtle">30%</span>
        <span className="text-[10px] text-ink-subtle">100%</span>
      </div>
      {percentage < 40 && (
        <div className="mt-2 flex items-center gap-1.5 rounded-md bg-warning/10 px-2 py-1 text-[11px] text-warning">
          <AlertTriangle size={12} />
          透明度过低可能影响阅读
        </div>
      )}
    </div>
  );
};
