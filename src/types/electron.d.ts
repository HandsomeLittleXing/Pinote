declare module 'electron' {
  export class BrowserWindow {
    static getAllWindows(): BrowserWindow[];
    static fromWebContents(webContents: any): BrowserWindow | null;
    constructor(options?: any);
    loadURL(url: string): void;
    on(event: string, listener: (...args: any[]) => void): this;
    once(event: string, listener: (...args: any[]) => void): this;
    removeAllListeners(event?: string): this;
    show(): void;
    hide(): void;
    focus(): void;
    close(): void;
    isDestroyed(): boolean;
    isMinimized(): boolean;
    restore(): void;
    setAlwaysOnTop(flag: boolean, level?: string): void;
    setOpacity(opacity: number): void;
    setPosition(x: number, y: number, animate?: boolean): void;
    getBounds(): { x: number; y: number; width: number; height: number };
    webContents: {
      send(channel: string, ...args: any[]): void;
      getURL(): string;
    };
  }

  export class Tray {
    constructor(image: any);
    setToolTip(toolTip: string): void;
    setContextMenu(menu: Menu): void;
    on(event: string, listener: (...args: any[]) => void): this;
    destroy(): void;
  }

  export class Menu {
    static buildFromTemplate(template: any[]): Menu;
  }

  export class Notification {
    static isSupported(): boolean;
    constructor(options?: any);
    show(): void;
    on(event: string, listener: (...args: any[]) => void): this;
  }

  export const app: {
    isPackaged: boolean;
    getPath(name: string): string;
    whenReady(): Promise<void>;
    on(event: string, listener: (...args: any[]) => void): void;
    quit(): void;
    setLoginItemSettings(settings: any): void;
  };

  export const ipcMain: {
    handle(channel: string, listener: (event: any, ...args: any[]) => any): void;
  };

  export const ipcRenderer: {
    invoke(channel: string, ...args: any[]): Promise<any>;
    on(channel: string, listener: (event: any, ...args: any[]) => void): void;
    removeListener(channel: string, listener: (...args: any[]) => void): void;
  };

  export const contextBridge: {
    exposeInMainWorld(apiKey: string, api: any): void;
  };

  export const nativeTheme: {
    shouldUseDarkColors: boolean;
    on(event: string, listener: (...args: any[]) => void): void;
  };

  export const globalShortcut: {
    register(accelerator: string, callback: () => void): boolean;
    unregisterAll(): void;
  };

  export const nativeImage: {
    createFromPath(path: string): any;
  };

  export const screen: {
    getPrimaryDisplay(): { workAreaSize: { width: number; height: number } };
    getDisplayMatching(bounds: any): { workArea: { x: number; y: number; width: number; height: number } };
  };

  export const dialog: {
    showMessageBox(options: any): Promise<any>;
  };
}
