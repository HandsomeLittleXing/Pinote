import { globalShortcut } from 'electron';
import type { AppSettings } from '../shared/types';
import type { StickerStore } from './store';
import type { StickerWindowManager } from './windows';

/** 全局快捷键管理器 */
export class ShortcutManager {
  private store: StickerStore;
  private windowManager: StickerWindowManager;

  constructor(store: StickerStore, windowManager: StickerWindowManager) {
    this.store = store;
    this.windowManager = windowManager;
  }

  /** 注册所有快捷键 */
  registerAll(): void {
    const settings = this.store.getSettings();
    this.registerShortcut(settings.shortcutNew, () => {
      const sticker = this.store.createSticker();
      this.windowManager.createStickerWindow(sticker);
    });

    this.registerShortcut(settings.shortcutList, () => {
      this.windowManager.createListPanelWindow();
    });
  }

  /** 注销所有快捷键 */
  unregisterAll(): void {
    globalShortcut.unregisterAll();
  }

  /** 更新快捷键设置 */
  updateShortcuts(settings: AppSettings): void {
    this.unregisterAll();
    this.registerAll();
  }

  /** 注册单个快捷键 */
  private registerShortcut(accelerator: string, callback: () => void): void {
    try {
      const success = globalShortcut.register(accelerator, callback);
      if (!success) {
        console.warn(`快捷键注册失败（可能已被占用）：${accelerator}`);
      }
    } catch (error) {
      console.error(`快捷键注册异常：${accelerator}`, error);
    }
  }
}
