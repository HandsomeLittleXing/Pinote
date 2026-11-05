import React from 'react';
import { COLOR_THEMES, getBackgroundColor, resolveStickerColor } from '../utils/colors';
import { resolveGlassCardColor } from '../../shared/palette';
import type { SkinId, StickerColor } from '../../shared/types';

interface ColorPickerProps {
  currentColor: StickerColor;
  onColorChange: (color: StickerColor) => void;
  isDark: boolean;
  skin: SkinId;
}

/** 颜色选择器 */
export const ColorPicker: React.FC<ColorPickerProps> = ({ currentColor, onColorChange, isDark, skin }) => {
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-ink-muted">选择颜色</div>
      <div className="color-picker">
        {COLOR_THEMES.map((theme) => {
          const bg = skin === 'glass'
            ? resolveGlassCardColor(theme.color, isDark).tint
            : getBackgroundColor(theme.color, isDark);
          return (
            <button
              key={theme.color}
              type="button"
              aria-label={theme.name}
              className={`color-dot ${
                resolveStickerColor(currentColor).color === theme.color ? 'active' : ''
              }`}
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
