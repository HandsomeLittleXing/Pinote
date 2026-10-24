import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  Database,
  Download,
  Keyboard,
  Monitor,
  Moon,
  Palette,
  Rocket,
  Settings2,
  Smartphone,
  Sun,
  SunMoon,
  Upload,
} from 'lucide-react';
import { getApi } from '../utils/api';
import { ConfirmDialog } from './ConfirmDialog';
import { Button } from './ui/Button';
import { Switch } from './ui/Switch';
import type { AppSettings, SyncDevice, SyncStatus, PairingCodeResult } from '../../shared/types';
import { COLOR_THEMES } from '../utils/colors';

const themeOptions = [
  { value: 'system' as const, label: '跟随系统', Icon: Monitor },
  { value: 'light' as const, label: '浅色', Icon: Sun },
  { value: 'dark' as const, label: '深色', Icon: Moon },
];

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [pendingSettings, setPendingSettings] = useState<Partial<AppSettings>>({});
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('merge');
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // 手机同步相关状态
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [serverUrlInput, setServerUrlInput] = useState('');
  const [devices, setDevices] = useState<SyncDevice[]>([]);
  const [pairing, setPairing] = useState<PairingCodeResult | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<SyncDevice | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await getApi().settings.get();
        setSettings(s);
      } catch (error) {
        console.error('加载设置失败:', error);
      }
    })();
  }, []);

  const loadSync = useCallback(async () => {
    try {
      const status = await getApi().sync.getStatus();
      setSyncStatus(status);
      setServerUrlInput((prev) => prev || status.serverUrl);
      const list = await getApi().sync.listDevices();
      setDevices(list);
    } catch (error) {
      console.error('加载同步信息失败:', error);
    }
  }, []);

  useEffect(() => {
    loadSync();
  }, [loadSync]);

  // 同步状态变化（比如定时同步失败/成功）实时刷新
  useEffect(() => {
    return getApi().sync.onStatusChanged((status) => {
      setSyncStatus(status);
    });
  }, []);

  // 配对码倒计时结束后自动清除
  useEffect(() => {
    if (!pairing) return;
    const remainMs = new Date(pairing.expiresAt).getTime() - Date.now();
    if (remainMs <= 0) {
      setPairing(null);
      setQrDataUrl('');
      return;
    }
    const timer = setTimeout(() => {
      setPairing(null);
      setQrDataUrl('');
    }, remainMs);
    return () => clearTimeout(timer);
  }, [pairing]);

  const handleCreatePairingCode = useCallback(async () => {
    if (!syncStatus?.enabled) {
      setSyncError('请先开启并保存同步设置');
      return;
    }
    setSyncLoading(true);
    setSyncError(null);
    try {
      const result = await getApi().sync.createPairingCode();
      setPairing(result);
      // 二维码同时携带服务器地址与配对码，手机扫码后可自动填两项
      // 若桌面端配置的是 localhost，使用自动转换后的局域网地址供手机访问
      const payload = JSON.stringify({
        serverUrl: syncStatus?.pairingServerUrl ?? serverUrlInput.trim(),
        code: result.code,
      });
      const dataUrl = await QRCode.toDataURL(payload, { width: 200, margin: 1 });
      setQrDataUrl(dataUrl);
    } catch (error) {
      console.error('生成配对码失败:', error);
      setSyncError('生成配对码失败，请检查网络与服务器地址是否可用');
    } finally {
      setSyncLoading(false);
    }
  }, [syncStatus, serverUrlInput]);

  const handleUnlinkDevice = useCallback(async () => {
    if (!unlinkTarget) return;
    try {
      await getApi().sync.unlinkDevice(unlinkTarget.id);
      setUnlinkTarget(null);
      await loadSync();
    } catch (error) {
      console.error('解绑设备失败:', error);
      setSyncError('解绑设备失败');
    }
  }, [unlinkTarget, loadSync]);

  const handleSyncNow = useCallback(async () => {
    if (!syncStatus?.enabled) {
      setSyncError('请先开启并保存同步设置');
      return;
    }
    setSyncLoading(true);
    setSyncError(null);
    try {
      const status = await getApi().sync.syncNow();
      setSyncStatus(status);
      await loadSync();
    } catch (error) {
      console.error('同步失败:', error);
      setSyncError(error instanceof Error ? error.message : '同步失败');
    } finally {
      setSyncLoading(false);
    }
  }, [loadSync, syncStatus?.enabled]);

  const handleSaveServerUrl = useCallback(async () => {
    setSyncLoading(true);
    setSyncError(null);
    try {
      const status = await getApi().sync.setServerUrl(serverUrlInput.trim());
      setSyncStatus(status);
      setDevices([]);
    } catch (error) {
      console.error('切换服务器失败:', error);
      setSyncError(error instanceof Error ? error.message : '切换服务器失败');
    } finally {
      setSyncLoading(false);
    }
  }, [serverUrlInput]);

  // 暂存修改（不立即生效）
  const updateSetting = useCallback((key: keyof AppSettings, value: unknown) => {
    setPendingSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
    setSettingsError(null);
  }, []);

  // 保存所有修改
  const handleSave = useCallback(async () => {
    if (!settings || !hasChanges) return;
    try {
      const nextSyncEnabled =
        'syncEnabled' in pendingSettings ? pendingSettings.syncEnabled : undefined;

      // 开启同步前先把输入框里的地址应用掉，避免用户漏点“应用”
      if (
        nextSyncEnabled === true &&
        serverUrlInput.trim() &&
        serverUrlInput.trim() !== syncStatus?.serverUrl
      ) {
        await getApi().sync.setServerUrl(serverUrlInput.trim());
      }

      const merged = { ...settings, ...pendingSettings };
      await getApi().settings.set(pendingSettings);
      setSettings(merged);
      setPendingSettings({});
      setHasChanges(false);
      setSettingsError(null);
      setSaved(true);
      if (typeof nextSyncEnabled === 'boolean') {
        await loadSync();
      }
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('保存设置失败:', error);
      const raw = error instanceof Error ? error.message : '保存设置失败';
      // 去掉 Electron IPC 包装前缀，直接展示可读原因
      setSettingsError(
        raw.includes('请先填写同步服务器地址')
          ? '请先填写同步服务器地址'
          : raw.replace(/^Error invoking remote method '[^']+': Error: /, '')
      );
    }
  }, [settings, pendingSettings, hasChanges, serverUrlInput, syncStatus?.serverUrl, loadSync]);

  // 取消修改
  const handleCancel = useCallback(() => {
    setPendingSettings({});
    setHasChanges(false);
    setSettingsError(null);
  }, []);

  // 获取当前显示值（优先 pending，回退到 saved）
  const getValue = useCallback(
    <K extends keyof AppSettings>(key: K): AppSettings[K] => {
      if (key in pendingSettings) return pendingSettings[key] as AppSettings[K];
      return settings?.[key] ?? ({} as any)[key];
    },
    [settings, pendingSettings]
  );

  // 旧数据没有 syncEnabled 字段时，以主进程推断出的有效状态为准
  const syncEnabledValue =
    'syncEnabled' in pendingSettings
      ? !!pendingSettings.syncEnabled
      : (settings as (AppSettings & { syncEnabled?: boolean }) | null)?.syncEnabled ??
        syncStatus?.enabled ??
        false;

  const syncStatusLabel = !syncEnabledValue
    ? '○ 未启用'
    : !syncStatus?.enabled
      ? '○ 待保存'
      : syncStatus.linked
        ? '● 已连接同步服务'
        : '○ 未连接';

  const syncStatusClass = !syncEnabledValue
    ? 'text-ink-subtle'
    : !syncStatus?.enabled
      ? 'text-warning'
      : syncStatus.linked
        ? 'text-success'
        : 'text-ink-muted';

  const handleExport = useCallback(async () => {
    try {
      const data = await getApi().data.export();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `电脑便签备份-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出数据失败:', error);
    }
  }, []);

  const handleImport = useCallback(async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const text = await file.text();
        const data = JSON.parse(text);
        await getApi().data.import(data, importMode);
        setShowImportConfirm(false);
        alert('导入成功！');
      };
      input.click();
    } catch (error) {
      console.error('导入数据失败:', error);
      alert('导入失败：数据格式不正确');
    }
  }, [importMode]);

  if (!settings) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-sm text-ink-subtle">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-canvas">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between border-b border-line/10 bg-surface px-6 py-4">
        <div className="flex items-center gap-2">
          <Settings2 size={18} className="text-ink-muted" />
          <h1 className="text-lg font-semibold text-ink">设置</h1>
        </div>
        <div className="flex items-center gap-3">
          {settingsError && <span className="max-w-[220px] text-xs text-danger">{settingsError}</span>}
          {hasChanges && (
            <Button variant="ghost" onClick={handleCancel}>
              取消
            </Button>
          )}
          <Button onClick={handleSave} disabled={!hasChanges}>
            {saved ? '✓ 已保存' : '保存设置'}
          </Button>
        </div>
      </div>

      {/* 设置内容 */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg space-y-6 p-6">
          {/* 快捷键 */}
          <section className="rounded-xl border border-line/10 bg-surface p-5 shadow-glass">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
              <Keyboard size={16} className="text-ink-muted" /> 快捷键
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-muted">新建便签</span>
                <input
                  type="text"
                  value={getValue('shortcutNew')}
                  onChange={(e) => updateSetting('shortcutNew', e.target.value)}
                  className="w-36 rounded-md border border-line/10 bg-muted px-3 py-1.5 text-center font-mono text-sm text-ink focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-muted">打开列表</span>
                <input
                  type="text"
                  value={getValue('shortcutList')}
                  onChange={(e) => updateSetting('shortcutList', e.target.value)}
                  className="w-36 rounded-md border border-line/10 bg-muted px-3 py-1.5 text-center font-mono text-sm text-ink focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>
            </div>
          </section>

          {/* 默认颜色 */}
          <section className="rounded-xl border border-line/10 bg-surface p-5 shadow-glass">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
              <Palette size={16} className="text-ink-muted" /> 默认颜色
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_THEMES.map((theme) => (
                <button
                  key={theme.color}
                  onClick={() => updateSetting('defaultColor', theme.color)}
                  className={`flex flex-col items-center gap-1 rounded-md border-2 p-2 transition-all ${
                    getValue('defaultColor') === theme.color
                      ? 'border-accent bg-accent/10'
                      : 'border-transparent hover:bg-muted'
                  }`}
                >
                  <div
                    className="h-8 w-8 rounded-full shadow-sm"
                    style={{ backgroundColor: theme.color }}
                  />
                  <span className="text-xs text-ink-muted">{theme.name}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 主题模式 */}
          <section className="rounded-xl border border-line/10 bg-surface p-5 shadow-glass">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
              <SunMoon size={16} className="text-ink-muted" /> 主题
            </h2>
            <div className="flex gap-2">
              {themeOptions.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => updateSetting('themeMode', value)}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-md border-2 p-3 transition-all ${
                    getValue('themeMode') === value
                      ? 'border-accent bg-accent/10'
                      : 'border-line/10 hover:border-line/20'
                  }`}
                >
                  <Icon size={18} className="text-ink-muted" />
                  <span className="text-xs text-ink-muted">{label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 开机自启动 */}
          <section className="rounded-xl border border-line/10 bg-surface p-5 shadow-glass">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
              <Rocket size={16} className="text-ink-muted" /> 启动
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-ink">开机自启动</span>
                <p className="mt-0.5 text-xs text-ink-subtle">系统启动时自动运行电脑便签</p>
              </div>
              <Switch
                label="开机自启动"
                checked={!!getValue('autoStart')}
                onCheckedChange={(checked) => updateSetting('autoStart', checked)}
              />
            </div>
          </section>

          {/* 数据管理 */}
          <section className="rounded-xl border border-line/10 bg-surface p-5 shadow-glass">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
              <Database size={16} className="text-ink-muted" /> 数据管理
            </h2>
            <div className="space-y-3">
              <Button variant="secondary" className="w-full justify-start" onClick={handleExport}>
                <Download size={15} /> 导出数据
              </Button>
              <div className="flex gap-2">
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as 'merge' | 'overwrite')}
                  className="flex-1 rounded-md border border-line/10 bg-muted px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
                >
                  <option value="merge">合并导入</option>
                  <option value="overwrite">覆盖导入</option>
                </select>
                <Button variant="secondary" onClick={() => setShowImportConfirm(true)}>
                  <Upload size={15} /> 导入
                </Button>
              </div>
            </div>
          </section>

          {/* 手机同步 */}
          <section className="rounded-xl border border-line/10 bg-surface p-5 shadow-glass">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
              <Smartphone size={16} className="text-ink-muted" /> 手机同步
            </h2>

            <div className="space-y-4">
              {/* 启用开关 */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-ink">启用手机同步</span>
                  <p className="mt-0.5 text-xs text-ink-subtle">
                    关闭后不发起任何网络请求；修改后点击「保存设置」生效
                  </p>
                </div>
                <Switch
                  label="启用手机同步"
                  checked={syncEnabledValue}
                  onCheckedChange={(checked) => updateSetting('syncEnabled', checked)}
                />
              </div>

              {/* 同步状态 */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className={`shrink-0 ${syncStatusClass}`}>{syncStatusLabel}</span>
                <span className="truncate text-right text-ink-subtle">
                  {syncStatus?.enabled && syncStatus.lastError
                    ? `同步异常：${syncStatus.lastError}`
                    : syncStatus?.lastSyncedAt
                      ? `上次同步：${new Date(syncStatus.lastSyncedAt).toLocaleString()}`
                      : '尚未同步'}
                </span>
              </div>

              {/* 服务器地址 */}
              <div>
                <label className="mb-1 block text-xs text-ink-muted">同步服务器地址</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={serverUrlInput}
                    onChange={(e) => {
                      setServerUrlInput(e.target.value);
                      setSyncError(null);
                    }}
                    placeholder="https://sync.example.com"
                    className="flex-1 rounded-md border border-line/10 bg-muted px-3 py-1.5 font-mono text-sm text-ink placeholder:text-ink-subtle focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSaveServerUrl}
                    disabled={
                      syncLoading ||
                      !serverUrlInput.trim() ||
                      serverUrlInput.trim() === syncStatus?.serverUrl
                    }
                  >
                    应用
                  </Button>
                </div>
                <p className="mt-1 text-xs text-ink-subtle">
                  切换地址后会重新注册，之前的配对需要重做。
                </p>
                {syncStatus && syncStatus.pairingServerUrl !== syncStatus.serverUrl && (
                  <p className="mt-1 text-xs text-warning">
                    手机配对地址（局域网）：
                    <code className="font-mono">{syncStatus.pairingServerUrl}</code>
                  </p>
                )}
              </div>

              {syncError && <p className="text-xs text-danger">{syncError}</p>}

              {syncEnabledValue ? (
                <>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSyncNow}
                      disabled={syncLoading || !syncStatus?.enabled}
                    >
                      {syncLoading ? '处理中...' : '立即同步'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCreatePairingCode}
                      disabled={syncLoading || !syncStatus?.enabled}
                    >
                      生成配对码
                    </Button>
                  </div>

                  {pairing && (
                    <div className="flex items-center gap-4 rounded-lg bg-muted p-4">
                      {qrDataUrl && (
                        <img src={qrDataUrl} alt="配对二维码" className="h-24 w-24 rounded" />
                      )}
                      <div>
                        <p className="font-mono text-2xl font-semibold tracking-widest text-ink">
                          {pairing.code}
                        </p>
                        <p className="mt-1 text-xs text-ink-subtle">
                          {pairing.ttlSeconds} 秒内有效，仅可使用一次
                        </p>
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="mb-2 text-xs font-semibold text-ink-muted">
                      已配对手机（{devices.length}）
                    </h3>
                    {devices.length === 0 ? (
                      <p className="text-xs text-ink-subtle">暂无已配对设备</p>
                    ) : (
                      <ul className="space-y-2">
                        {devices.map((d) => (
                          <li
                            key={d.id}
                            className="flex items-center justify-between rounded-lg bg-muted px-3 py-2"
                          >
                            <div>
                              <span className="text-sm text-ink">{d.deviceName}</span>
                              <p className="text-xs text-ink-subtle">{d.platform}</p>
                            </div>
                            <button
                              onClick={() => setUnlinkTarget(d)}
                              className="text-xs text-danger hover:text-danger/80"
                            >
                              解绑
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-xs text-ink-subtle">
                  开启并保存后，可生成配对码与手机互通便签。
                </p>
              )}
            </div>
          </section>

          {/* 关于 */}
          <section className="py-4 text-center">
            <p className="text-sm font-medium text-ink-muted">电脑便签 v{__APP_VERSION__}</p>
            <p className="mt-1 text-xs text-ink-subtle">开机即在，随手一贴</p>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={showImportConfirm}
        title="导入数据"
        message={`确定要${importMode === 'overwrite' ? '覆盖' : '合并'}导入数据吗？${importMode === 'overwrite' ? '覆盖模式将替换当前所有数据！' : '合并模式将追加新数据。'}`}
        confirmLabel="确认导入"
        onConfirm={handleImport}
        onCancel={() => setShowImportConfirm(false)}
      />

      <ConfirmDialog
        open={!!unlinkTarget}
        title="解绑设备"
        message={`确定要解绑设备"${unlinkTarget?.deviceName ?? ''}"吗？解绑后该设备将无法继续同步便签数据。`}
        confirmLabel="确认解绑"
        onConfirm={handleUnlinkDevice}
        onCancel={() => setUnlinkTarget(null)}
      />
    </div>
  );
};

export default Settings;
