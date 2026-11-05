import Store from 'electron-store';
import os from 'os';
import type {
  AIAnnotateRequest,
  AIAnnotateResponse,
  AIStatus,
  AIRewriteRequest,
  AIRewriteResponse,
  AppSettings,
  Sticker,
  SyncStatus,
  SyncDevice,
  PairingCodeResult,
} from '../shared/types';
import type { StickerStore } from './store';
import { isSecureAiKeyServerUrl } from '../shared/aiKeyTransport';

interface SyncCredentials {
  serverUrl: string;
  deviceId: string | null;
  token: string | null;
  lastSyncedAt: string | null;
}

interface SyncStoreSchema {
  credentials: SyncCredentials;
}

/**
 * 默认指向 ECS 上部署的同步服务。
 * 本地调试时可用环境变量 STICKERNOTE_SERVER_URL 覆盖（如 http://localhost:4000）。
 */
const DEFAULT_SERVER_URL = process.env.STICKERNOTE_SERVER_URL ?? '';
const SYNC_INTERVAL_MS = 30_000;

type StatusListener = (status: SyncStatus) => void;
type DataChangedListener = (changed: Sticker[]) => void;

/** 云同步管理器：作为客户端连接远程同步服务，负责注册、配对码与增量双向同步 */
export class SyncManager {
  private store: StickerStore;
  private credStore: Store<SyncStoreSchema>;
  private lastError: string | null = null;
  private syncing = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners: StatusListener[] = [];
  private dataChangedListener: DataChangedListener | null = null;

  constructor(store: StickerStore) {
    this.store = store;
    this.credStore = new Store<SyncStoreSchema>({
      name: 'stickernote-sync',
      defaults: {
        credentials: {
          serverUrl: DEFAULT_SERVER_URL,
          deviceId: null,
          token: null,
          lastSyncedAt: null,
        },
      },
    });

    // 未设置地址时补默认值；若通过环境变量强制指定了地址，则覆盖已保存的地址
    const creds = this.credStore.get('credentials');
    const forcedUrl = process.env.STICKERNOTE_SERVER_URL;
    if (forcedUrl) {
      if (creds.serverUrl !== forcedUrl) {
        this.credStore.set('credentials', {
          serverUrl: forcedUrl,
          deviceId: null,
          token: null,
          lastSyncedAt: null,
        });
      }
    } else if (!creds.serverUrl) {
      // 新安装不预设服务器地址；保留可能已存在的凭证，便于配置地址后恢复
      this.credStore.set('credentials', { ...creds, serverUrl: DEFAULT_SERVER_URL });
    }
  }

  /** 启动：未启用时不做任何网络请求；启用且已配置地址时注册并开启定时同步 */
  async start(): Promise<void> {
    if (!this.isEnabled()) {
      this.emitStatus();
      return;
    }
    if (!this.getCredentials().serverUrl) {
      this.lastError = '未配置同步服务器地址';
      this.emitStatus();
      return;
    }
    if (!this.getCredentials().token) {
      try {
        await this.registerDevice();
      } catch (err) {
        this.lastError = err instanceof Error ? err.message : String(err);
        console.error('[sync] 设备注册失败:', this.lastError);
        this.emitStatus();
      }
    }
    this.scheduleLoop();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  onStatusChanged(listener: StatusListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** 当同步拉取到远程数据并实际写入本地时回调（用于刷新 UI 与窗口状态） */
  onDataChanged(listener: DataChangedListener): void {
    this.dataChangedListener = listener;
  }

  getStatus(): SyncStatus {
    const creds = this.getCredentials();
    return {
      enabled: this.isEnabled(),
      linked: !!creds.token,
      serverUrl: creds.serverUrl,
      pairingServerUrl: this.toPairingUrl(creds.serverUrl),
      lastSyncedAt: creds.lastSyncedAt,
      lastError: this.lastError,
    };
  }

  /**
   * 判断同步是否启用。
   * 新数据以 syncEnabled 为准；旧数据没有该字段时，按是否已有 token 推断，
   * 保证已配对用户升级后不会突然断同步。
   */
  private isEnabled(): boolean {
    const settings = this.store.getSettings() as AppSettings & { syncEnabled?: boolean };
    if (typeof settings.syncEnabled === 'boolean') return settings.syncEnabled;
    return !!this.getCredentials().token;
  }

  /** 开启/关闭同步：开启成功后才持久化开关，避免设置部分落库 */
  async setEnabled(enabled: boolean): Promise<SyncStatus> {
    if (!enabled) {
      this.store.setSettings({ syncEnabled: false });
      this.stop();
      this.emitStatus();
      return this.getStatus();
    }

    const creds = this.getCredentials();
    if (!creds.serverUrl) {
      throw new Error('请先填写同步服务器地址');
    }

    if (!creds.token) {
      try {
        await this.registerDevice();
      } catch (err) {
        this.lastError = err instanceof Error ? err.message : String(err);
        this.emitStatus();
        throw err;
      }
    }

    this.store.setSettings({ syncEnabled: true });
    this.lastError = null;
    this.scheduleLoop();
    this.emitStatus();
    return this.getStatus();
  }

  /**
   * 把本机回环地址替换为局域网 IP，供手机使用。
   * 例如 http://localhost:4000 → http://192.168.1.5:4000
   */
  private toPairingUrl(serverUrl: string): string {
    if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(serverUrl)) {
      return serverUrl;
    }
    try {
      const url = new URL(serverUrl);
      const lanIp = this.getLanIp();
      if (lanIp) {
        url.hostname = lanIp;
        return url.toString().replace(/\/$/, '');
      }
    } catch {
      // 解析失败时原样返回
    }
    return serverUrl;
  }

  /** 获取本机局域网 IPv4 地址 */
  private getLanIp(): string | null {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name] ?? []) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
    return null;
  }

  /**
   * 切换同步服务器地址。切换后本地已有的 token 失效，
   * 会以新地址重新注册（创建新的同步空间），需要重新配对手机。
   */
  async setServerUrl(url: string): Promise<SyncStatus> {
    const normalized = url.trim().replace(/\/+$/, '');
    if (!normalized) {
      throw new Error('服务器地址不能为空');
    }
    if (!/^https?:\/\//i.test(normalized)) {
      throw new Error('服务器地址需以 http:// 或 https:// 开头');
    }
    this.setCredentials({
      serverUrl: normalized,
      deviceId: null,
      token: null,
      lastSyncedAt: null,
    });
    this.lastError = null;

    // 同步关闭时只保存地址，等用户开启时再注册
    if (this.isEnabled()) {
      try {
        await this.registerDevice();
        this.scheduleLoop();
      } catch (err) {
        this.lastError = err instanceof Error ? err.message : String(err);
        this.emitStatus();
        throw err;
      }
    }

    this.emitStatus();
    return this.getStatus();
  }

  /** 生成配对码，供手机端输入兑换加入同一同步空间 */
  async createPairingCode(): Promise<PairingCodeResult> {
    if (!this.isEnabled()) {
      throw new Error('请先开启手机同步');
    }
    if (!this.getCredentials().token) {
      throw new Error('设备尚未注册，无法生成配对码');
    }
    return (await this.request('/pairing/create', { method: 'POST' })) as PairingCodeResult;
  }

  async listDevices(): Promise<SyncDevice[]> {
    if (!this.isEnabled()) return [];
    const creds = this.getCredentials();
    const res = (await this.request('/devices', { method: 'GET' })) as {
      devices: Array<{
        id: string;
        device_name: string;
        platform: string;
        created_at: string;
        last_seen_at: string;
      }>;
    };
    return res.devices.map((d) => ({
      id: d.id,
      deviceName: d.device_name,
      platform: d.platform,
      createdAt: d.created_at,
      lastSeenAt: d.last_seen_at,
      isCurrent: d.id === creds.deviceId,
    }));
  }

  async unlinkDevice(deviceId: string): Promise<void> {
    await this.request(`/devices/${deviceId}`, { method: 'DELETE' });
  }

  /** 立即执行一次同步，返回最新状态；未启用时直接返回状态 */
  async syncNow(): Promise<SyncStatus> {
    if (this.isEnabled()) {
      await this.runSync();
    }
    return this.getStatus();
  }

  // ---------------------------------------------------------------------

  private getCredentials(): SyncCredentials {
    return this.credStore.get('credentials');
  }

  private setCredentials(partial: Partial<SyncCredentials>): void {
    const current = this.getCredentials();
    this.credStore.set('credentials', { ...current, ...partial });
  }

  private emitStatus(): void {
    const status = this.getStatus();
    this.listeners.forEach((listener) => listener(status));
  }

  private async registerDevice(): Promise<void> {
    const creds = this.getCredentials();
    const res = await fetch(`${creds.serverUrl}/devices/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceName: os.hostname(),
        platform: 'windows',
      }),
    });
    if (!res.ok) {
      throw new Error(`设备注册失败 (${res.status})`);
    }
    const data = (await res.json()) as { deviceId: string; token: string };
    this.setCredentials({ deviceId: data.deviceId, token: data.token });
    this.emitStatus();
  }

  private scheduleLoop(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.runSync().catch((err) => {
        this.lastError = err instanceof Error ? err.message : String(err);
        this.emitStatus();
      });
    }, SYNC_INTERVAL_MS);
    // 启动后立即跑一次
    this.runSync().catch((err) => {
      this.lastError = err instanceof Error ? err.message : String(err);
      this.emitStatus();
    });
  }

  private async runSync(): Promise<void> {
    if (this.syncing || !this.isEnabled()) return;

    const initial = this.getCredentials();
    if (!initial.serverUrl) {
      this.lastError = '未配置同步服务器地址';
      this.emitStatus();
      return;
    }

    // 尚未注册（如服务器暂时不可达）时，在定时循环中重试注册
    if (!initial.token) {
      try {
        await this.registerDevice();
      } catch (err) {
        this.lastError = err instanceof Error ? err.message : String(err);
        this.emitStatus();
        return;
      }
    }

    const creds = this.getCredentials();
    if (!creds.token) return;

    this.syncing = true;
    try {
      const local = this.store.getAllStickersRaw();
      const since = creds.lastSyncedAt;
      // 与服务器时间存在时钟偏差时，用重叠窗口避免漏推；服务端按 updatedAt 去重
      const pushFrom = since
        ? new Date(since).getTime() - 10 * 60 * 1000
        : 0;
      const changes = local.filter((s) => new Date(s.updatedAt).getTime() > pushFrom);

      const res = (await this.request('/sync', {
        method: 'POST',
        body: JSON.stringify({ since, changes }),
      })) as { serverTime: string; changes: Sticker[] };

      // 关闭同步后，已发出的请求可以完成，但不再应用结果
      if (!this.isEnabled()) return;

      const changed = this.applyServerChanges(res.changes);
      this.setCredentials({ lastSyncedAt: res.serverTime });
      this.lastError = null;
      if (changed.length > 0) {
        this.dataChangedListener?.(changed);
      }
    } finally {
      this.syncing = false;
      this.emitStatus();
    }
  }

  /** 将服务端返回的变更以"最后写入优先"合并进本地，返回实际写入的便签 */
  private applyServerChanges(serverChanges: Sticker[]): Sticker[] {
    const localMap = new Map(
      this.store.getAllStickersRaw().map((sticker) => [sticker.id, sticker])
    );
    const changed: Sticker[] = [];

    for (const remote of serverChanges) {
      const local = localMap.get(remote.id);
      if (!local || new Date(remote.updatedAt).getTime() > new Date(local.updatedAt).getTime()) {
        this.store.upsertFromSync(remote);
        localMap.set(remote.id, remote);
        changed.push(remote);
      }
    }

    return changed;
  }

  /** AI 服务状态；未配对/未启用时返回未配置，不抛错 */
  async getAiStatus(): Promise<AIStatus> {
    const creds = this.getCredentials();
    if (!creds.token || !creds.serverUrl) {
      return { configured: false, model: '' };
    }
    return this.aiRequest('/ai/status', 'GET');
  }

  private async aiRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
    const creds = this.getCredentials();
    if (!creds.token || !creds.serverUrl) throw new Error('请先完成同步配对');
    if (path === '/ai/key' && !isSecureAiKeyServerUrl(creds.serverUrl)) {
      throw new Error('设置 AI Key 需要 HTTPS 连接，请先修改同步服务器地址');
    }
    const res = await fetch(`${creds.serverUrl}${path}`, {
      method,
      ...(path === '/ai/key' ? { redirect: 'error' as const } : {}),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.token}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({})) as { error?: string };
      const messages: Record<string, string> = {
        https_required: '设置 AI Key 需要 HTTPS 连接',
        master_key_unavailable: '服务器尚未配置 AI 凭据主密钥',
        invalid_api_key: '请输入有效的 API Key',
        ai_not_configured: '请先在桌面或手机设置 AI Key',
        ai_timeout: 'AI 响应超时，请稍后重试',
        invalid_ai_output: 'AI 返回内容无效，请重试',
        text_too_long: '便签太长，暂时无法 AI 整理',
        content_hash_mismatch: '正文已变化，请重新整理',
        invalid_ai_key: 'API Key 无效，请在设置中更新',
      };
      throw new Error(messages[payload.error || ''] ||
        (res.status === 429 ? 'AI 调用太频繁，请稍后再试' : `AI 请求失败 (${res.status})`));
    }
    return res.json() as Promise<T>;
  }

  async saveAiKey(apiKey: string): Promise<AIStatus> {
    return this.aiRequest('/ai/key', 'PUT', { apiKey });
  }

  async testAiKey(): Promise<void> {
    await this.aiRequest('/ai/key/test', 'POST');
  }

  async deleteAiKey(): Promise<AIStatus> {
    return this.aiRequest('/ai/key', 'DELETE');
  }

  async rewrite(request: AIRewriteRequest): Promise<AIRewriteResponse> {
    return this.aiRequest('/ai/rewrite', 'POST', request);
  }

  /** 通过主进程调用服务器 AI 代理（Key 只在服务器） */
  async annotate(request: AIAnnotateRequest): Promise<AIAnnotateResponse> {
    const creds = this.getCredentials();
    if (!creds.token || !creds.serverUrl) {
      throw new Error('请先开启并完成手机同步配对');
    }
    const res = await fetch(`${creds.serverUrl}/ai/annotate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.token}`,
      },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      let code = '';
      try {
        const body = (await res.json()) as { error?: string };
        code = body.error ?? '';
      } catch {
        // ignore
      }
      if (res.status === 503 || code === 'ai_not_configured') {
        throw new Error('请先在桌面或手机设置 AI Key');
      }
      if (res.status === 429) {
        throw new Error('AI 调用太频繁，请稍后再试');
      }
      if (res.status === 413) {
        throw new Error('便签太长，暂时无法 AI 整理');
      }
      if (res.status === 504) {
        throw new Error('AI 响应超时，请稍后重试');
      }
      throw new Error(`AI 整理失败 (${res.status})${code ? `: ${code}` : ''}`);
    }
    return (await res.json()) as AIAnnotateResponse;
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const creds = this.getCredentials();
    if (!creds.token) {
      throw new Error('设备尚未注册');
    }
    const res = await fetch(`${creds.serverUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.token}`,
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`同步请求失败 (${res.status}): ${body}`);
    }
    return res.json();
  }
}
