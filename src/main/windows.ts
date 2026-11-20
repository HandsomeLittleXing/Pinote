import { app, BrowserWindow, nativeTheme, screen } from 'electron';
import { join } from 'path';
import type { SkinId, Sticker, WindowState } from '../shared/types';
import type { StickerStore } from './store';
import { IPC } from '../shared/ipc-channels';
import { SKIN_NATIVE_CHROME, normalizeSkinId } from '../shared/skins';

type GetPreloadPathFn = () => string;
type GetRendererUrlFn = (query?: string) => string;

/** 贴边阈值（像素） */
const EDGE_SNAP_THRESHOLD = 25;
/** 收起后的窗口高度（工具栏 30 + 4px 彩条） */
const COLLAPSED_HEIGHT = 34;
/** 展开态最小高度 */
const MIN_EXPANDED_HEIGHT = 120;
/** 最小宽度 */
const MIN_WIDTH = 160;
/** 恢复最大尺寸时使用足够大的值 */
const MAX_WINDOW_SIZE = 10000;
/** 列表/设置窗口标题栏高度 */
const PANEL_OVERLAY_HEIGHT = 40;

/** 便签窗口管理器 */
export class StickerWindowManager {
  private windows: Map<string, BrowserWindow> = new Map();
  private snapCooldown: Map<string, number> = new Map();  // 贴边冷却时间戳
  /** 当前处于收起状态的便签 id（仅会话内） */
  private collapsedIds: Set<string> = new Set();
  /** 收起前的展开高度，用于恢复 */
  private expandedHeights: Map<string, number> = new Map();
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
      minWidth: MIN_WIDTH,
      minHeight: MIN_EXPANDED_HEIGHT,
      frame: false,
      transparent: true,
      icon: this.getIconPath(),
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
          this.persistBounds(sticker.id, win.getBounds());
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

  /**
   * 保存窗口位置。
   * 收起期间保留展开高度，避免把 34px 写回 WindowState。
   */
  private persistBounds(id: string, bounds: WindowState): void {
    const current = this.store.getStickerById(id)?.windowState;
    const isCollapsed = this.collapsedIds.has(id);
    this.store.saveWindowState(id, {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: isCollapsed
        ? this.expandedHeights.get(id) ?? current?.height ?? bounds.height
        : bounds.height,
    });
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
      // 吸附后保存位置（收起时保留展开高度）
      this.persistBounds(id, {
        x: newX,
        y: newY,
        width: bounds.width,
        height: bounds.height,
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

  /**
   * 从列表点击便签：已有窗口直接显示/聚焦（必要时补写可见状态），
   * 窗口不存在（例如恢复已删除便签后）则创建。
   */
  focusOrShowStickerWindow(id: string): void {
    const sticker = this.store.getStickerById(id);
    if (!sticker) return;

    const win = this.windows.get(id);
    if (win && !win.isDestroyed()) {
      if (!sticker.isVisible) {
        this.store.updateSticker(id, { isVisible: true });
      }
      win.show();
      win.focus();
      return;
    }

    this.showStickerWindow(id);
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
    this.collapsedIds.delete(id);
    this.expandedHeights.delete(id);
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

  /**
   * 收起/展开便签窗口。
   * 收起状态只保存在当前会话，应用重启后恢复展开。
   */
  setCollapsed(id: string, collapsed: boolean): void {
    const win = this.windows.get(id);
    if (!win || win.isDestroyed()) return;
    if (this.collapsedIds.has(id) === collapsed) return;

    const bounds = win.getBounds();

    // 先通知渲染层切换内容，再调整窗口尺寸，避免 34px 窗口里闪出编辑器
    win.webContents.send(IPC.WINDOW_COLLAPSED_CHANGED, collapsed);

    if (collapsed) {
      this.expandedHeights.set(id, Math.max(bounds.height, MIN_EXPANDED_HEIGHT));
      this.collapsedIds.add(id);
      win.setMinimumSize(MIN_WIDTH, COLLAPSED_HEIGHT);
      // 锁定高度，允许横向调整
      win.setMaximumSize(MAX_WINDOW_SIZE, COLLAPSED_HEIGHT);
      win.setBounds({ ...bounds, height: COLLAPSED_HEIGHT });
    } else {
      const height = Math.max(
        this.expandedHeights.get(id) ??
          this.store.getStickerById(id)?.windowState.height ??
          200,
        MIN_EXPANDED_HEIGHT
      );
      this.collapsedIds.delete(id);
      win.setMinimumSize(MIN_WIDTH, MIN_EXPANDED_HEIGHT);
      win.setMaximumSize(MAX_WINDOW_SIZE, MAX_WINDOW_SIZE);
      win.setBounds({ ...bounds, height });
      this.expandedHeights.delete(id);
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

  /** 当前有效主题（跟随系统时读取系统状态） */
  getEffectiveTheme(): 'light' | 'dark' {
    const settings = this.store.getSettings();
    if (settings.themeMode === 'system') {
      return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    }
    return settings.themeMode;
  }

  /** 当前皮肤 */
  getEffectiveSkin(): SkinId {
    const skin = this.store.getSettings().skin;
    return normalizeSkinId(skin);
  }

  /** 更新列表/设置窗口的原生标题栏覆盖层颜色 */
  updatePanelWindowChrome(theme: 'light' | 'dark'): void {
    const colors = SKIN_NATIVE_CHROME[this.getEffectiveSkin()][theme];
    BrowserWindow.getAllWindows().forEach((win) => {
      if (win.isDestroyed()) return;
      const url = win.webContents.getURL();
      if (!url.includes('page=list') && !url.includes('page=settings')) return;
      try {
        win.setTitleBarOverlay({
          color: colors.overlayColor,
          symbolColor: colors.symbolColor,
          height: PANEL_OVERLAY_HEIGHT,
        });
        win.setBackgroundColor(colors.backgroundColor);
      } catch (error) {
        console.error('更新标题栏覆盖层失败:', error);
      }
    });
  }

  /** 获取桌面窗口图标路径 */
  private getIconPath(): string {
    return app.isPackaged
      ? join(process.resourcesPath, 'icon.ico')
      : join(__dirname, '../../resources/icon.ico');
  }

  /** 面板窗口的标题栏/底色配置 */
  private getPanelWindowOptions() {
    const colors = SKIN_NATIVE_CHROME[this.getEffectiveSkin()][this.getEffectiveTheme()];
    return {
      icon: this.getIconPath(),
      titleBarStyle: 'hidden' as const,
      titleBarOverlay: {
        color: colors.overlayColor,
        symbolColor: colors.symbolColor,
        height: PANEL_OVERLAY_HEIGHT,
      },
      backgroundColor: colors.backgroundColor,
    };
  }

  /** 创建或显示列表面板窗口 */
  createListPanelWindow(): BrowserWindow {
    if (this.listPanelWindow && !this.listPanelWindow.isDestroyed()) {
      this.listPanelWindow.show();
      this.listPanelWindow.focus();
      return this.listPanelWindow;
    }

    this.listPanelWindow = new BrowserWindow({
      width: 560,
      height: 680,
      minWidth: 420,
      minHeight: 480,
      title: '贴记 - 便签列表',
      ...this.getPanelWindowOptions(),
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
      width: 640,
      height: 640,
      minWidth: 520,
      minHeight: 480,
      title: '贴记 - 设置',
      resizable: true,
      ...this.getPanelWindowOptions(),
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
        content: '<p>欢迎使用贴记 ✏️</p><p>拖动便签靠近屏幕边缘会自动贴边吸附</p>',
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
