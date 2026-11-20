import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';
import type { Sticker, AppSettings, StickerColor, WindowState, ExportData, ImportMode } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/types';
import { normalizeAIAnnotation } from '../shared/ai';
import { normalizeStickerColor } from '../shared/palette';
import { normalizeSkinId } from '../shared/skins';
import { resolveAiSource } from '../shared/aiSource';

interface StoreSchema {
  stickers: Sticker[];
  settings: AppSettings;
}

/** 兼容旧版本数据：补齐 ai 字段，并把 AI JSON 归一化 */
function normalizeSticker(sticker: Sticker): Sticker {
  return {
    ...sticker,
    ai: normalizeAIAnnotation((sticker as Partial<Sticker>).ai),
    tasks: Array.isArray(sticker.tasks) ? sticker.tasks : [],
  };
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

  /** 获取所有未删除的便签（供 UI 使用） */
  getAllStickers(): Sticker[] {
    return this.store.get('stickers', []).map(normalizeSticker).filter((s) => !s.deletedAt);
  }

  /** 获取包括已删除（tombstone）的全部便签（供同步使用） */
  getAllStickersRaw(): Sticker[] {
    return this.store.get('stickers', []).map(normalizeSticker);
  }

  /** 根据 ID 获取便签（不含已删除） */
  getStickerById(id: string): Sticker | null {
    const stickers = this.getAllStickers();
    return stickers.find((s) => s.id === id) ?? null;
  }

  /** 创建新便签 */
  createSticker(partial?: Partial<Sticker>): Sticker {
    const settings = this.getSettings();
    const now = new Date().toISOString();
    const stickers = this.getAllStickersRaw();

    // 计算新窗口位置：偏移 20px
    const lastSticker = stickers.length > 0 ? stickers[stickers.length - 1] : null;
    const offset = 20;
    const defaultX = lastSticker ? lastSticker.windowState.x + offset : 100;
    const defaultY = lastSticker ? lastSticker.windowState.y + offset : 100;

    const sticker: Sticker = {
      id: uuidv4(),
      content: partial?.content ?? '',
      color: normalizeStickerColor(partial?.color ?? settings.defaultColor),
      tags: partial?.tags ?? [],
      isPinned: partial?.isPinned ?? false,
      isVisible: true,
      opacity: partial?.opacity ?? 1.0,
      reminder: partial?.reminder ?? null,
      reminderTriggered: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      windowState: partial?.windowState ?? {
        x: defaultX,
        y: defaultY,
        width: 240,
        height: 200,
      },
      ai: normalizeAIAnnotation(partial?.ai),
      tasks: partial?.tasks ?? [],
    };

    stickers.push(sticker);
    this.store.set('stickers', stickers);
    return sticker;
  }

  /** 更新便签（操作原始列表，保留已删除的 tombstone 记录） */
  updateSticker(id: string, partial: Partial<Sticker>): Sticker {
    const stickers = this.getAllStickersRaw();
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

  /**
   * 软删除便签：保留 tombstone 记录（deletedAt 置位）以便同步到其他设备，
   * 而非直接从本地列表移除。
   */
  deleteSticker(id: string): void {
    const sticker = this.getStickerById(id);
    if (!sticker) {
      throw new Error(`Sticker not found: ${id}`);
    }
    this.updateSticker(id, { deletedAt: new Date().toISOString(), isVisible: false });
  }

  /** 获取已软删除的便签（回收站），按删除时间倒序 */
  getDeletedStickers(): Sticker[] {
    return this.getAllStickersRaw()
      .filter((sticker) => !!sticker.deletedAt)
      .sort(
        (a, b) =>
          new Date(b.deletedAt ?? 0).getTime() - new Date(a.deletedAt ?? 0).getTime()
      );
  }

  /** 恢复已软删除的便签 */
  restoreSticker(id: string): Sticker {
    const stickers = this.getAllStickersRaw();
    const index = stickers.findIndex((s) => s.id === id);
    if (index === -1) {
      throw new Error(`Sticker not found: ${id}`);
    }

    const restored: Sticker = {
      ...stickers[index],
      deletedAt: null,
      isVisible: true,
      updatedAt: new Date().toISOString(),
    };
    stickers[index] = restored;
    this.store.set('stickers', stickers);
    return restored;
  }

  /** 获取全局设置（合并默认值，兼容旧版本缺字段） */
  getSettings(): AppSettings {
    const stored = this.store.get('settings') as Partial<AppSettings> | undefined;
    const merged = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
    merged.skin = normalizeSkinId(merged.skin);
    merged.aiSource = resolveAiSource(merged.aiSource, merged.aiEnabled, false);
    return merged;
  }

  hasStoredAiSource(): boolean {
    const stored = this.store.get('settings') as Partial<AppSettings> | undefined;
    return stored?.aiSource === 'device' || stored?.aiSource === 'sync';
  }

  /** 更新全局设置 */
  setSettings(settings: Partial<AppSettings>): void {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    updated.skin = normalizeSkinId(updated.skin);
    updated.aiSource = resolveAiSource(updated.aiSource, updated.aiEnabled, false);
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
      this.store.set('stickers', data.stickers.map(normalizeSticker));
      if (data.settings) {
        const merged = { ...DEFAULT_SETTINGS, ...data.settings };
        merged.skin = normalizeSkinId(merged.skin);
        merged.aiSource = resolveAiSource(
          data.settings.aiSource,
          merged.aiEnabled,
          this.getSettings().aiSource === 'sync'
        );
        this.store.set('settings', merged);
      }
    } else {
      // merge 模式：追加新便签
      const existing = this.getAllStickers();
      const existingIds = new Set(existing.map((s) => s.id));
      const newStickers = data.stickers
        .filter((s) => !existingIds.has(s.id))
        .map(normalizeSticker);
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

  /**
   * 写入一条来自远程同步的便签记录（直接覆盖，不再比较 updatedAt —
   * 调用方 SyncManager 已经做过"最后写入优先"判断）。
   */
  upsertFromSync(remote: Sticker): void {
    const stickers = this.getAllStickersRaw();
    const index = stickers.findIndex((s) => s.id === remote.id);
    const normalized = normalizeSticker(remote);
    if (index === -1) {
      stickers.push(normalized);
    } else {
      const existing = stickers[index];
      // 旧客户端不携带 ai 字段：内容未变时保留本地已有的 AI 结果
      const remoteHasAI = Object.prototype.hasOwnProperty.call(remote, 'ai');
      stickers[index] = {
        ...normalized,
        ai:
          !remoteHasAI && existing.content === normalized.content
            ? existing.ai
            : normalized.ai,
      };
    }
    this.store.set('stickers', stickers);
  }
}
