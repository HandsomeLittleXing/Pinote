import React, { useCallback, useEffect, useState } from 'react';
import { Database, Info, Palette, Settings2, Smartphone, Sparkles } from 'lucide-react';
import { WindowChrome } from './WindowChrome';
import { SkinBackdrop } from './SkinBackdrop';
import { Mascot } from './Mascot';
import { Skeleton } from './ui/Skeleton';
import { useToast } from './ui/Toast';
import { useTheme } from '../hooks/useTheme';
import { getApi } from '../utils/api';
import { GeneralSettings } from './settings/GeneralSettings';
import { AppearanceSettings } from './settings/AppearanceSettings';
import { SyncSettings } from './settings/SyncSettings';
import { AiSettings } from './settings/AiSettings';
import { DataSettings } from './settings/DataSettings';
import { AboutSettings } from './settings/AboutSettings';
import type { AppSettings } from '../../shared/types';

type SettingsSection = 'general' | 'appearance' | 'sync' | 'ai' | 'data' | 'about';

const navItems = [
  { id: 'general' as const, label: '通用', Icon: Settings2 },
  { id: 'appearance' as const, label: '外观', Icon: Palette },
  { id: 'sync' as const, label: '同步', Icon: Smartphone },
  { id: 'ai' as const, label: 'AI', Icon: Sparkles },
  { id: 'data' as const, label: '数据', Icon: Database },
  { id: 'about' as const, label: '关于', Icon: Info },
];

const Settings: React.FC = () => {
  const { toast } = useToast();
  const { skin } = useTheme();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [section, setSection] = useState<SettingsSection>('general');

  useEffect(() => {
    (async () => {
      try {
        setSettings(await getApi().settings.get());
      } catch (error) {
        console.error('加载设置失败:', error);
        toast({ title: '加载设置失败', variant: 'error' });
      }
    })();
  }, [toast]);

  const update = useCallback(
    async (patch: Partial<AppSettings>) => {
      try {
        await getApi().settings.set(patch);
        setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
      } catch (error) {
        const raw = error instanceof Error ? error.message : '保存失败';
        const message = raw.replace(/^Error invoking remote method '[^']+': Error: /, '');
        toast({ title: '保存失败', description: message, variant: 'error' });
        throw error;
      }
    },
    [toast]
  );

  return (
    <div className="relative flex h-screen w-full flex-col bg-canvas">
      <SkinBackdrop />
      <WindowChrome
        icon={skin === 'mote' ? <Mascot size={26} /> : <Settings2 size={17} />}
        title="设置"
        className="relative z-10"
      />

      <div className="relative z-10 flex min-h-0 flex-1">
        <aside className="w-[168px] shrink-0 border-r border-line/10 bg-surface p-2">
          <nav className="space-y-1">
            {navItems.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] transition-colors ${
                  section === id
                    ? 'bg-accent/10 font-medium text-accent'
                    : 'text-ink-muted hover:bg-muted hover:text-ink'
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-[520px] space-y-6">
            {!settings ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <>
                {section === 'general' && (
                  <GeneralSettings settings={settings} update={update} />
                )}
                {section === 'appearance' && (
                  <AppearanceSettings settings={settings} update={update} />
                )}
                {section === 'sync' && <SyncSettings settings={settings} update={update} />}
                {section === 'ai' && <AiSettings settings={settings} update={update} />}
                {section === 'data' && <DataSettings />}
                {section === 'about' && <AboutSettings settings={settings} />}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Settings;
