import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { KeyRound, RefreshCw, Smartphone, Unlink } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { Button } from '../ui/Button';
import { Switch } from '../ui/Switch';
import { StatusBadge, type StatusBadgeStatus } from '../ui/StatusBadge';
import { ConfirmDialog } from '../ConfirmDialog';
import { useToast } from '../ui/Toast';
import { getApi } from '../../utils/api';
import type {
  AppSettings,
  PairingCodeResult,
  SyncDevice,
  SyncStatus,
} from '../../../shared/types';

interface SyncSettingsProps {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => Promise<void>;
}

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/^Error invoking remote method '[^']+': Error: /, '');
}

/** 手机同步：开关、服务器、配对与设备 */
export function SyncSettings({ settings, update }: SyncSettingsProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [serverUrl, setServerUrl] = useState('');
  const [devices, setDevices] = useState<SyncDevice[]>([]);
  const [pairing, setPairing] = useState<PairingCodeResult | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<SyncDevice | null>(null);

  const loadSync = useCallback(async () => {
    try {
      const next = await getApi().sync.getStatus();
      setStatus(next);
      setServerUrl((prev) => prev || next.serverUrl);
      setDevices(await getApi().sync.listDevices());
    } catch (error) {
      console.error('加载同步信息失败:', error);
    }
  }, []);

  useEffect(() => {
    void loadSync();
    return getApi().sync.onStatusChanged((next) => setStatus(next));
  }, [loadSync]);

  // 配对码过期后自动清除
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

  const handleToggle = useCallback(
    async (checked: boolean) => {
      try {
        await update({ syncEnabled: checked });
        await loadSync();
      } catch {
        // update 已提示错误；保持开关原值
      }
    },
    [update, loadSync]
  );

  const handleApplyUrl = useCallback(async () => {
    const url = serverUrl.trim();
    if (!url) {
      toast({ title: '请填写服务器地址', variant: 'error' });
      return;
    }
    setLoading(true);
    try {
      const next = await getApi().sync.setServerUrl(url);
      setStatus(next);
      setDevices([]);
      await loadSync();
      toast({ title: '服务器地址已更新', variant: 'success' });
    } catch (error) {
      toast({ title: '切换服务器失败', description: errorMessage(error), variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [serverUrl, loadSync, toast]);

  const handleSyncNow = useCallback(async () => {
    if (!settings.syncEnabled) return;
    setLoading(true);
    try {
      const next = await getApi().sync.syncNow();
      setStatus(next);
      await loadSync();
      toast({ title: '同步完成', variant: 'success', duration: 1800 });
    } catch (error) {
      toast({ title: '同步失败', description: errorMessage(error), variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [settings.syncEnabled, loadSync, toast]);

  const handlePairing = useCallback(async () => {
    if (!status?.enabled) {
      toast({ title: '请先开启同步', variant: 'error' });
      return;
    }
    setLoading(true);
    try {
      const result = await getApi().sync.createPairingCode();
      setPairing(result);
      const payload = JSON.stringify({
        serverUrl: status.pairingServerUrl || serverUrl.trim(),
        code: result.code,
      });
      setQrDataUrl(await QRCode.toDataURL(payload, { width: 200, margin: 1 }));
    } catch (error) {
      toast({ title: '生成配对码失败', description: errorMessage(error), variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [status, serverUrl, toast]);

  const handleUnlink = useCallback(async () => {
    if (!unlinkTarget) return;
    try {
      await getApi().sync.unlinkDevice(unlinkTarget.id);
      setUnlinkTarget(null);
      await loadSync();
      toast({ title: '设备已解绑', variant: 'success' });
    } catch (error) {
      toast({ title: '解绑失败', description: errorMessage(error), variant: 'error' });
    }
  }, [unlinkTarget, loadSync, toast]);

  const badgeStatus: StatusBadgeStatus = !settings.syncEnabled
    ? 'disabled'
    : status?.lastError
      ? 'error'
      : loading
        ? 'syncing'
        : status?.linked
          ? 'connected'
          : 'disconnected';

  const lastSyncText = status?.lastSyncedAt
    ? new Date(status.lastSyncedAt).toLocaleString()
    : '尚未同步';

  return (
    <>
      <SectionCard
        title="手机同步"
        icon={<Smartphone size={16} className="text-ink-muted" />}
        description="通过配对码把手机加入同一个同步空间。"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-sm text-ink">启用手机同步</span>
              <p className="mt-0.5 text-xs text-ink-subtle">关闭后不发起任何网络请求</p>
            </div>
            <Switch
              label="启用手机同步"
              checked={settings.syncEnabled}
              onCheckedChange={(checked) => {
                void handleToggle(checked);
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <StatusBadge status={badgeStatus} />
            <span className="truncate text-xs text-ink-subtle">
              {status?.lastError ? `异常：${status.lastError}` : lastSyncText}
            </span>
          </div>

          <div>
            <label className="mb-1 block text-xs text-ink-muted">同步服务器地址</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={serverUrl}
                onChange={(event) => setServerUrl(event.target.value)}
                placeholder="https://sync.example.com"
                disabled={loading}
                className="min-w-0 flex-1 rounded-md border border-line/10 bg-muted px-3 py-1.5 font-mono text-sm text-ink placeholder:text-ink-subtle focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleApplyUrl}
                disabled={
                  loading ||
                  !serverUrl.trim() ||
                  serverUrl.trim() === status?.serverUrl
                }
              >
                应用
              </Button>
            </div>
            <p className="mt-1 text-xs text-ink-subtle">
              切换地址会重新注册，之前的配对需要重做。
            </p>
            {status && status.pairingServerUrl !== status.serverUrl && (
              <p className="mt-1 text-xs text-warning">
                手机配对地址（局域网）：
                <code className="font-mono">{status.pairingServerUrl}</code>
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={handleSyncNow}
              disabled={loading || !settings.syncEnabled}
            >
              <RefreshCw size={14} /> 立即同步
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePairing}
              disabled={loading || !settings.syncEnabled}
            >
              <KeyRound size={14} /> 生成配对码
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
                {devices.map((device) => (
                  <li
                    key={device.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2"
                  >
                    <div className="min-w-0">
                      <span className="truncate text-sm text-ink">
                        {device.deviceName}
                        {device.isCurrent ? '（当前设备）' : ''}
                      </span>
                      <p className="text-xs text-ink-subtle">{device.platform}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUnlinkTarget(device)}
                      className="flex shrink-0 items-center gap-1 text-xs text-danger hover:text-danger/80"
                    >
                      <Unlink size={12} /> 解绑
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SectionCard>

      <ConfirmDialog
        open={!!unlinkTarget}
        title="解绑设备"
        message={`确定要解绑设备"${unlinkTarget?.deviceName ?? ''}"吗？解绑后该设备将无法继续同步便签数据。`}
        confirmLabel="确认解绑"
        onConfirm={handleUnlink}
        onCancel={() => setUnlinkTarget(null)}
      />
    </>
  );
}
