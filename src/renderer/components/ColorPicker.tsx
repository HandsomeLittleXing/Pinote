import React from 'react';
import { COLOR_THEMES, getBackgroundColor } from '../utils/colors';
import type { StickerColor } from '../../shared/types';

interface ColorPickerProps {
  currentColor: StickerColor;
  onColorChange: (color: StickerColor) => void;
  isDark: boolean;
}

/** 颜色选择器 */
export const ColorPicker: React.FC<ColorPickerProps> = ({ currentColor, onColorChange, isDark }) => {
  return (
    <div>
      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">选择颜色</div>
      <div className="color-picker">
        {COLOR_THEMES.map((theme) => {
          const bg = getBackgroundColor(theme.color, isDark);
          return (
            <button
              key={theme.color}
              className={`color-dot ${currentColor === theme.color ? 'active' : ''}`}
              style={{ backgroundColor: bg }}
              onClick={() => onColorChange(theme.color)}
              title={theme.name}
            />
          );
        })}
      </div>
    </div>
  );
};
