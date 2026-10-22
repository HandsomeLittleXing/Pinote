/** 颜色主题配置 */
import type { ColorTheme, StickerColor } from '../../shared/types';

export const COLOR_THEMES: ColorTheme[] = [
  { name: '黄', color: '#FFF9C4', darkColor: '#BDB76B', textColor: '#333333' },
  { name: '蓝', color: '#BBDEFB', darkColor: '#5C8EBF', textColor: '#1a237e' },
  { name: '绿', color: '#C8E6C9', darkColor: '#6B8E6B', textColor: '#1b5e20' },
  { name: '粉', color: '#F8BBD0', darkColor: '#C2738A', textColor: '#880e4f' },
  { name: '橙', color: '#FFE0B2', darkColor: '#D4A45A', textColor: '#e65100' },
  { name: '紫', color: '#E1BEE7', darkColor: '#9370DB', textColor: '#4a148c' },
  { name: '白', color: '#FFFFFF', darkColor: '#424242', textColor: '#212121' },
  { name: '灰', color: '#E0E0E0', darkColor: '#616161', textColor: '#424242' },
];

/** 根据颜色值获取主题配置 */
export function getColorTheme(color: StickerColor): ColorTheme {
  return COLOR_THEMES.find((t) => t.color === color) ?? COLOR_THEMES[0];
}

/** 根据是否深色模式获取背景色 */
export function getBackgroundColor(color: StickerColor, isDark: boolean): string {
  const theme = getColorTheme(color);
  return isDark ? theme.darkColor : theme.color;
}

/** 根据是否深色模式获取文字颜色 */
export function getTextColor(color: StickerColor, isDark: boolean): string {
  if (isDark) {
    return '#e0e0e0';
  }
  const theme = getColorTheme(color);
  return theme.textColor;
}
