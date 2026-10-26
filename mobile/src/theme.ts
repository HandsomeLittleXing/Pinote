import { useColorScheme } from 'react-native';
import { resolveStickerColor } from '@shared/palette';
import type { StickerColor } from '@shared/types';

export interface AppTheme {
  dark: boolean;
  colors: {
    backgroundStart: string;
    backgroundEnd: string;
    text: string;
    textMuted: string;
    textSubtle: string;
    accent: string;
    accentSoft: string;
    success: string;
    warning: string;
    danger: string;
    border: string;
    borderStrong: string;
    surface: string;
    /** 不透明卡片色：surfaceGlass 与页面背景的预合成结果（避免 elevation + 半透明底色的渲染瑕疵） */
    surfaceCard: string;
    surfaceGlass: string;
    surfaceStrong: string;
    inputBackground: string;
    glassTint: 'light' | 'dark';
    glassIntensity: number;
    blobA: string;
    blobB: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    pill: number;
  };
  typography: {
    caption: number;
    body: number;
    title: number;
    pageTitle: number;
    hero: number;
  };
}

const lightTheme: AppTheme = {
  dark: false,
  colors: {
    backgroundStart: '#F4F7FA',
    backgroundEnd: '#E7EEF7',
    text: '#0F172A',
    textMuted: '#64748B',
    textSubtle: '#94A3B8',
    accent: '#2F6FED',
    accentSoft: 'rgba(47, 111, 237, 0.10)',
    success: '#047857',
    warning: '#B45309',
    danger: '#DC2626',
    border: 'rgba(15, 23, 42, 0.08)',
    borderStrong: 'rgba(15, 23, 42, 0.14)',
    surface: '#FFFFFF',
    surfaceCard: '#F8FAFC',
    surfaceGlass: 'rgba(255, 255, 255, 0.52)',
    surfaceStrong: 'rgba(255, 255, 255, 0.84)',
    inputBackground: 'rgba(255, 255, 255, 0.56)',
    glassTint: 'light',
    glassIntensity: 55,
    blobA: 'rgba(47, 111, 237, 0.16)',
    blobB: 'rgba(34, 211, 238, 0.12)',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 10, md: 14, lg: 16, xl: 20, pill: 999 },
  typography: { caption: 11, body: 13, title: 15, pageTitle: 20, hero: 28 },
};

const darkTheme: AppTheme = {
  dark: true,
  colors: {
    backgroundStart: '#0B1220',
    backgroundEnd: '#111C2E',
    text: '#E6EDF7',
    textMuted: '#8FA2B8',
    textSubtle: '#64748B',
    accent: '#6AA5FF',
    accentSoft: 'rgba(106, 165, 255, 0.16)',
    success: '#34D399',
    warning: '#FBBF24',
    danger: '#F87171',
    border: 'rgba(148, 163, 184, 0.14)',
    borderStrong: 'rgba(148, 163, 184, 0.24)',
    surface: '#141E30',
    surfaceCard: '#111B2C',
    surfaceGlass: 'rgba(20, 30, 48, 0.55)',
    surfaceStrong: 'rgba(26, 38, 58, 0.84)',
    inputBackground: 'rgba(26, 38, 58, 0.56)',
    glassTint: 'dark',
    glassIntensity: 45,
    blobA: 'rgba(106, 165, 255, 0.14)',
    blobB: 'rgba(34, 211, 238, 0.10)',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 10, md: 14, lg: 16, xl: 20, pill: 999 },
  typography: { caption: 11, body: 13, title: 15, pageTitle: 20, hero: 28 },
};

/** 系统深色模式对应的主题 */
export function useAppTheme(): AppTheme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}

/** 便签色在当前模式下的背景/文字色（兼容旧色值） */
export function getStickerSurface(color: StickerColor, dark: boolean) {
  const palette = resolveStickerColor(color);
  return {
    background: dark ? palette.darkColor : palette.color,
    text: dark ? palette.darkTextColor : palette.textColor,
  };
}
