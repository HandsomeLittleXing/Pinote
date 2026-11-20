import { app, BrowserWindow, nativeTheme } from 'electron';
import { join } from 'path';
import { StickerStore } from './store';
import { StickerWindowManager } from './windows';
import { TrayManager } from './tray';
import { ShortcutManager } from './shortcuts';
import { ReminderScheduler } from './reminders';
import { SyncManager } from './sync';
import { IpcHandlerRegistry, syncAutoStart } from './ipc-handlers';
import { IPC } from '../shared/ipc-channels';
import { resolveAiSource } from '../shared/aiSource';

let stickerStore: StickerStore;
let windowManager: StickerWindowManager;
let trayManager: TrayManager;
let shortcutManager: ShortcutManager;
let reminderScheduler: ReminderScheduler;
let syncManager: SyncManager;
let ipcRegistry: IpcHandlerRegistry;

function isDev(): boolean {
  return !app.isPackaged;
}

function getPreloadPath(): string {
  return join(__dirname, '../preload/index.js');
}

function getRendererUrl(query?: string): string {
  const queryString = query ? `?${query}` : '';
  if (isDev()) {
    return `http://localhost:5173${queryString}`;
  }
  return `file://${join((process as any).resourcesPath, 'renderer', 'index.html')}${queryString}`;
}

/** 广播事件到所有窗口 */
function broadcast(channel: string, ...args: unknown[]): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  });
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  // 已有实例在运行：直接退出，避免重复托盘、重复同步定时器与并发写同一个 JSON
  app.quit();
} else {
  app.on('second-instance', () => {
    void trayManager?.createTray();
    if (windowManager) {
      windowManager.createListPanelWindow();
    }
  });

  app.setAppUserModelId('com.stickernote.app');

  app.whenReady().then(async () => {
    stickerStore = new StickerStore();
    if (app.isPackaged && stickerStore.getSettings().autoStart) {
      syncAutoStart(true);
    }
    windowManager = new StickerWindowManager(stickerStore, getPreloadPath, getRendererUrl);
    reminderScheduler = new ReminderScheduler(stickerStore, windowManager);
    trayManager = new TrayManager(stickerStore, windowManager);
    await trayManager.createTray();
    shortcutManager = new ShortcutManager(stickerStore, windowManager);
    shortcutManager.registerAll();
    syncManager = new SyncManager(stickerStore);
    if (!stickerStore.hasStoredAiSource()) {
      stickerStore.setSettings({
        aiSource: resolveAiSource(undefined, stickerStore.getSettings().aiEnabled, syncManager.getStatus().linked),
      });
    }

    ipcRegistry = new IpcHandlerRegistry(
      stickerStore,
      windowManager,
      reminderScheduler,
      shortcutManager,
      trayManager,
      syncManager,
      broadcast
    );
    ipcRegistry.registerAll();

    reminderScheduler.scheduleAllReminders();

    // 监听系统主题变化：广播有效主题并同步面板窗口标题栏
    nativeTheme.on('updated', () => {
      const theme = windowManager.getEffectiveTheme();
      broadcast(IPC.THEME_CHANGED, theme);
      windowManager.updatePanelWindowChrome(theme);
    });

    windowManager.restoreAllWindows();

    // 云同步：注册设备（首次）并启动定时拉推，状态变化广播给所有窗口
    syncManager.onStatusChanged((status) => {
      broadcast(IPC.SYNC_STATUS_CHANGED, status);
    });
    // 同步拉取到远程变更时，刷新列表并驱动已打开便签窗口
    syncManager.onDataChanged((changed) => {
      broadcast(IPC.STICKER_LIST_CHANGED);

      changed.forEach((sticker) => {
        if (sticker.deletedAt) {
          reminderScheduler.cancelReminder(sticker.id);
          windowManager.closeStickerWindow(sticker.id);
          return;
        }

        windowManager.applyRemoteState(sticker);

        if (sticker.reminder && !sticker.reminderTriggered) {
          reminderScheduler.scheduleReminder(sticker);
        } else {
          reminderScheduler.cancelReminder(sticker.id);
        }

        broadcast(IPC.STICKER_CHANGED, sticker.id);
      });
    });
    syncManager.start().catch((err) => {
      console.error('云同步启动失败:', err);
    });
  });
}

app.on('window-all-closed', () => {
  // 保持托盘运行
});

app.on('activate', () => {
  if (windowManager && BrowserWindow.getAllWindows().length === 0) {
    windowManager.restoreAllWindows();
  }
});

app.on('before-quit', () => {
  shortcutManager?.unregisterAll();
  trayManager?.destroy();
  reminderScheduler?.cancelAllReminders();
  syncManager?.stop();
});

export { stickerStore, windowManager, getPreloadPath, getRendererUrl };
