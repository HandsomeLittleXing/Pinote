import React from 'react';
import { Keyboard, Rocket } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { ShortcutRecorder } from '../ShortcutRecorder';
import { Switch } from '../ui/Switch';
import type { AppSettings } from '../../../shared/types';

interface GeneralSettingsProps {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => Promise<void>;
}

/** 通用：快捷键与启动 */
export function GeneralSettings({ settings, update }: GeneralSettingsProps) {
  return (
    <>
      <SectionCard
        title="快捷键"
        icon={<Keyboard size={16} className="text-ink-muted" />}
        description="点击录制后按下组合键；冲突时会保留旧值。"
      >
        <div className="space-y-3">
          <ShortcutRecorder
            label="新建便签"
            value={settings.shortcutNew}
            onApply={(value) => update({ shortcutNew: value })}
          />
          <ShortcutRecorder
            label="打开列表"
            value={settings.shortcutList}
            onApply={(value) => update({ shortcutList: value })}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="启动"
        icon={<Rocket size={16} className="text-ink-muted" />}
        description="系统启动时自动运行电脑便签。"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink">开机自启动</span>
          <Switch
            label="开机自启动"
            checked={settings.autoStart}
            onCheckedChange={(checked) => {
              void update({ autoStart: checked }).catch(() => {});
            }}
          />
        </div>
      </SectionCard>
    </>
  );
}
