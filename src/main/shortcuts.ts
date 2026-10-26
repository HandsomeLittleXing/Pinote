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

  /** 注册所有快捷键（启动时使用，失败仅记录日志） */
  registerAll(): void {
    const settings = this.store.getSettings();
    this.registerNewStickerShortcut(settings.shortcutNew);
    this.registerListShortcut(settings.shortcutList);
  }

  /** 注销所有快捷键 */
  unregisterAll(): void {
    globalShortcut.unregisterAll();
  }

  /**
   * 更新快捷键。
   * 返回注册失败的组合键；失败时恢复 store 中的旧设置，保证至少旧快捷键可用。
   */
  updateShortcuts(settings: AppSettings): string[] {
    this.unregisterAll();
    const failed: string[] = [];

    if (!this.registerNewStickerShortcut(settings.shortcutNew)) {
      failed.push(settings.shortcutNew);
    }
    if (!this.registerListShortcut(settings.shortcutList)) {
      failed.push(settings.shortcutList);
    }

    if (failed.length > 0) {
      this.unregisterAll();
      this.registerAll();
    }

    return failed;
  }

  /** 录制期间暂停全局快捷键，避免捕获组合键时触发新建/列表 */
  setRecording(recording: boolean): void {
    this.unregisterAll();
    if (!recording) {
      this.registerAll();
    }
  }

  private registerNewStickerShortcut(accelerator: string): boolean {
    return this.registerShortcut(accelerator, () => {
      const sticker = this.store.createSticker();
      this.windowManager.createStickerWindow(sticker);
    });
  }

  private registerListShortcut(accelerator: string): boolean {
    return this.registerShortcut(accelerator, () => {
      this.windowManager.createListPanelWindow();
    });
  }

  /** 注册单个快捷键，返回是否成功 */
  private registerShortcut(accelerator: string, callback: () => void): boolean {
    if (!accelerator) {
      console.warn('快捷键为空，跳过注册');
      return false;
    }
    try {
      const success = globalShortcut.register(accelerator, callback);
      if (!success) {
        console.warn(`快捷键注册失败（可能已被占用）：${accelerator}`);
      }
      return success;
    } catch (error) {
      console.error(`快捷键注册异常：${accelerator}`, error);
      return false;
    }
  }
}
