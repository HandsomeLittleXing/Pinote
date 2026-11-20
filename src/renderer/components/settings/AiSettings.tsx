import React, { useEffect, useState } from 'react';
import { CloudOff, Sparkles } from 'lucide-react';
import { SectionCard } from './SectionCard';
import { Switch } from '../ui/Switch';
import { ConfirmDialog } from '../ConfirmDialog';
import { getApi } from '../../utils/api';
import { isSecureAiKeyServerUrl } from '../../../shared/aiKeyTransport';
import type { AIStatus, AppSettings } from '../../../shared/types';

const AI_CONSENT_VERSION = 2;

interface AiSettingsProps {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => Promise<void>;
}

/** AI 来源与 Key 设置。 */
export function AiSettings({ settings, update }: AiSettingsProps) {
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [linked, setLinked] = useState<boolean | null>(null);
  const [keyTransportSecure, setKeyTransportSecure] = useState<boolean | null>(null);
  const deviceSource = settings.aiSource === 'device';
  const canChangeKey = deviceSource || (linked === true && keyTransportSecure === true);

  const runKeyAction = async (action: 'save' | 'test' | 'delete') => {
    setBusy(true);
    setFeedback('');
    try {
      if (action === 'save') setStatus(await getApi().ai.saveKey(apiKey));
      if (action === 'delete') setStatus(await getApi().ai.deleteKey());
      if (action === 'test') await getApi().ai.testKey();
      setFeedback(action === 'test' ? '连接正常' : action === 'save'
        ? deviceSource ? '已安全保存到本机' : '已保存到同步空间'
        : deviceSource ? '已移除本机 Key' : '已移除空间 Key');
    } catch (error) {
      const message = error instanceof Error ? error.message : '操作失败';
      setFeedback(message.replace(/^Error invoking remote method '[^']+': Error: /, ''));
    } finally {
      setApiKey('');
      setBusy(false);
    }
  };

  useEffect(() => {
    void getApi().sync.getStatus().then((value) => {
      setLinked(value.linked);
      setKeyTransportSecure(isSecureAiKeyServerUrl(value.serverUrl));
    }).catch(() => setLinked(false));
    void getApi()
      .ai.getStatus()
      .then(setStatus)
      .catch((error) => {
        setStatus({ configured: false, model: '' });
        setFeedback(error instanceof Error ? error.message : '无法读取 AI 状态');
      });
  }, [settings.aiSource]);

  const handleToggle = (checked: boolean) => {
    if (!checked) {
      void update({ aiEnabled: false });
      return;
    }
    if (settings.aiConsentVersion >= AI_CONSENT_VERSION) {
      void update({ aiEnabled: true });
      return;
    }
    setConfirmOpen(true);
  };

  return (
    <>
      <SectionCard
        title="AI 整理"
        icon={<Sparkles size={16} className="text-ink-muted" />}
        description={deviceSource
          ? '手动触发；本机 Key 直连 DeepSeek，不需要同步服务器。'
          : '手动触发；Key 保存在同步服务器。'}
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <button type="button" onClick={() => {
              if (!deviceSource) void update({ aiSource: 'device', aiEnabled: false, aiConsentVersion: 0 });
            }}
              className={`rounded-lg px-3 py-1.5 text-xs ${deviceSource ? 'bg-accent text-white' : 'bg-muted text-ink'}`}>
              本机直连
            </button>
            <button type="button" disabled={!linked} onClick={() => {
              if (deviceSource) void update({ aiSource: 'sync', aiEnabled: false, aiConsentVersion: 0 });
            }}
              className={`rounded-lg px-3 py-1.5 text-xs disabled:opacity-40 ${!deviceSource ? 'bg-accent text-white' : 'bg-muted text-ink'}`}>
              同步空间
            </button>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink">允许 AI 整理便签</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-ink-subtle">
                只在点击「AI 整理」时调用，不会自动分析。
              </p>
            </div>
            <Switch
              label="允许 AI 整理便签"
              checked={settings.aiEnabled}
              onCheckedChange={handleToggle}
            />
          </div>

          <div className="rounded-md bg-muted/60 p-2.5 text-[11px]">
            {status === null ? (
              <span className="text-ink-subtle">正在检查 AI 配置…</span>
            ) : status.configured ? (
              <span className="text-ink-muted">
                {deviceSource ? `本机 Key ·••••${status.keyHint || ''}`
                  : status.source === 'space' ? `同步空间 Key ·••••${status.keyHint || ''}` : '服务器默认 Key'}
                {' · 模型 '}<span className="font-medium text-ink">{status.model}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-ink-muted">
                <CloudOff size={12} />
                {!deviceSource && linked === false ? '请先连接同步服务' : '尚未配置 AI Key'}
              </span>
            )}
          </div>

          <div className="space-y-2 border-t border-line/10 pt-3">
            <label htmlFor="ai-api-key" className="text-[13px] font-medium text-ink">API Key</label>
            {!deviceSource && linked && keyTransportSecure === false && (
              <p role="status" className="text-xs leading-relaxed text-warning">
                当前同步地址使用 HTTP。请先到「手机同步」设置 HTTPS 地址，再保存或移除 API Key。服务器默认 Key 仍可用于 AI 整理。
              </p>
            )}
            <div className="flex gap-2">
              <input id="ai-api-key" type={showKey ? 'text' : 'password'} autoComplete="off" disabled={!canChangeKey}
                value={apiKey} onChange={(event) => setApiKey(event.target.value)}
                placeholder="输入新的 API Key" className="min-w-0 flex-1 rounded-lg border border-line/20 bg-surface px-3 py-2 text-[13px] text-ink" />
              <button type="button" onClick={() => setShowKey(!showKey)} className="rounded-lg border border-line/20 px-3 text-xs text-ink-muted">{showKey ? '隐藏' : '显示'}</button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy || !canChangeKey || !apiKey.trim()} onClick={() => void runKeyAction('save')} className="rounded-lg bg-accent px-3 py-1.5 text-xs text-white disabled:opacity-50">保存</button>
              <button type="button" disabled={busy || !status?.configured} onClick={() => void runKeyAction('test')} className="rounded-lg border border-line/20 px-3 py-1.5 text-xs text-ink disabled:opacity-50">测试连接</button>
              <button type="button" disabled={busy || !canChangeKey || (deviceSource ? !status?.configured : status?.source !== 'space')} onClick={() => void runKeyAction('delete')} className="rounded-lg border border-line/20 px-3 py-1.5 text-xs text-ink disabled:opacity-50">移除</button>
            </div>
            {feedback && <p role="status" className="text-xs text-ink-muted">{feedback}</p>}
          </div>

          <div className="space-y-2.5 border-t border-line/10 pt-3">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[13px] text-ink">列表卡片显示一句话摘要</span>
              <Switch
                label="列表卡片显示 AI 摘要"
                checked={settings.showAiSummary}
                onCheckedChange={(checked) => void update({ showAiSummary: checked })}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[13px] text-ink">列表卡片显示 AI 标签</span>
              <Switch
                label="列表卡片显示 AI 标签"
                checked={settings.showAiTags}
                onCheckedChange={(checked) => void update({ showAiTags: checked })}
              />
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-ink-subtle">
            {deviceSource
              ? '点击 AI 整理后，当前便签纯文本会由本机直接发送给 DeepSeek，可能产生费用；不会发送图片。'
              : '点击 AI 整理后，当前便签纯文本会通过同步服务器发送给配置的模型；结果会随便签同步。'}
          </p>
        </div>
      </SectionCard>

      <ConfirmDialog
        open={confirmOpen}
        title="开启 AI 整理"
        message={deviceSource
          ? '点击 AI 整理时，便签纯文本会从本机直接发送给 DeepSeek，可能产生费用。不会自动分析或发送图片。是否同意并开启？'
          : '点击 AI 整理时，便签纯文本会经同步服务器发送给配置的模型，结果可随便签同步。不会自动分析。是否同意并开启？'}
        confirmLabel="同意并开启"
        confirmVariant="primary"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void update({ aiEnabled: true, aiConsentVersion: AI_CONSENT_VERSION });
        }}
      />
    </>
  );
}
