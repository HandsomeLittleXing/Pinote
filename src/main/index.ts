import { app, BrowserWindow, nativeTheme } from 'electron';
import { join } from 'path';
import { StickerStore } from './store';
import { StickerWindowManager } from './windows';
import { TrayManager } from './tray';
import { ShortcutManager } from './shortcuts';
import { ReminderScheduler } from './reminders';
import { IpcHandlerRegistry } from './ipc-handlers';

let stickerStore: StickerStore;
let windowManager: StickerWindowManager;
let trayManager: TrayManager;
let shortcutManager: ShortcutManager;
let reminderScheduler: ReminderScheduler;
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

app.whenReady().then(() => {
  stickerStore = new StickerStore();
  windowManager = new StickerWindowManager(stickerStore, getPreloadPath, getRendererUrl);
  reminderScheduler = new ReminderScheduler(stickerStore, windowManager);
  trayManager = new TrayManager(stickerStore, windowManager);
  trayManager.createTray();
  shortcutManager = new ShortcutManager(stickerStore, windowManager);
  shortcutManager.registerAll();

  ipcRegistry = new IpcHandlerRegistry(
    stickerStore,
    windowManager,
    reminderScheduler,
    shortcutManager,
    trayManager,
    broadcast
  );
  ipcRegistry.registerAll();

  reminderScheduler.scheduleAllReminders();

  // 监听系统主题变化
  nativeTheme.on('updated', () => {
    const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    broadcast('theme:changed', theme);
  });

  windowManager.restoreAllWindows();
});

app.on('window-all-closed', () => {
  // 保持托盘运行
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    windowManager.restoreAllWindows();
  }
});

app.on('before-quit', () => {
  shortcutManager?.unregisterAll();
  trayManager?.destroy();
  reminderScheduler?.cancelAllReminders();
});

export { stickerStore, windowManager, getPreloadPath, getRendererUrl };
