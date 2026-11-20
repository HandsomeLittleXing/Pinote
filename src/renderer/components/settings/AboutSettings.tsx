import React, { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { getApi } from '../../utils/api';
import type { AppSettings } from '../../../shared/types';

interface AboutSettingsProps {
  settings: AppSettings;
}

/** 关于：版本、快捷键、许可 */
export function AboutSettings({ settings }: AboutSettingsProps) {
  const [version, setVersion] = useState('');

  useEffect(() => {
    let cancelled = false;
    getApi()
      .app.getVersion()
      .then((value) => {
        if (!cancelled) setVersion(value);
      })
      .catch((error) => {
        console.error('获取应用版本失败:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SectionCard title="关于" icon={<Info size={16} className="text-ink-muted" />}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink">贴记</span>
          <span className="text-sm tabular-nums text-ink-muted">
            v{version || '—'}
          </span>
        </div>
        <p className="text-xs text-ink-subtle">开机即在，随手一贴</p>
        <p className="text-xs text-ink-subtle">作者：handsomelittlexing</p>

        <div className="space-y-1.5 rounded-lg bg-muted p-3 text-xs text-ink-muted">
          <p>
            新建便签：<code className="font-mono text-ink">{settings.shortcutNew}</code>
          </p>
          <p>
            打开列表：<code className="font-mono text-ink">{settings.shortcutList}</code>
          </p>
          <p>
            搜索：<code className="font-mono text-ink">Ctrl+K</code>（列表内）
          </p>
        </div>

        <p className="text-xs text-ink-subtle">MIT License</p>
      </div>
    </SectionCard>
  );
}
