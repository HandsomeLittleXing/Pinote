import React from 'react';
import { Monitor, Moon, Palette, Sun, SunMoon } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { useTheme } from '../../hooks/useTheme';
import { COLOR_THEMES, getBackgroundColor, resolveStickerColor } from '../../utils/colors';
import type { AppSettings } from '../../../shared/types';

const themeOptions = [
  { value: 'system' as const, label: '跟随系统', Icon: Monitor },
  { value: 'light' as const, label: '浅色', Icon: Sun },
  { value: 'dark' as const, label: '深色', Icon: Moon },
];

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
        description="切换后立即应用到所有窗口。"
      >
        <div className="flex gap-2">
          {themeOptions.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                void update({ themeMode: value }).catch(() => {});
              }}
              className={`flex flex-1 flex-col items-center gap-1 rounded-md border-2 p-3 transition-all ${
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
        title="默认便签颜色"
        icon={<Palette size={16} className="text-ink-muted" />}
        description="新建便签会使用这个颜色。"
      >
        <div className="grid grid-cols-4 gap-2">
          {COLOR_THEMES.map((theme) => (
            <button
              key={theme.color}
              type="button"
              onClick={() => {
                void update({ defaultColor: theme.color }).catch(() => {});
              }}
              className={`flex flex-col items-center gap-1 rounded-md border-2 p-2 transition-all ${
                resolveStickerColor(settings.defaultColor).color === theme.color
                  ? 'border-accent bg-accent/10'
                  : 'border-transparent hover:bg-muted'
              }`}
            >
              <div
                className="h-8 w-8 rounded-full shadow-sm"
                style={{ backgroundColor: getBackgroundColor(theme.color, isDark) }}
              />
              <span className="text-xs text-ink-muted">{theme.name}</span>
            </button>
          ))}
        </div>
      </SectionCard>
    </>
  );
}
