import React from 'react';

interface TransparencySliderProps {
  opacity: number;
  onChange: (event: Event, value: number | number[]) => void;
}

/** 透明度滑块组件 */
export const TransparencySlider: React.FC<TransparencySliderProps> = ({ opacity, onChange }) => {
  const percentage = Math.round(opacity * 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">透明度</span>
        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
          {percentage}%
        </span>
      </div>
      <input
        type="range"
        min={20}
        max={100}
        step={5}
        value={percentage}
        onChange={(e) => onChange(e.nativeEvent, Number(e.target.value) / 100)}
        className="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full appearance-none cursor-pointer accent-blue-500"
      />
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-gray-400">20%</span>
        <span className="text-[10px] text-gray-400">100%</span>
      </div>
      {percentage < 30 && (
        <div className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-md">
          ⚠ 透明度过低可能影响阅读
        </div>
      )}
    </div>
  );
};
