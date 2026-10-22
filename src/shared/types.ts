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
  windowState: WindowState;
}

/** 窗口位置与尺寸 */
export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 便签颜色枚举 */
export type StickerColor =
  | '#FFF9C4'
  | '#BBDEFB'
  | '#C8E6C9'
  | '#F8BBD0'
  | '#FFE0B2'
  | '#E1BEE7'
  | '#FFFFFF'
  | '#E0E0E0';

/** 全局设置模型 */
export interface AppSettings {
  shortcutNew: string;
  shortcutList: string;
  defaultColor: StickerColor;
  themeMode: 'system' | 'light' | 'dark';
  autoStart: boolean;
}

/** 默认设置 */
export const DEFAULT_SETTINGS: AppSettings = {
  shortcutNew: 'Ctrl+Alt+N',
  shortcutList: 'Ctrl+Alt+S',
  defaultColor: '#FFF9C4',
  themeMode: 'system',
  autoStart: false,
};

/** 颜色主题配置 */
export interface ColorTheme {
  name: string;
  color: StickerColor;
  darkColor: string;
  textColor: string;
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
}

/** 预加载脚本暴露的 WindowAPI */
export interface WindowAPI {
  saveState(state: WindowState): Promise<void>;
  close(): Promise<void>;
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
}
