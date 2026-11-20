/** 主题皮肤标识 */
export type SkinId = 'glass' | 'vellum' | 'mote';

/** 明暗模式 */
export type ThemeMode = 'system' | 'light' | 'dark';

/** AI 请求来源：设备直连云模型或同步空间服务端 */
export type AISource = 'device' | 'sync';

/** 语义标注类别 */
export type AnnotationKind = 'time' | 'place' | 'person' | 'action' | 'important';

/** 一条 AI 语义标注：text 必须来自便签纯文本的精确子串 */
export interface AnnotationSpan {
  kind: AnnotationKind;
  text: string;
  /** 1 = 轻强调，3 = 强强调 */
  importance: 1 | 2 | 3;
  /** 可选的 UTF-16 偏移提示；客户端仍应按 text 精确匹配 */
  start?: number;
}

/** AI 建议的提醒 */
export interface SuggestedReminder {
  /** 原文中的时间/事项短语 */
  text: string;
  /** 带时区的 ISO 8601；没有明确时间时为 null */
  dueAt: string | null;
  /** 0–1 置信度 */
  confidence: number;
}

/**
 * AI 整理结果。它与正文分开存储，正文 HTML 永远不会被写入标注标记。
 * contentHash 是归一化纯文本的哈希，用于判断结果是否过期。
 */
export interface AIAnnotation {
  version: 1;
  contentHash: string;
  summary: string;
  tags: string[];
  spans: AnnotationSpan[];
  todos: string[];
  suggestedReminder: SuggestedReminder | null;
  generatedAt: string;
  model: string;
}

export interface StickerTask {
  id: string;
  text: string;
  done: boolean;
}

/** 便签数据模型 */
export interface Sticker {
  id: string;
  content: string;
  color: StickerColor;
  tags: string[];
  isPinned: boolean;
  isVisible: boolean;
  opacity: number;
  reminder: string | null;
  reminderTriggered: boolean;
  createdAt: string;
  updatedAt: string;
  /** 软删除标记，ISO 8601；非 null 表示已删除（用于跨设备同步 tombstone） */
  deletedAt: string | null;
  windowState: WindowState;
  /** AI 整理结果（摘要/标签/语义标注/提醒建议），没整理过为 null */
  ai: AIAnnotation | null;
  /** 从 AI 建议采纳的可勾选事项 */
  tasks?: StickerTask[];
}

/** 窗口位置与尺寸 */
export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 便签颜色枚举：前 8 个为冷色板，后 7 个为兼容旧数据 */
export type StickerColor =
  // 冷色板
  | '#DFECFB'
  | '#DCEDF3'
  | '#DFF2EC'
  | '#F5E6ED'
  | '#E6EEE3'
  | '#EAE5F8'
  | '#FFFFFF'
  | '#ECEFF4'
  // 旧色板（仅用于读取与映射）
  | '#FFF9C4'
  | '#BBDEFB'
  | '#C8E6C9'
  | '#F8BBD0'
  | '#FFE0B2'
  | '#E1BEE7'
  | '#E0E0E0';

/** 全局设置模型 */
export interface AppSettings {
  shortcutNew: string;
  shortcutList: string;
  defaultColor: StickerColor;
  themeMode: ThemeMode;
  /** 主题皮肤 */
  skin: SkinId;
  autoStart: boolean;
  /** 是否启用手机同步；默认 false，旧数据缺省时按是否已有 token 推断 */
  syncEnabled: boolean;
  /** 是否启用 AI 整理（Key 在服务器，客户端只控制是否允许发送文本） */
  aiEnabled: boolean;
  /** 当前设备的 AI 请求来源；API Key 另行安全存储 */
  aiSource: AISource;
  /** 已同意的 AI 隐私说明版本；0 表示尚未同意 */
  aiConsentVersion: number;
  /** 在列表卡片显示 AI 摘要 */
  showAiSummary: boolean;
  /** 在列表卡片显示 AI 标签 */
  showAiTags: boolean;
}

/** 默认设置 */
export const DEFAULT_SETTINGS: AppSettings = {
  shortcutNew: 'Ctrl+Alt+N',
  shortcutList: 'Ctrl+Alt+S',
  defaultColor: '#DFECFB',
  themeMode: 'system',
  skin: 'glass',
  autoStart: false,
  syncEnabled: false,
  aiEnabled: false,
  aiSource: 'device',
  aiConsentVersion: 0,
  showAiSummary: true,
  showAiTags: true,
};

/** 颜色主题配置 */
export interface ColorTheme {
  /** 稳定标识，便于测试与映射 */
  key: string;
  name: string;
  color: StickerColor;
  darkColor: string;
  textColor: string;
  darkTextColor: string;
}

/** 导入模式 */
export type ImportMode = 'merge' | 'overwrite';

/** 导出数据结构 */
export interface ExportData {
  version: string;
  exportedAt: string;
  stickers: Sticker[];
  settings: AppSettings;
}

/** 云同步状态 */
export interface SyncStatus {
  /** 当前是否启用同步 */
  enabled: boolean;
  /** 是否已完成设备注册（拥有 token） */
  linked: boolean;
  /** 同步服务器地址 */
  serverUrl: string;
  /**
   * 供手机使用的配对地址：当 serverUrl 指向本机（localhost/127.0.0.1）时，
   * 自动替换为电脑的局域网 IP，方便本地测试时手机访问。
   */
  pairingServerUrl: string;
  /** 上次成功同步时间，ISO 8601 */
  lastSyncedAt: string | null;
  /** 最近一次同步是否失败 */
  lastError: string | null;
}

/** 已配对设备信息（用于设置页展示） */
export interface SyncDevice {
  id: string;
  deviceName: string;
  platform: string;
  createdAt: string;
  lastSeenAt: string;
  /** 是否为当前设备 */
  isCurrent: boolean;
}

/** 生成的配对码 */
export interface PairingCodeResult {
  code: string;
  expiresAt: string;
  ttlSeconds: number;
}

/** AI 服务状态 */
export interface AIStatus {
  configured: boolean;
  model: string;
  source?: 'device' | 'space' | 'server' | 'none';
  keyHint?: string;
}

export interface AIRewriteBlock {
  type: 'heading' | 'paragraph' | 'bullet';
  text: string;
}

export interface AIRewriteSupplement {
  id: string;
  kind: 'suggestion' | 'example' | 'question';
  text: string;
}

export interface AIRewriteRequest {
  plainText: string;
  contentHash: string;
}

export interface AIRewriteResponse {
  sourceHash: string;
  organizedBlocks: AIRewriteBlock[];
  supplements: AIRewriteSupplement[];
}

/** AI 整理请求 */
export interface AIAnnotateRequest {
  /** 归一化后的便签纯文本（不是 HTML） */
  plainText: string;
  contentHash: string;
  timezone?: string;
  /** true 时绕过服务端缓存 */
  force?: boolean;
}

/** AI 整理响应 */
export interface AIAnnotateResponse {
  annotation: AIAnnotation;
  cached: boolean;
}

/** 预加载脚本暴露的 AIAPI */
export interface AIAPI {
  getStatus(): Promise<AIStatus>;
  saveKey(apiKey: string): Promise<AIStatus>;
  testKey(): Promise<void>;
  deleteKey(): Promise<AIStatus>;
  annotate(request: AIAnnotateRequest): Promise<AIAnnotateResponse>;
  rewrite(request: AIRewriteRequest): Promise<AIRewriteResponse>;
}

/** 预加载脚本暴露的 SyncAPI */
export interface SyncAPI {
  getStatus(): Promise<SyncStatus>;
  setEnabled(enabled: boolean): Promise<SyncStatus>;
  setServerUrl(url: string): Promise<SyncStatus>;
  createPairingCode(): Promise<PairingCodeResult>;
  listDevices(): Promise<SyncDevice[]>;
  unlinkDevice(deviceId: string): Promise<void>;
  syncNow(): Promise<SyncStatus>;
  onStatusChanged(callback: (status: SyncStatus) => void): () => void;
}

/** 预加载脚本暴露的 StickerAPI */
export interface StickerAPI {
  create(partial?: Partial<Sticker>): Promise<Sticker>;
  getAll(): Promise<Sticker[]>;
  getById(id: string): Promise<Sticker | null>;
  update(id: string, partial: Partial<Sticker>): Promise<Sticker>;
  delete(id: string): Promise<void>;
  toggleVisible(id: string): Promise<Sticker>;
  togglePin(id: string): Promise<Sticker>;
  setColor(id: string, color: StickerColor): Promise<Sticker>;
  setOpacity(id: string, opacity: number): Promise<Sticker>;
  setTags(id: string, tags: string[]): Promise<Sticker>;
  setReminder(id: string, reminder: string | null): Promise<Sticker>;
  onListChanged(callback: () => void): () => void;
  /** 订阅单条便签变更（本地或同步写入），返回取消订阅函数 */
  onChanged(callback: (id: string) => void): () => void;
  /** 获取已软删除的便签（最近删除） */
  getDeleted(): Promise<Sticker[]>;
  /** 恢复已软删除的便签 */
  restore(id: string): Promise<Sticker>;
  /** 显示并聚焦已存在的便签窗口 */
  focus(id: string): Promise<void>;
}

/** 快捷键录制辅助 API */
export interface ShortcutAPI {
  /** 录制期间暂停全局快捷键，避免捕获组合键时触发新建/列表 */
  setRecording(recording: boolean): Promise<void>;
}

/** 应用信息 API */
export interface AppAPI {
  getVersion(): Promise<string>;
}

/** 预加载脚本暴露的 WindowAPI */
export interface WindowAPI {
  saveState(state: WindowState): Promise<void>;
  close(): Promise<void>;
  /** 收起/展开当前便签窗口 */
  setCollapsed(collapsed: boolean): Promise<void>;
  /** 收起态弹出原生操作菜单 */
  showCollapsedMenu(): Promise<void>;
  /** 订阅收起状态变化（原生菜单展开也走这里） */
  onCollapsedChanged(callback: (collapsed: boolean) => void): () => void;
}

/** 预加载脚本暴露的 SettingsAPI */
export interface SettingsAPI {
  get(): Promise<AppSettings>;
  set(settings: Partial<AppSettings>): Promise<void>;
  /** 订阅设置变更（皮肤、AI 开关等），返回取消订阅函数 */
  onChanged(callback: (settings: AppSettings) => void): () => void;
}

/** 预加载脚本暴露的 ThemeAPI */
export interface ThemeAPI {
  getCurrent(): Promise<string>;
  onChanged(callback: (theme: string) => void): () => void;
}

/** 预加载脚本暴露的 DataAPI */
export interface DataAPI {
  export(): Promise<ExportData>;
  import(data: ExportData, mode: ImportMode): Promise<void>;
}

/** 预加载脚本暴露的完整 API */
export interface PreloadAPI {
  sticker: StickerAPI;
  window: WindowAPI;
  settings: SettingsAPI;
  theme: ThemeAPI;
  data: DataAPI;
  sync: SyncAPI;
  ai: AIAPI;
  shortcuts: ShortcutAPI;
  app: AppAPI;
}
