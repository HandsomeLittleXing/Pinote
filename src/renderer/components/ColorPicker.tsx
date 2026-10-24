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
      <div className="mb-2 text-xs font-medium text-ink-muted">选择颜色</div>
      <div className="color-picker">
        {COLOR_THEMES.map((theme) => {
          const bg = getBackgroundColor(theme.color, isDark);
          return (
            <button
              key={theme.color}
              type="button"
              aria-label={theme.name}
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
