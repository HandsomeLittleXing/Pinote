import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';
import type { Sticker, AppSettings, StickerColor, WindowState, ExportData, ImportMode } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/types';

interface StoreSchema {
  stickers: Sticker[];
  settings: AppSettings;
}

/** 便签数据存储管理类 */
export class StickerStore {
  private store: Store<StoreSchema>;

  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'stickernote',
      defaults: {
        stickers: [],
        settings: { ...DEFAULT_SETTINGS },
      },
    });
  }

  /** 获取所有便签 */
  getAllStickers(): Sticker[] {
    return this.store.get('stickers', []);
  }

  /** 根据 ID 获取便签 */
  getStickerById(id: string): Sticker | null {
    const stickers = this.getAllStickers();
    return stickers.find((s) => s.id === id) ?? null;
  }

  /** 创建新便签 */
  createSticker(partial?: Partial<Sticker>): Sticker {
    const settings = this.getSettings();
    const now = new Date().toISOString();
    const stickers = this.getAllStickers();

    // 计算新窗口位置：偏移 20px
    const lastSticker = stickers.length > 0 ? stickers[stickers.length - 1] : null;
    const offset = 20;
    const defaultX = lastSticker ? lastSticker.windowState.x + offset : 100;
    const defaultY = lastSticker ? lastSticker.windowState.y + offset : 100;

    const sticker: Sticker = {
      id: uuidv4(),
      content: '',
      color: partial?.color ?? settings.defaultColor,
      tags: partial?.tags ?? [],
      isPinned: partial?.isPinned ?? false,
      isVisible: true,
      opacity: partial?.opacity ?? 1.0,
      reminder: partial?.reminder ?? null,
      reminderTriggered: false,
      createdAt: now,
      updatedAt: now,
      windowState: partial?.windowState ?? {
        x: defaultX,
        y: defaultY,
        width: 240,
        height: 200,
      },
    };

    stickers.push(sticker);
    this.store.set('stickers', stickers);
    return sticker;
  }

  /** 更新便签 */
  updateSticker(id: string, partial: Partial<Sticker>): Sticker {
    const stickers = this.getAllStickers();
    const index = stickers.findIndex((s) => s.id === id);
    if (index === -1) {
      throw new Error(`Sticker not found: ${id}`);
    }

    const updated: Sticker = {
      ...stickers[index],
      ...partial,
      id: stickers[index].id, // 不允许修改 ID
      updatedAt: new Date().toISOString(),
    };

    stickers[index] = updated;
    this.store.set('stickers', stickers);
    return updated;
  }

  /** 删除便签 */
  deleteSticker(id: string): void {
    const stickers = this.getAllStickers();
    const filtered = stickers.filter((s) => s.id !== id);
    if (filtered.length === stickers.length) {
      throw new Error(`Sticker not found: ${id}`);
    }
    this.store.set('stickers', filtered);
  }

  /** 获取全局设置 */
  getSettings(): AppSettings {
    return this.store.get('settings', { ...DEFAULT_SETTINGS });
  }

  /** 更新全局设置 */
  setSettings(settings: Partial<AppSettings>): void {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    this.store.set('settings', updated);
  }

  /** 导出全部数据 */
  exportData(): ExportData {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      stickers: this.getAllStickers(),
      settings: this.getSettings(),
    };
  }

  /** 导入数据 */
  importData(data: ExportData, mode: ImportMode): void {
    if (!data.stickers || !Array.isArray(data.stickers)) {
      throw new Error('Invalid import data: missing stickers array');
    }

    if (mode === 'overwrite') {
      this.store.set('stickers', data.stickers);
      if (data.settings) {
        this.store.set('settings', data.settings);
      }
    } else {
      // merge 模式：追加新便签
      const existing = this.getAllStickers();
      const existingIds = new Set(existing.map((s) => s.id));
      const newStickers = data.stickers.filter((s) => !existingIds.has(s.id));
      this.store.set('stickers', [...existing, ...newStickers]);
    }
  }

  /** 保存窗口状态 */
  saveWindowState(id: string, windowState: WindowState): void {
    this.updateSticker(id, { windowState });
  }

  /** 获取所有标签（去重） */
  getAllTags(): string[] {
    const stickers = this.getAllStickers();
    const tagSet = new Set<string>();
    stickers.forEach((s) => {
      s.tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }
}
