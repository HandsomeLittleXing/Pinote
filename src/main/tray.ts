import { Tray, Menu, nativeImage, app } from 'electron';
import { join } from 'path';
import type { StickerStore } from './store';
import type { StickerWindowManager } from './windows';

/** 系统托盘管理器 */
export class TrayManager {
  private tray: any = null;
  private store: StickerStore;
  private windowManager: StickerWindowManager;

  constructor(store: StickerStore, windowManager: StickerWindowManager) {
    this.store = store;
    this.windowManager = windowManager;
  }

  /** 创建系统托盘 */
  createTray(): void {
    const iconPath = this.getIconPath();
    const icon = nativeImage.createFromPath(iconPath);

    // 打包后确保图标有效
    if (icon.isEmpty()) {
      console.error('托盘图标加载失败，路径:', iconPath);
      return;
    }

    this.tray = new Tray(icon.resize({ width: 16, height: 16 }));
    this.tray.setToolTip('电脑便签 - 随手一贴');

    this.updateContextMenu();

    // 单击托盘图标：显示/隐藏所有便签
    this.tray.on('click', () => {
      this.windowManager.createListPanelWindow();
    });

    // 双击托盘图标：新建便签
    this.tray.on('double-click', () => {
      const sticker = this.store.createSticker();
      this.windowManager.createStickerWindow(sticker);
    });
  }

  /** 更新右键菜单 */
  updateContextMenu(): void {
    if (!this.tray) return;

    const settings = this.store.getSettings();
    const stickers = this.store.getAllStickers();
    const visibleCount = stickers.filter((s) => s.isVisible).length;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: `共 ${stickers.length} 条便签，${visibleCount} 条显示中`,
        enabled: false,
      },
      { type: 'separator' },
      {
        label: '新建便签',
        type: 'normal',
        accelerator: settings.shortcutNew,
        click: () => {
          const sticker = this.store.createSticker();
          this.windowManager.createStickerWindow(sticker);
        },
      },
      {
        label: '便签列表',
        type: 'normal',
        accelerator: settings.shortcutList,
        click: () => {
          this.windowManager.createListPanelWindow();
        },
      },
      { type: 'separator' },
      {
        label: '显示所有便签',
        type: 'normal',
        click: () => {
          stickers.forEach((s) => {
            if (!s.isVisible) {
              this.windowManager.showStickerWindow(s.id);
            }
          });
        },
      },
      {
        label: '隐藏所有便签',
        type: 'normal',
        click: () => {
          stickers.forEach((s) => {
            if (s.isVisible) {
              this.windowManager.hideStickerWindow(s.id);
            }
          });
        },
      },
      { type: 'separator' },
      {
        label: '设置',
        type: 'normal',
        click: () => {
          this.windowManager.createSettingsWindow();
        },
      },
      {
        label: '关于',
        type: 'normal',
        click: () => {
          const { dialog } = require('electron');
          dialog.showMessageBox({
            type: 'info',
            title: '关于电脑便签',
            message: '电脑便签 v1.1.0',
            detail: '开机即在，随手一贴\n\n快捷键：\n  Ctrl+Alt+N - 新建便签\n  Ctrl+Alt+S - 打开列表\n\n右键托盘图标查看更多选项',
          });
        },
      },
      { type: 'separator' },
      {
        label: '退出',
        type: 'normal',
        click: () => {
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  /** 销毁托盘 */
  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  /** 获取图标路径（兼容开发和打包环境） */
  private getIconPath(): string {
    // 打包后 resources 在 process.resourcesPath
    if (app.isPackaged) {
      return join((process as any).resourcesPath, 'icon.ico');
    }
    // 开发环境
    return join(__dirname, '../../resources/icon.ico');
  }
}
