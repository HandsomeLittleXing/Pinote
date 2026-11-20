import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { resolveStickerColor } from '@shared/palette';
import { SKIN_RADII } from '@shared/skins';
import type { AnnotationKind, SkinId, StickerColor, ThemeMode } from '@shared/types';
import {
  DEFAULT_PREFERENCES,
  getPreferences,
  savePreferences,
  type MobilePreferences,
} from './storage/preferences';

export interface AnnotationStyle {
  color: string;
  background: string;
  underline: 'solid' | 'dotted' | 'dashed' | 'none';
}

export interface AppTheme {
  skin: SkinId;
  dark: boolean;
  mode: 'light' | 'dark';
  colors: {
    backgroundStart: string;
    backgroundEnd: string;
    text: string;
    textMuted: string;
    textSubtle: string;
    accent: string;
    accentSoft: string;
    accent2: string;
    onAccent: string;
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
    glassTop: string;
    glassBottom: string;
    blobA: string;
    blobB: string;
    blobC: string | null;
    brandPrimary: string;
    brandSecondary: string;
    brandTertiary: string;
    selection: string;
    caret: string;
    shadow: string;
  };
  annotations: Record<AnnotationKind, AnnotationStyle>;
  effects: {
    layeredPaper: boolean;
    mascot: boolean;
    grain: boolean;
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

interface ThemeSpec {
  bgStart: string;
  bgEnd: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  accent: string;
  accentSoft: string;
  accent2: string;
  highlight: string;
  onAccent: string;
  success: string;
  warning: string;
  danger: string;
  border: string;
  borderStrong: string;
  surface: string;
  surfaceCard: string;
  surfaceGlass: string;
  surfaceStrong: string;
  inputBackground: string;
  glassTop: string;
  glassBottom: string;
  blobA: string;
  blobB: string;
  blobC: string | null;
  brandPrimary: string;
  brandSecondary: string;
  brandTertiary: string;
  selection: string;
  caret: string;
  shadow: string;
  annotations: Record<AnnotationKind, string>;
}

const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
const TYPOGRAPHY = { caption: 11, body: 13, title: 15, pageTitle: 20, hero: 28 };

function rgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value.slice(0, 6);
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const GLASS_LIGHT: ThemeSpec = {
  bgStart: '#EEE9DB',
  bgEnd: '#F1EFE6',
  text: '#26352A',
  textMuted: '#414B40',
  textSubtle: '#596458',
  accent: '#315E3D',
  accentSoft: 'rgba(49, 94, 61, 0.13)',
  accent2: '#82683F',
  highlight: '#BBD3AD',
  onAccent: '#FFFFFF',
  success: '#23744A',
  warning: '#95600F',
  danger: '#A94444',
  border: 'rgba(32, 41, 32, 0.18)',
  borderStrong: 'rgba(32, 41, 32, 0.30)',
  surface: '#F9F8F2',
  surfaceCard: '#F9F8F2',
  surfaceGlass: 'rgba(249, 248, 242, 0.96)',
  surfaceStrong: '#F9F8F2',
  inputBackground: '#EEEDE4',
  glassTop: 'transparent',
  glassBottom: 'transparent',
  blobA: 'transparent',
  blobB: 'transparent',
  blobC: null,
  brandPrimary: '#799C70',
  brandSecondary: '#D7A28D',
  brandTertiary: '#D4C185',
  selection: '#BDD5AF',
  caret: '#315E3D',
  shadow: '#263428',
  annotations: {
    time: '#0E8F7E',
    place: '#4D5FE8',
    person: '#C22868',
    action: '#6E8F00',
    important: '#A96100',
  },
};

const GLASS_DARK: ThemeSpec = {
  bgStart: '#20251F',
  bgEnd: '#272E26',
  text: '#F7F1DF',
  textMuted: '#DDD8C8',
  textSubtle: '#B8B8A9',
  accent: '#ADD09D',
  accentSoft: 'rgba(173, 208, 157, 0.17)',
  accent2: '#E1C28D',
  highlight: '#BDD5AF',
  onAccent: '#1C2A20',
  success: '#5FE3B4',
  warning: '#FFD166',
  danger: '#FF8F9F',
  border: 'rgba(247, 241, 223, 0.20)',
  borderStrong: 'rgba(247, 241, 223, 0.31)',
  surface: '#30372E',
  surfaceCard: '#343B32',
  surfaceGlass: 'rgba(48, 55, 46, 0.96)',
  surfaceStrong: '#3B4338',
  inputBackground: '#353D33',
  glassTop: 'transparent',
  glassBottom: 'transparent',
  blobA: 'transparent',
  blobB: 'transparent',
  blobC: null,
  brandPrimary: '#ADD09D',
  brandSecondary: '#C99B87',
  brandTertiary: '#D3C08B',
  selection: '#ADD09D',
  caret: '#ADD09D',
  shadow: '#000000',
  annotations: {
    time: '#7FE3DF',
    place: '#A5B4FF',
    person: '#FF9FC4',
    action: '#C8F08A',
    important: '#FFD166',
  },
};

const VELLUM_LIGHT: ThemeSpec = {
  bgStart: '#F8F3F5',
  bgEnd: '#F1E8EC',
  text: '#1C1519',
  textMuted: '#57464D',
  textSubtle: '#6D5D64',
  accent: '#C22868',
  accentSoft: 'rgba(214, 47, 116, 0.12)',
  accent2: '#0E8F7E',
  highlight: '#F2B3CB',
  onAccent: '#FFFFFF',
  success: '#0E8F7E',
  warning: '#A05A1F',
  danger: '#B93A4B',
  border: 'rgba(28, 21, 25, 0.10)',
  borderStrong: 'rgba(28, 21, 25, 0.18)',
  surface: '#FFFCFD',
  surfaceCard: '#FBF6F8',
  surfaceGlass: 'rgba(255, 252, 253, 0.55)',
  surfaceStrong: 'rgba(255, 252, 253, 0.88)',
  inputBackground: 'rgba(255, 252, 253, 0.65)',
  glassTop: 'rgba(255, 255, 255, 0.58)',
  glassBottom: 'rgba(255, 255, 255, 0.08)',
  blobA: 'rgba(214, 47, 116, 0.16)',
  blobB: 'rgba(143, 216, 197, 0.18)',
  blobC: 'rgba(242, 179, 203, 0.16)',
  brandPrimary: '#D62F74',
  brandSecondary: '#8FD8C5',
  brandTertiary: '#F2B3CB',
  selection: '#F2B3CB',
  caret: '#D62F74',
  shadow: '#3A1726',
  annotations: {
    time: '#0E8F7E',
    place: '#4D5FE8',
    person: '#C22868',
    action: '#6E8F00',
    important: '#A96100',
  },
};

const VELLUM_DARK: ThemeSpec = {
  bgStart: '#0B090E',
  bgEnd: '#120E15',
  text: '#F5EDF2',
  textMuted: '#C0AEB8',
  textSubtle: '#8F7C87',
  accent: '#E63C88',
  accentSoft: 'rgba(230, 60, 136, 0.18)',
  accent2: '#9FE0C4',
  highlight: '#F0A6C5',
  onAccent: '#180A10',
  success: '#9FE0C4',
  warning: '#F0B56A',
  danger: '#FF8A9E',
  border: 'rgba(245, 237, 242, 0.12)',
  borderStrong: 'rgba(245, 237, 242, 0.20)',
  surface: '#19121C',
  surfaceCard: '#1A131A',
  surfaceGlass: 'rgba(25, 18, 28, 0.62)',
  surfaceStrong: 'rgba(35, 25, 38, 0.88)',
  inputBackground: 'rgba(35, 25, 38, 0.65)',
  glassTop: 'rgba(255, 255, 255, 0.08)',
  glassBottom: 'rgba(230, 60, 136, 0.03)',
  blobA: 'rgba(230, 60, 136, 0.22)',
  blobB: 'rgba(159, 224, 196, 0.12)',
  blobC: 'rgba(240, 166, 197, 0.14)',
  brandPrimary: '#E63C88',
  brandSecondary: '#9FE0C4',
  brandTertiary: '#F0A6C5',
  selection: '#E63C88',
  caret: '#E63C88',
  shadow: '#000000',
  annotations: {
    time: '#7FE8CF',
    place: '#A5B4FF',
    person: '#FFA8DD',
    action: '#C8E87A',
    important: '#FFD166',
  },
};

const MOTE_LIGHT: ThemeSpec = {
  bgStart: '#F7F2FB',
  bgEnd: '#EEE8F8',
  text: '#24243A',
  textMuted: '#56546E',
  textSubtle: '#6B6983',
  accent: '#4F6BEA',
  accentSoft: 'rgba(91, 124, 255, 0.12)',
  accent2: '#0B93A8',
  highlight: '#F2A6E7',
  onAccent: '#FFFFFF',
  success: '#0F9D74',
  warning: '#B06A00',
  danger: '#C2425A',
  border: 'rgba(36, 36, 58, 0.10)',
  borderStrong: 'rgba(36, 36, 58, 0.18)',
  surface: '#FFFFFF',
  surfaceCard: '#FBF8FF',
  surfaceGlass: 'rgba(255, 255, 255, 0.58)',
  surfaceStrong: 'rgba(255, 255, 255, 0.88)',
  inputBackground: 'rgba(255, 255, 255, 0.68)',
  glassTop: 'rgba(255, 255, 255, 0.62)',
  glassBottom: 'rgba(255, 255, 255, 0.10)',
  blobA: 'rgba(91, 124, 255, 0.16)',
  blobB: 'rgba(95, 216, 245, 0.14)',
  blobC: 'rgba(242, 166, 231, 0.14)',
  brandPrimary: '#5B7CFF',
  brandSecondary: '#5FD8F5',
  brandTertiary: '#F2A6E7',
  selection: '#F2A6E7',
  caret: '#4F6BEA',
  shadow: '#24243A',
  annotations: {
    time: '#0B93A8',
    place: '#4F6BEA',
    person: '#C94F98',
    action: '#6E8F00',
    important: '#A96100',
  },
};

const MOTE_DARK: ThemeSpec = {
  bgStart: '#141326',
  bgEnd: '#191833',
  text: '#F6F0FF',
  textMuted: '#B9B4D6',
  textSubtle: '#8B87A8',
  accent: '#7C97FF',
  accentSoft: 'rgba(124, 151, 255, 0.18)',
  accent2: '#7FE5FF',
  highlight: '#F5B8EE',
  onAccent: '#17142D',
  success: '#7DE0C0',
  warning: '#FFD166',
  danger: '#FF8F9F',
  border: 'rgba(246, 240, 255, 0.12)',
  borderStrong: 'rgba(246, 240, 255, 0.20)',
  surface: '#1E1D36',
  surfaceCard: '#201F38',
  surfaceGlass: 'rgba(30, 29, 54, 0.62)',
  surfaceStrong: 'rgba(39, 38, 66, 0.88)',
  inputBackground: 'rgba(39, 38, 66, 0.68)',
  glassTop: 'rgba(255, 255, 255, 0.08)',
  glassBottom: 'rgba(124, 151, 255, 0.03)',
  blobA: 'rgba(124, 151, 255, 0.18)',
  blobB: 'rgba(127, 229, 255, 0.12)',
  blobC: 'rgba(245, 184, 238, 0.12)',
  brandPrimary: '#5B7CFF',
  brandSecondary: '#7CE3FA',
  brandTertiary: '#F7B8EF',
  selection: '#93AAFF',
  caret: '#7C97FF',
  shadow: '#000000',
  annotations: {
    time: '#7FE5FF',
    place: '#A5B4FF',
    person: '#FFA8DD',
    action: '#C8E87A',
    important: '#FFD166',
  },
};

const SPECS: Record<SkinId, Record<'light' | 'dark', ThemeSpec>> = {
  glass: { light: GLASS_LIGHT, dark: GLASS_DARK },
  vellum: { light: VELLUM_LIGHT, dark: VELLUM_DARK },
  mote: { light: MOTE_LIGHT, dark: MOTE_DARK },
};

const UNDERLINES: Record<AnnotationKind, AnnotationStyle['underline']> = {
  time: 'solid',
  place: 'dashed',
  person: 'solid',
  action: 'none',
  important: 'solid',
};

function buildAnnotations(spec: ThemeSpec, dark: boolean): Record<AnnotationKind, AnnotationStyle> {
  const kinds: AnnotationKind[] = ['time', 'place', 'person', 'action', 'important'];
  const result = {} as Record<AnnotationKind, AnnotationStyle>;
  for (const kind of kinds) {
    const color = spec.annotations[kind];
    const alpha = kind === 'important' ? (dark ? 0.24 : 0.18) : dark ? 0.18 : 0.12;
    result[kind] = {
      color,
      background: rgba(color, alpha),
      underline: UNDERLINES[kind],
    };
  }
  return result;
}

/** 构造某套皮肤 + 明暗组合的完整 token */
export function buildAppTheme(skin: SkinId, dark: boolean): AppTheme {
  const spec = SPECS[skin][dark ? 'dark' : 'light'];
  const radii = SKIN_RADII[skin];
  return {
    skin,
    dark,
    mode: dark ? 'dark' : 'light',
    colors: {
      backgroundStart: spec.bgStart,
      backgroundEnd: spec.bgEnd,
      text: spec.text,
      textMuted: spec.textMuted,
      textSubtle: spec.textSubtle,
      accent: spec.accent,
      accentSoft: spec.accentSoft,
      accent2: spec.accent2,
      onAccent: spec.onAccent,
      success: spec.success,
      warning: spec.warning,
      danger: spec.danger,
      border: spec.border,
      borderStrong: spec.borderStrong,
      surface: spec.surface,
      surfaceCard: spec.surfaceCard,
      surfaceGlass: spec.surfaceGlass,
      surfaceStrong: spec.surfaceStrong,
      inputBackground: spec.inputBackground,
      glassTint: dark ? 'dark' : 'light',
      glassIntensity: skin === 'glass' ? 18 : dark ? 45 : 55,
      glassTop: spec.glassTop,
      glassBottom: spec.glassBottom,
      blobA: spec.blobA,
      blobB: spec.blobB,
      blobC: spec.blobC,
      brandPrimary: spec.brandPrimary,
      brandSecondary: spec.brandSecondary,
      brandTertiary: spec.brandTertiary,
      selection: spec.selection,
      caret: spec.caret,
      shadow: spec.shadow,
    },
    annotations: buildAnnotations(spec, dark),
    effects: {
      layeredPaper: skin === 'vellum',
      mascot: skin === 'mote',
      grain: skin === 'vellum' || skin === 'glass',
    },
    spacing: SPACING,
    radius: { ...radii, pill: 999 },
    typography: TYPOGRAPHY,
  };
}

export interface ThemeController {
  theme: AppTheme;
  preferences: MobilePreferences;
  hydrated: boolean;
  setSkin(skin: SkinId): Promise<void>;
  setThemeMode(mode: ThemeMode): Promise<void>;
  updatePreferences(patch: Partial<MobilePreferences>): Promise<void>;
}

const ThemeContext = createContext<ThemeController | null>(null);

const FALLBACK_THEME = buildAppTheme('glass', false);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preferences, setPreferences] = useState<MobilePreferences>(DEFAULT_PREFERENCES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    void getPreferences().then((loaded) => {
      if (!mounted) return;
      setPreferences(loaded);
      setHydrated(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const dark =
    preferences.themeMode === 'dark' ||
    (preferences.themeMode === 'system' && systemScheme === 'dark');
  const theme = useMemo(() => buildAppTheme(preferences.skin, dark), [preferences.skin, dark]);

  const updatePreferences = useCallback(async (patch: Partial<MobilePreferences>) => {
    setPreferences((current) => ({ ...current, ...patch }));
    try {
      const saved = await savePreferences(patch);
      setPreferences(saved);
    } catch (error) {
      console.error('保存外观设置失败:', error);
    }
  }, []);

  const setSkin = useCallback(
    (skin: SkinId) => updatePreferences({ skin }),
    [updatePreferences]
  );
  const setThemeMode = useCallback(
    (mode: ThemeMode) => updatePreferences({ themeMode: mode }),
    [updatePreferences]
  );

  const controller = useMemo<ThemeController>(
    () => ({
      theme,
      preferences,
      hydrated,
      setSkin,
      setThemeMode,
      updatePreferences,
    }),
    [theme, preferences, hydrated, setSkin, setThemeMode, updatePreferences]
  );

  return <ThemeContext.Provider value={controller}>{children}</ThemeContext.Provider>;
}

/** 读取当前主题；组件可继续沿用旧签名 */
export function useAppTheme(): AppTheme {
  const controller = useContext(ThemeContext);
  return controller?.theme ?? FALLBACK_THEME;
}

/** 设置页/外观切换使用 */
export function useThemeController(): ThemeController {
  const controller = useContext(ThemeContext);
  if (!controller) {
    throw new Error('useThemeController 必须在 ThemeProvider 内使用');
  }
  return controller;
}

/** 便签色在当前模式 + 皮肤下的背景/文字色（兼容旧色值） */
export function getStickerSurface(color: StickerColor, dark: boolean) {
  const palette = resolveStickerColor(color);
  return {
    background: dark ? palette.darkColor : palette.color,
    text: dark ? palette.darkTextColor : palette.textColor,
  };
}
