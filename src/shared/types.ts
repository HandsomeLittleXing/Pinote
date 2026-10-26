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
  themeMode: 'system' | 'light' | 'dark';
  autoStart: boolean;
  /** 是否启用手机同步；默认 false，旧数据缺省时按是否已有 token 推断 */
  syncEnabled: boolean;
}

/** 默认设置 */
export const DEFAULT_SETTINGS: AppSettings = {
  shortcutNew: 'Ctrl+Alt+N',
  shortcutList: 'Ctrl+Alt+S',
  defaultColor: '#DFECFB',
  themeMode: 'system',
  autoStart: false,
  syncEnabled: false,
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
  shortcuts: ShortcutAPI;
  app: AppAPI;
}
