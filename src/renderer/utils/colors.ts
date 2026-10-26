/** 颜色主题配置与渲染辅助 */
import {
  LEGACY_COLOR_MAP,
  STICKER_PALETTE,
  normalizeStickerColor,
  resolveStickerColor,
} from '../../shared/palette';
import type { ColorTheme, StickerColor } from '../../shared/types';

export { LEGACY_COLOR_MAP, STICKER_PALETTE, normalizeStickerColor, resolveStickerColor };

/** 供 ColorPicker / Settings 使用的色板 */
export const COLOR_THEMES: ColorTheme[] = STICKER_PALETTE;

/** 根据颜色值（含旧值）获取主题配置 */
export function getColorTheme(color: StickerColor): ColorTheme {
  return resolveStickerColor(color);
}

/** 根据是否深色模式获取背景色 */
export function getBackgroundColor(color: StickerColor, isDark: boolean): string {
  const theme = resolveStickerColor(color);
  return isDark ? theme.darkColor : theme.color;
}

/** 根据是否深色模式获取文字颜色 */
export function getTextColor(color: StickerColor, isDark: boolean): string {
  const theme = resolveStickerColor(color);
  return isDark ? theme.darkTextColor : theme.textColor;
}

/**
 * 将 hex 颜色转换为带透明度的 rgba。
 * 用于让便签背景透明、但正文和图标保持不透明。
 */
export function withAlpha(hex: string, alpha: number): string {
  const safeAlpha = Math.min(1, Math.max(0, alpha));
  const normalized = hex.trim().replace(/^#/, '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return `rgba(255, 255, 255, ${safeAlpha})`;
  }

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
}

/** 背景透明度下限 0.35，避免正文失去可读性 */
export function clampOpacity(opacity: number): number {
  if (!Number.isFinite(opacity)) return 1;
  return Math.min(1, Math.max(0.35, opacity));
}
