import { Notification } from 'electron';
import type { Sticker } from '../shared/types';
import type { StickerStore } from './store';
import type { StickerWindowManager } from './windows';

/** 提醒调度器 */
export class ReminderScheduler {
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private store: StickerStore;
  private windowManager: StickerWindowManager;

  constructor(store: StickerStore, windowManager: StickerWindowManager) {
    this.store = store;
    this.windowManager = windowManager;
  }

  /** 调度所有未触发的提醒 */
  scheduleAllReminders(): void {
    const stickers = this.store.getAllStickers();
    stickers.forEach((sticker) => {
      if (sticker.reminder && !sticker.reminderTriggered) {
        this.scheduleReminder(sticker);
      }
    });
  }

  /** 调度单个便签的提醒 */
  scheduleReminder(sticker: Sticker): void {
    // 先取消已存在的定时器
    this.cancelReminder(sticker.id);

    if (!sticker.reminder || sticker.reminderTriggered) return;

    const reminderTime = new Date(sticker.reminder).getTime();
    const now = Date.now();
    const delay = reminderTime - now;

    if (delay <= 0) {
      // 提醒时间已过，立即触发
      this.sendNotification(sticker);
      return;
    }

    const timer = setTimeout(() => {
      this.sendNotification(sticker);
      this.timers.delete(sticker.id);
    }, delay);

    this.timers.set(sticker.id, timer);
  }

  /** 取消单个提醒 */
  cancelReminder(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  /** 取消所有提醒 */
  cancelAllReminders(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
  }

  /** 发送系统通知 */
  sendNotification(sticker: Sticker): void {
    if (!Notification.isSupported()) return;

    const title = 'StickerNote 提醒';
    // 提取纯文本标题（取内容前 20 字）
    const plainText = sticker.content
      .replace(/<[^>]*>/g, '')
      .trim()
      .slice(0, 20);
    const body = plainText || '您有一条便签提醒';

    const notification = new Notification({
      title,
      body,
      silent: false,
    });

    notification.on('click', () => {
      // 点击通知时显示便签窗口
      this.windowManager.showStickerWindow(sticker.id);
    });

    notification.show();

    // 标记为已触发
    this.store.updateSticker(sticker.id, { reminderTriggered: true });
  }
}
