import type { SkinId } from './types';

/** 默认皮肤 */
export const DEFAULT_SKIN: SkinId = 'glass';

export interface SkinDefinition {
  id: SkinId;
  name: string;
  english: string;
  tagline: string;
  description: string;
  swatches: {
    light: string[];
    dark: string[];
  };
}

/** 皮肤元数据：桌面/手机共用，驱动设置页的选择卡 */
export const SKIN_DEFINITIONS: SkinDefinition[] = [
  {
    id: 'glass',
    name: '贴纸',
    english: 'Sticker Paper',
    tagline: '手写纸片与拙趣线稿',
    description: '奶油白底、深墨文字、彩色纸片和少量手绘简笔画。',
    swatches: {
      light: ['#F9F8F2', '#FFFDF6', '#7FA181', '#D9A890'],
      dark: ['#20251F', '#343B32', '#ADD09D', '#C99B87'],
    },
  },
  {
    id: 'vellum',
    name: '硫酸纸',
    english: 'Vellum',
    tagline: '叠层半透明纸与霓虹墨',
    description: '雾白或近黑底上叠半透明纸片，玫红与薄荷像油墨一样透出来。',
    swatches: {
      light: ['#F8F3F5', '#D62F74', '#F2B3CB', '#8FD8C5'],
      dark: ['#0B090E', '#E63C88', '#F0A6C5', '#9FE0C4'],
    },
  },
  {
    id: 'mote',
    name: '小墨',
    english: 'Mote',
    tagline: '会看你的珠光小墨团',
    description: '奶油紫底 + 长春花/青/花粉色，圆润卡片与会眨眼、会看向你的墨团。',
    swatches: {
      light: ['#F7F2FB', '#5B7CFF', '#5FD8F5', '#F2A6E7'],
      dark: ['#141326', '#7C97FF', '#7FE5FF', '#F5B8EE'],
    },
  },
];

export function getSkinDefinition(skin: SkinId): SkinDefinition {
  return SKIN_DEFINITIONS.find((item) => item.id === skin) ?? SKIN_DEFINITIONS[0];
}

export function isSkinId(value: unknown): value is SkinId {
  return value === 'glass' || value === 'vellum' || value === 'mote';
}

/** 将旧 Cursor 设置映射为新皮肤，非法值回退默认皮肤。 */
export function normalizeSkinId(value: unknown): SkinId {
  if (value === 'cursor') return 'glass';
  return isSkinId(value) ? value : DEFAULT_SKIN;
}

/** Electron 原生标题栏/窗口底色：与 CSS token 保持一致 */
export const SKIN_NATIVE_CHROME: Record<
  SkinId,
  Record<
    'light' | 'dark',
    {
      overlayColor: string;
      symbolColor: string;
      backgroundColor: string;
    }
  >
> = {
  glass: {
    light: { overlayColor: '#F3F0E5', symbolColor: '#354236', backgroundColor: '#F9F8F2' },
    dark: { overlayColor: '#30372E', symbolColor: '#EEEAD9', backgroundColor: '#20251F' },
  },
  vellum: {
    light: { overlayColor: '#FFFCFD', symbolColor: '#6C5E65', backgroundColor: '#F8F3F5' },
    dark: { overlayColor: '#19121C', symbolColor: '#B8A7B1', backgroundColor: '#0B090E' },
  },
  mote: {
    light: { overlayColor: '#FDFAFF', symbolColor: '#625F7A', backgroundColor: '#F7F2FB' },
    dark: { overlayColor: '#1E1D36', symbolColor: '#B5AED2', backgroundColor: '#141326' },
  },
};

/** 皮肤对应的默认圆角节奏 */
export const SKIN_RADII: Record<
  SkinId,
  { sm: number; md: number; lg: number; xl: number }
> = {
  glass: { sm: 10, md: 14, lg: 17, xl: 20 },
  vellum: { sm: 10, md: 14, lg: 18, xl: 22 },
  mote: { sm: 12, md: 16, lg: 20, xl: 26 },
};
