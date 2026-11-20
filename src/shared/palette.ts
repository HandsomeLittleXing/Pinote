import type { ColorTheme, StickerColor } from './types';

/**
 * 冷色便签板。
 * 亮/暗背景与文字色都经过对比度挑选，正文目标 AA。
 */
export const STICKER_PALETTE: ColorTheme[] = [
  {
    key: 'ice',
    name: '冰川',
    color: '#DFECFB',
    darkColor: '#1C2A3D',
    textColor: '#1E3A5F',
    darkTextColor: '#DDE8F7',
  },
  {
    key: 'lake',
    name: '湖蓝',
    color: '#DCEDF3',
    darkColor: '#193238',
    textColor: '#1F4650',
    darkTextColor: '#D8ECF1',
  },
  {
    key: 'mint',
    name: '薄荷',
    color: '#DFF2EC',
    darkColor: '#173029',
    textColor: '#1F4A3D',
    darkTextColor: '#D8F0E8',
  },
  {
    key: 'rose',
    name: '冷粉',
    color: '#F5E6ED',
    darkColor: '#352631',
    textColor: '#5A2A3D',
    darkTextColor: '#F5E3EA',
  },
  {
    key: 'sage',
    name: '鼠尾草',
    color: '#E6EEE3',
    darkColor: '#243027',
    textColor: '#33472F',
    darkTextColor: '#E4F0E0',
  },
  {
    key: 'lilac',
    name: '雾紫',
    color: '#EAE5F8',
    darkColor: '#28243A',
    textColor: '#3B2F63',
    darkTextColor: '#E8E3FA',
  },
  {
    key: 'frost',
    name: '霜白',
    color: '#FFFFFF',
    darkColor: '#1A2230',
    textColor: '#0F172A',
    darkTextColor: '#E6EDF7',
  },
  {
    key: 'cloud',
    name: '云灰',
    color: '#ECEFF4',
    darkColor: '#232B35',
    textColor: '#334155',
    darkTextColor: '#E5ECF4',
  },
];

/** 旧色值 → 新冷色值，只用于读取与归一化，不批量改数据 */
export const LEGACY_COLOR_MAP: Record<string, StickerColor> = {
  '#FFF9C4': '#DFECFB',
  '#BBDEFB': '#DCEDF3',
  '#C8E6C9': '#DFF2EC',
  '#F8BBD0': '#F5E6ED',
  '#FFE0B2': '#E6EEE3',
  '#E1BEE7': '#EAE5F8',
  '#FFFFFF': '#FFFFFF',
  '#E0E0E0': '#ECEFF4',
};

const DEFAULT_THEME = STICKER_PALETTE[0];

/** 解析色值：新旧色都返回冷色板配置，未知值回退冰川 */
export function resolveStickerColor(color: StickerColor): ColorTheme {
  const direct = STICKER_PALETTE.find((theme) => theme.color === color);
  if (direct) return direct;

  const mapped = LEGACY_COLOR_MAP[color];
  if (mapped) {
    return STICKER_PALETTE.find((theme) => theme.color === mapped) ?? DEFAULT_THEME;
  }

  return DEFAULT_THEME;
}

/** 归一化为新冷色值，用于新建便签 */
export function normalizeStickerColor(color: StickerColor): StickerColor {
  return resolveStickerColor(color).color;
}

export interface GlassCardColor {
  tint: string;
  surface: string;
  ink: string;
  border: string;
}

const GLASS_TINTS: Record<string, string> = {
  ice: '#708C71',
  lake: '#79A5A3',
  mint: '#7FA181',
  rose: '#C88774',
  sage: '#9BA370',
  lilac: '#A493BF',
  frost: '#B5A77B',
  cloud: '#8B9FB5',
};

const STICKER_PAPER_LIGHT: Record<string, string> = {
  ice: '#E9E2BB', lake: '#DFECEA', mint: '#DEEBE3', rose: '#F3DFD3',
  sage: '#EDE9CF', lilac: '#EEE9F3', frost: '#FFFDF6', cloud: '#E3E8F1',
};

const STICKER_PAPER_DARK: Record<string, string> = {
  ice: '#354236', lake: '#304345', mint: '#334538', rose: '#493B38',
  sage: '#464535', lilac: '#3E3A49', frost: '#343831', cloud: '#3A3D39',
};

/** 第一套皮肤按便签颜色选取纸张色，正文保持深墨对比度。 */
export function resolveGlassCardColor(color: StickerColor, dark: boolean): GlassCardColor {
  const key = resolveStickerColor(color).key;
  const tint = GLASS_TINTS[key];
  return {
    tint,
    surface: dark ? STICKER_PAPER_DARK[key] : STICKER_PAPER_LIGHT[key],
    ink: dark ? '#F7F1DF' : '#26352A',
    border: dark ? '#F5EFD445' : '#46574352',
  };
}
