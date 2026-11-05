import React from 'react';
import { Monitor, Moon, Palette, Sparkles, Sun, SunMoon } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { useTheme } from '../../hooks/useTheme';
import { COLOR_THEMES, getBackgroundColor, resolveStickerColor } from '../../utils/colors';
import { resolveGlassCardColor } from '../../../shared/palette';
import { SKIN_DEFINITIONS } from '../../../shared/skins';
import type { AppSettings } from '../../../shared/types';

const themeOptions = [
  { value: 'system' as const, label: '跟随系统', Icon: Monitor },
  { value: 'light' as const, label: '浅色', Icon: Sun },
  { value: 'dark' as const, label: '深色', Icon: Moon },
];

const desktopGlassSwatches = {
  light: ['#E6EBF1', '#CFDDE4', '#5B97A3', '#9883A6'],
  dark: ['#1D242C', '#2E3E4A', '#9BC8D0', '#B6A3C3'],
};

interface AppearanceSettingsProps {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => Promise<void>;
}

/** 外观：主题与默认便签颜色 */
export function AppearanceSettings({ settings, update }: AppearanceSettingsProps) {
  const { isDark } = useTheme();

  return (
    <>
      <SectionCard
        title="主题"
        icon={<SunMoon size={16} className="text-ink-muted" />}
      >
        <div className="flex gap-2">
          {themeOptions.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                void update({ themeMode: value }).catch(() => {});
              }}
              className={`appearance-choice flex flex-1 flex-col items-center gap-1 rounded-md border-2 p-3 transition-all ${
                settings.themeMode === value
                  ? 'border-accent bg-accent/10'
                  : 'border-line/10 hover:border-line/20'
              }`}
            >
              <Icon size={18} className="text-ink-muted" />
              <span className="text-xs text-ink-muted">{label}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="主题皮肤"
        icon={<Sparkles size={16} className="text-ink-muted" />}
      >
        <div className="grid grid-cols-3 gap-2">
          {SKIN_DEFINITIONS.map((definition) => {
            const active = settings.skin === definition.id;
            const swatches = definition.id === 'glass'
              ? desktopGlassSwatches[isDark ? 'dark' : 'light']
              : definition.swatches[isDark ? 'dark' : 'light'];
            return (
              <button
                key={definition.id}
                type="button"
                onClick={() => {
                  void update({ skin: definition.id }).catch(() => {});
                }}
                className={`appearance-choice flex flex-col gap-2 rounded-lg border-2 p-2.5 text-left transition-all ${
                  active
                    ? 'border-accent bg-accent/10'
                    : 'border-line/10 hover:border-line/25'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink">{definition.name}</span>
                  {active ? <span className="text-[11px] text-accent">✓</span> : null}
                </div>
                <div className={`flex gap-1 ${definition.id === 'glass' ? 'py-0.5' : ''}`}>
                  {swatches.map((color) => (
                    <span
                      key={color}
                      className={definition.id === 'glass'
                        ? 'h-5 flex-1 rounded-md border border-line/10'
                        : 'h-4 flex-1 rounded-[3px] border border-black/5 dark:border-white/10'}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="默认便签颜色"
        icon={<Palette size={16} className="text-ink-muted" />}
      >
        <div className="grid grid-cols-4 gap-2">
          {COLOR_THEMES.map((theme) => (
            <button
              key={theme.color}
              type="button"
              onClick={() => {
                void update({ defaultColor: theme.color }).catch(() => {});
              }}
              className={`appearance-choice flex flex-col items-center gap-1 rounded-md border-2 p-2 transition-all ${
                resolveStickerColor(settings.defaultColor).color === theme.color
                  ? 'border-accent bg-accent/10'
                  : 'border-transparent hover:bg-muted'
              }`}
            >
              <div
                className="h-8 w-8 rounded-full shadow-sm"
                style={{ backgroundColor: settings.skin === 'glass'
                  ? resolveGlassCardColor(theme.color, isDark).tint
                  : getBackgroundColor(theme.color, isDark) }}
              />
              <span className="text-xs text-ink-muted">{theme.name}</span>
            </button>
          ))}
        </div>
      </SectionCard>
    </>
  );
}
