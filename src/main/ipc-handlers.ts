import { ipcMain, BrowserWindow, Menu, nativeTheme, app } from 'electron';
import { execSync } from 'child_process';
import { IPC } from '../shared/ipc-channels';
import type { AppSettings, StickerColor, ImportMode, ExportData } from '../shared/types';
import { STICKER_PALETTE, resolveStickerColor } from '../shared/palette';
import type { StickerStore } from './store';
import type { StickerWindowManager } from './windows';
import type { ReminderScheduler } from './reminders';
import type { ShortcutManager } from './shortcuts';
import type { TrayManager } from './tray';
import type { SyncManager } from './sync';

type BroadcastFn = (channel: string, ...args: unknown[]) => void;

/** IPC 事件处理器注册中心 */
export class IpcHandlerRegistry {
  private store: StickerStore;
  private windowManager: StickerWindowManager;
  private reminderScheduler: ReminderScheduler;
  private shortcutManager: ShortcutManager;
  private trayManager: TrayManager;
  private syncManager: SyncManager;
  private broadcast: BroadcastFn;

  constructor(
    store: StickerStore,
    windowManager: StickerWindowManager,
    reminderScheduler: ReminderScheduler,
    shortcutManager: ShortcutManager,
    trayManager: TrayManager,
    syncManager: SyncManager,
    broadcast: BroadcastFn
  ) {
    this.store = store;
    this.windowManager = windowManager;
    this.reminderScheduler = reminderScheduler;
    this.shortcutManager = shortcutManager;
    this.trayManager = trayManager;
    this.syncManager = syncManager;
    this.broadcast = broadcast;
  }

  registerAll(): void {
    this.registerStickerHandlers();
    this.registerWindowHandlers();
    this.registerSettingsHandlers();
    this.registerListPanelHandlers();
    this.registerDataHandlers();
    this.registerThemeHandlers();
    this.registerSyncHandlers();
  }

  private registerStickerHandlers(): void {
    ipcMain.handle(IPC.STICKER_CREATE, async (_event: any, partial?: any) => {
      const sticker = this.store.createSticker(partial);
      this.windowManager.createStickerWindow(sticker);
      this.broadcast(IPC.STICKER_LIST_CHANGED);
      return sticker;
    });

    ipcMain.handle(IPC.STICKER_GET_ALL, async () => {
      return this.store.getAllStickers();
    });

    ipcMain.handle(IPC.STICKER_GET_BY_ID, async (_event: any, id: string) => {
      return this.store.getStickerById(id);
    });

    ipcMain.handle(IPC.STICKER_UPDATE, async (_event: any, id: string, partial: any) => {
      const updated = this.store.updateSticker(id, partial);
      this.broadcast(IPC.STICKER_LIST_CHANGED);
      this.broadcast(IPC.STICKER_CHANGED, id);
      return updated;
    });

    ipcMain.handle(IPC.STICKER_DELETE, async (_event: any, id: string) => {
      this.windowManager.closeStickerWindow(id);
      this.store.deleteSticker(id);
      this.broadcast(IPC.STICKER_LIST_CHANGED);
    });

    ipcMain.handle(IPC.STICKER_GET_DELETED, async () => {
      return this.store.getDeletedStickers();
    });

    ipcMain.handle(IPC.STICKER_RESTORE, async (_event: any, id: string) => {
      const restored = this.store.restoreSticker(id);
      this.broadcast(IPC.STICKER_LIST_CHANGED);
      this.broadcast(IPC.STICKER_CHANGED, id);
      return restored;
    });

    ipcMain.handle(IPC.STICKER_FOCUS, async (_event: any, id: string) => {
      this.windowManager.focusOrShowStickerWindow(id);
      this.broadcast(IPC.STICKER_LIST_CHANGED);
    });

    ipcMain.handle(IPC.STICKER_TOGGLE_VISIBLE, async (_event: any, id: string) => {
      const sticker = this.store.getStickerById(id);
      if (!sticker) throw new Error(`Sticker not found: ${id}`);
      const newVisible = !sticker.isVisible;
      if (newVisible) {
        this.windowManager.showStickerWindow(id);
      } else {
        this.windowManager.hideStickerWindow(id);
      }
      this.broadcast(IPC.STICKER_LIST_CHANGED);
      this.broadcast(IPC.STICKER_CHANGED, id);
      return this.store.getStickerById(id)!;
    });

    ipcMain.handle(IPC.STICKER_TOGGLE_PIN, async (_event: any, id: string) => {
      const sticker = this.store.getStickerById(id);
      if (!sticker) throw new Error(`Sticker not found: ${id}`);
      const newPinned = !sticker.isPinned;
      this.windowManager.setStickerAlwaysOnTop(id, newPinned);
      this.broadcast(IPC.STICKER_LIST_CHANGED);
      this.broadcast(IPC.STICKER_CHANGED, id);
      return this.store.getStickerById(id)!;
    });

    ipcMain.handle(IPC.STICKER_SET_COLOR, async (_event: any, id: string, color: StickerColor) => {
      const updated = this.store.updateSticker(id, { color });
      this.broadcast(IPC.STICKER_LIST_CHANGED);
      this.broadcast(IPC.STICKER_CHANGED, id);
      return updated;
    });

    ipcMain.handle(IPC.STICKER_SET_OPACITY, async (_event: any, id: string, opacity: number) => {
      const updated = this.store.updateSticker(id, { opacity });
      this.broadcast(IPC.STICKER_LIST_CHANGED);
      this.broadcast(IPC.STICKER_CHANGED, id);
      return updated;
    });

    ipcMain.handle(IPC.STICKER_SET_TAGS, async (_event: any, id: string, tags: string[]) => {
      const updated = this.store.updateSticker(id, { tags });
      this.broadcast(IPC.STICKER_LIST_CHANGED);
      this.broadcast(IPC.STICKER_CHANGED, id);
      return updated;
    });

    ipcMain.handle(IPC.STICKER_SET_REMINDER, async (_event: any, id: string, reminder: string | null) => {
      const updated = this.store.updateSticker(id, { reminder, reminderTriggered: false });
      if (updated) {
        this.reminderScheduler.scheduleReminder(updated);
      }
      this.broadcast(IPC.STICKER_LIST_CHANGED);
      this.broadcast(IPC.STICKER_CHANGED, id);
      return updated;
    });
  }

  private registerWindowHandlers(): void {
    ipcMain.handle(IPC.WINDOW_SAVE_STATE, async (_event: any, state: any) => {
      const context = this.getWindowContext(_event);
      if (!context) return;
      this.store.saveWindowState(context.id, state);
    });

    ipcMain.handle(IPC.WINDOW_CLOSE, async (_event: any) => {
      const context = this.getWindowContext(_event);
      if (context) {
        this.windowManager.hideStickerWindow(context.id);
      }
    });

    ipcMain.handle(IPC.WINDOW_SET_COLLAPSED, async (_event: any, collapsed: boolean) => {
      const context = this.getWindowContext(_event);
      if (context) {
        this.windowManager.setCollapsed(context.id, collapsed);
      }
    });

    // 收起后的窗口只有 34px，Radix 浮层会被裁切，改用原生菜单
    ipcMain.handle(IPC.WINDOW_SHOW_COLLAPSED_MENU, async (_event: any) => {
      const context = this.getWindowContext(_event);
      if (!context) return;
      const { win, id } = context;
      const sticker = this.store.getStickerById(id);
      if (!sticker) return;

      // 收起态窗口只有 34px，无法容纳 Radix 面板；换色放进原生菜单子项
      const currentColor = resolveStickerColor(sticker.color).color;
      const colorSubmenu = STICKER_PALETTE.map((theme) => ({
        label: theme.name,
        type: 'radio' as const,
        checked: currentColor === theme.color,
        click: () => {
          this.store.updateSticker(id, { color: theme.color });
          this.broadcast(IPC.STICKER_LIST_CHANGED);
          this.broadcast(IPC.STICKER_CHANGED, id);
        },
      }));

      const menu = Menu.buildFromTemplate([
        {
          label: '展开便签',
          click: () => this.windowManager.setCollapsed(id, false),
        },
        {
          label: '换色',
          submenu: colorSubmenu,
        },
        {
          label: sticker.isPinned ? '取消置顶' : '置顶',
          click: () => {
            this.windowManager.setStickerAlwaysOnTop(id, !sticker.isPinned);
            this.broadcast(IPC.STICKER_LIST_CHANGED);
            this.broadcast(IPC.STICKER_CHANGED, id);
          },
        },
        { type: 'separator' },
        {
          label: '隐藏便签',
          click: () => this.windowManager.hideStickerWindow(id),
        },
      ]);
      menu.popup({ window: win });
    });
  }

  /** 从窗口 URL 中取出便签 id，供窗口类 IPC 复用 */
  private getWindowContext(event: any): { win: BrowserWindow; id: string } | null {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    try {
      const id = new URL(win.webContents.getURL()).searchParams.get('id');
      return id ? { win, id } : null;
    } catch {
      return null;
    }
  }

  private registerSettingsHandlers(): void {
    ipcMain.handle(IPC.APP_GET_VERSION, async () => {
      return app.getVersion();
    });

    ipcMain.handle(IPC.SETTINGS_GET, async () => {
      return this.store.getSettings();
    });

    ipcMain.handle(IPC.SHORTCUTS_SET_RECORDING, async (_event: any, recording: boolean) => {
      this.shortcutManager.setRecording(recording);
    });

    ipcMain.handle(IPC.SETTINGS_SET, async (_event: any, settings: any) => {
      const oldSettings = this.store.getSettings();
      const mergedSettings: AppSettings = { ...oldSettings, ...settings };

      // 同步开关先于设置落库执行：开启失败（地址为空/注册失败）时中止保存，避免部分生效
      if (typeof settings.syncEnabled === 'boolean') {
        const currentEnabled = this.syncManager.getStatus().enabled;
        if (currentEnabled !== settings.syncEnabled) {
          await this.syncManager.setEnabled(settings.syncEnabled);
        }
      }

      // 快捷键先试注册：失败则不落库，并恢复旧快捷键
      if (
        oldSettings.shortcutNew !== mergedSettings.shortcutNew ||
        oldSettings.shortcutList !== mergedSettings.shortcutList
      ) {
        const failed = this.shortcutManager.updateShortcuts(mergedSettings);
        if (failed.length > 0) {
          throw new Error(`快捷键已被占用：${failed.join('、')}`);
        }
      }

      // 合并保存（支持批量更新）
      this.store.setSettings(settings);
      const newSettings = this.store.getSettings();

      // 主题变化：广播有效主题，并同步列表/设置窗口的标题栏覆盖层
      if (oldSettings.themeMode !== newSettings.themeMode) {
        const theme = this.windowManager.getEffectiveTheme();
        this.broadcast(IPC.THEME_CHANGED, theme);
        this.windowManager.updatePanelWindowChrome(theme);
      }

      // 开机自启动（写注册表，用安装目录路径）
      if (oldSettings.autoStart !== newSettings.autoStart) {
        const appPath = app.isPackaged ? app.getPath('exe') : process.execPath;
        const regPath = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
        try {
          if (newSettings.autoStart) {
            const cmd = `powershell -NoProfile -Command "Set-ItemProperty -Path '${regPath}' -Name 'StickerNote' -Value '\"${appPath}\" --autostart' -Force"`;
            execSync(cmd, { stdio: 'ignore' });
          } else {
            const cmd = `powershell -NoProfile -Command "Remove-ItemProperty -Path '${regPath}' -Name 'StickerNote' -ErrorAction SilentlyContinue"`;
            execSync(cmd, { stdio: 'ignore' });
          }
        } catch (err) {
          console.error('设置开机自启动失败:', err);
        }
      }

      this.trayManager.updateContextMenu();
    });
  }

  private registerListPanelHandlers(): void {
    ipcMain.handle(IPC.LIST_PANEL_OPEN, async () => {
      this.windowManager.createListPanelWindow();
    });

    ipcMain.handle(IPC.LIST_PANEL_CLOSE, async () => {
      // 由窗口自身管理
    });
  }

  private registerDataHandlers(): void {
    ipcMain.handle(IPC.DATA_EXPORT, async () => {
      return this.store.exportData();
    });

    ipcMain.handle(IPC.DATA_IMPORT, async (_event: any, data: ExportData, mode: ImportMode) => {
      this.store.importData(data, mode);
      this.broadcast(IPC.STICKER_LIST_CHANGED);
    });
  }

  private registerThemeHandlers(): void {
    ipcMain.handle(IPC.THEME_GET_CURRENT, async () => {
      const settings = this.store.getSettings();
      if (settings.themeMode === 'system') {
        return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
      }
      return settings.themeMode;
    });
  }

  private registerSyncHandlers(): void {
    ipcMain.handle(IPC.SYNC_GET_STATUS, async () => {
      return this.syncManager.getStatus();
    });

    ipcMain.handle(IPC.SYNC_SET_ENABLED, async (_event: any, enabled: boolean) => {
      const status = await this.syncManager.setEnabled(enabled);
      this.broadcast(IPC.SYNC_STATUS_CHANGED, status);
      return status;
    });

    ipcMain.handle(IPC.SYNC_SET_SERVER_URL, async (_event: any, url: string) => {
      const status = await this.syncManager.setServerUrl(url);
      this.broadcast(IPC.SYNC_STATUS_CHANGED, status);
      return status;
    });

    ipcMain.handle(IPC.SYNC_CREATE_PAIRING_CODE, async () => {
      return this.syncManager.createPairingCode();
    });

    ipcMain.handle(IPC.SYNC_LIST_DEVICES, async () => {
      return this.syncManager.listDevices();
    });

    ipcMain.handle(IPC.SYNC_UNLINK_DEVICE, async (_event: any, deviceId: string) => {
      await this.syncManager.unlinkDevice(deviceId);
    });

    ipcMain.handle(IPC.SYNC_NOW, async () => {
      const status = await this.syncManager.syncNow();
      this.broadcast(IPC.STICKER_LIST_CHANGED);
      return status;
    });
  }
}
