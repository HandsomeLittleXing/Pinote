import { BrowserWindow, screen } from 'electron';
import type { Sticker, WindowState } from '../shared/types';
import type { StickerStore } from './store';

type GetPreloadPathFn = () => string;
type GetRendererUrlFn = (query?: string) => string;

/** 贴边阈值（像素） */
const EDGE_SNAP_THRESHOLD = 25;

/** 便签窗口管理器 */
export class StickerWindowManager {
  private windows: Map<string, BrowserWindow> = new Map();
  private snapCooldown: Map<string, number> = new Map();  // 贴边冷却时间戳
  private listPanelWindow: BrowserWindow | null = null;
  private store: StickerStore;
  private getPreloadPath: GetPreloadPathFn;
  private getRendererUrl: GetRendererUrlFn;

  constructor(store: StickerStore, getPreloadPath: GetPreloadPathFn, getRendererUrl: GetRendererUrlFn) {
    this.store = store;
    this.getPreloadPath = getPreloadPath;
    this.getRendererUrl = getRendererUrl;
  }

  /** 创建便签窗口 */
  createStickerWindow(sticker: Sticker): BrowserWindow {
    // 如果窗口已存在，直接显示并聚焦
    const existingWin = this.windows.get(sticker.id);
    if (existingWin && !existingWin.isDestroyed()) {
      existingWin.show();
      existingWin.focus();
      return existingWin;
    }

    const bounds = this.ensureBoundsInScreen(sticker.windowState);

    const win = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      minWidth: 160,
      minHeight: 120,
      frame: false,
      transparent: true,
      resizable: true,
      skipTaskbar: true,
      alwaysOnTop: sticker.isPinned,
      webPreferences: {
        preload: this.getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // 加载便签页面
    win.loadURL(this.getRendererUrl(`id=${sticker.id}`));

    // 窗口关闭时隐藏而非销毁
    win.on('close', (e) => {
      e.preventDefault();
      this.hideStickerWindow(sticker.id);
    });

    // 保存位置（防抖）
    let moveTimer: ReturnType<typeof setTimeout> | null = null;
    const saveBounds = () => {
      if (moveTimer) clearTimeout(moveTimer);
      moveTimer = setTimeout(() => {
        if (!win.isDestroyed()) {
          const b = win.getBounds();
          this.store.saveWindowState(sticker.id, {
            x: b.x, y: b.y, width: b.width, height: b.height,
          });
        }
      }, 300);
    };

    // 贴边：松开鼠标后吸附（100ms 内无新 move 事件才执行）
    let snapTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleSnap = () => {
      if (snapTimer) clearTimeout(snapTimer);
      snapTimer = setTimeout(() => {
        if (!win.isDestroyed()) {
          this.snapToEdge(win, sticker.id);
        }
      }, 100);
    };

    win.on('move', () => {
      saveBounds();
      scheduleSnap();
    });

    win.on('resize', saveBounds);

    this.windows.set(sticker.id, win);
    return win;
  }

  /** 松开鼠标后执行贴边吸附 */
  private snapToEdge(win: BrowserWindow, id: string): void {
    if (win.isDestroyed()) return;
    // 冷却期内不重复吸附（防止 setPosition → move → snap 循环）
    const now = Date.now();
    const lastSnap = this.snapCooldown.get(id) || 0;
    if (now - lastSnap < 300) return;

    const display = screen.getDisplayMatching(win.getBounds());
    const { x: screenX, y: screenY, width: screenW, height: screenH } = display.workArea;
    const bounds = win.getBounds();

    const distTop = Math.abs(bounds.y - screenY);
    const distBottom = Math.abs(bounds.y + bounds.height - (screenY + screenH));
    const distLeft = Math.abs(bounds.x - screenX);
    const distRight = Math.abs(bounds.x + bounds.width - (screenX + screenW));

    let newX = bounds.x;
    let newY = bounds.y;
    let snapped = false;

    // 垂直方向：上边或下边
    if (distTop < EDGE_SNAP_THRESHOLD) {
      newY = screenY;
      snapped = true;
    } else if (distBottom < EDGE_SNAP_THRESHOLD) {
      newY = screenY + screenH - bounds.height;
      snapped = true;
    }

    // 水平方向：左边或右边
    if (distLeft < EDGE_SNAP_THRESHOLD) {
      newX = screenX;
      snapped = true;
    } else if (distRight < EDGE_SNAP_THRESHOLD) {
      newX = screenX + screenW - bounds.width;
      snapped = true;
    }

    // 执行吸附
    if (snapped && (newX !== bounds.x || newY !== bounds.y)) {
      this.snapCooldown.set(id, Date.now());
      win.setPosition(newX, newY, false);
      // 吸附后保存位置
      this.store.saveWindowState(id, {
        x: newX, y: newY, width: bounds.width, height: bounds.height,
      });
    }
  }

  /** 隐藏便签窗口 */
  hideStickerWindow(id: string): void {
    const win = this.windows.get(id);
    if (win && !win.isDestroyed()) {
      win.hide();
    }
    this.store.updateSticker(id, { isVisible: false });
  }

  /** 显示便签窗口 */
  showStickerWindow(id: string): void {
    const sticker = this.store.getStickerById(id);
    if (!sticker) return;

    let win = this.windows.get(id);
    if (!win || win.isDestroyed()) {
      this.store.updateSticker(id, { isVisible: true });
      win = this.createStickerWindow(sticker);
    } else {
      this.store.updateSticker(id, { isVisible: true });
      win.show();
      win.focus();
    }
  }

  /** 关闭并销毁便签窗口 */
  closeStickerWindow(id: string): void {
    const win = this.windows.get(id);
    if (win && !win.isDestroyed()) {
      win.removeAllListeners('close');
      win.close();
    }
    this.windows.delete(id);
    this.snapCooldown.delete(id);
  }

  /** 聚焦便签窗口 */
  focusStickerWindow(id: string): void {
    const win = this.windows.get(id);
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) {
        win.restore();
      }
      win.show();
      win.focus();
    }
  }

  /** 设置便签置顶状态 */
  setStickerAlwaysOnTop(id: string, pinned: boolean): void {
    const win = this.windows.get(id);
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(pinned, 'floating');
    }
    this.store.updateSticker(id, { isPinned: pinned });
  }

  /**
   * 应用来自同步的窗口状态。
   * 只调整已存在的窗口，不创建新窗口、不写 store，避免同步回环和弹窗风暴。
   */
  applyRemoteState(sticker: Sticker): void {
    const win = this.windows.get(sticker.id);
    if (!win || win.isDestroyed()) return;

    if (sticker.deletedAt) {
      this.closeStickerWindow(sticker.id);
      return;
    }

    win.setAlwaysOnTop(sticker.isPinned, 'floating');
    if (sticker.isVisible) {
      win.show();
    } else {
      win.hide();
    }
  }

  /** 创建或显示列表面板窗口 */
  createListPanelWindow(): BrowserWindow {
    if (this.listPanelWindow && !this.listPanelWindow.isDestroyed()) {
      this.listPanelWindow.show();
      this.listPanelWindow.focus();
      return this.listPanelWindow;
    }

    this.listPanelWindow = new BrowserWindow({
      width: 360,
      height: 600,
      minWidth: 320,
      minHeight: 400,
      title: '电脑便签 - 便签列表',
      autoHideMenuBar: true,
      webPreferences: {
        preload: this.getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    this.listPanelWindow.loadURL(this.getRendererUrl('page=list'));

    this.listPanelWindow.on('closed', () => {
      this.listPanelWindow = null;
    });

    return this.listPanelWindow;
  }

  /** 创建或显示设置面板窗口 */
  createSettingsWindow(): BrowserWindow {
    const settingsWin = new BrowserWindow({
      width: 500,
      height: 500,
      minWidth: 400,
      minHeight: 400,
      title: '电脑便签 - 设置',
      resizable: true,
      autoHideMenuBar: true,
      webPreferences: {
        preload: this.getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    settingsWin.loadURL(this.getRendererUrl('page=settings'));
    return settingsWin;
  }

  /** 恢复所有可见便签窗口；用户主动隐藏的状态必须保留 */
  restoreAllWindows(): void {
    const stickers = this.store.getAllStickers();

    if (stickers.length === 0) {
      // 没有任何便签（含已软删除）时创建欢迎便签
      const welcomeSticker = this.store.createSticker({
        content: '<p>欢迎使用电脑便签 ✏️</p><p>拖动便签靠近屏幕边缘会自动贴边吸附</p>',
      });
      this.createStickerWindow(welcomeSticker);
      return;
    }

    stickers
      .filter((sticker) => sticker.isVisible)
      .forEach((sticker) => {
        this.createStickerWindow(sticker);
      });
  }

  /** 确保窗口位置在屏幕可见区域内 */
  private ensureBoundsInScreen(state: WindowState): WindowState {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    let { x, y, width, height } = state;

    if (x + width < 0) x = 0;
    if (y + height < 0) y = 0;
    if (x > screenWidth - 100) x = screenWidth - width;
    if (y > screenHeight - 100) y = screenHeight - height;

    return { x, y, width, height };
  }
}
