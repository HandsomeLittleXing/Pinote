import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels';
import type {
  Sticker,
  StickerColor,
  WindowState,
  AppSettings,
  ExportData,
  ImportMode,
  PreloadAPI,
  SyncStatus,
  SyncDevice,
  PairingCodeResult,
  AIStatus,
  AIAnnotateRequest,
  AIAnnotateResponse,
  AIRewriteRequest,
  AIRewriteResponse,
} from '../shared/types';

const api: PreloadAPI = {
  sticker: {
    create(partial?: Partial<Sticker>): Promise<Sticker> {
      return ipcRenderer.invoke(IPC.STICKER_CREATE, partial);
    },
    getAll(): Promise<Sticker[]> {
      return ipcRenderer.invoke(IPC.STICKER_GET_ALL);
    },
    getById(id: string): Promise<Sticker | null> {
      return ipcRenderer.invoke(IPC.STICKER_GET_BY_ID, id);
    },
    update(id: string, partial: Partial<Sticker>): Promise<Sticker> {
      return ipcRenderer.invoke(IPC.STICKER_UPDATE, id, partial);
    },
    delete(id: string): Promise<void> {
      return ipcRenderer.invoke(IPC.STICKER_DELETE, id);
    },
    toggleVisible(id: string): Promise<Sticker> {
      return ipcRenderer.invoke(IPC.STICKER_TOGGLE_VISIBLE, id);
    },
    togglePin(id: string): Promise<Sticker> {
      return ipcRenderer.invoke(IPC.STICKER_TOGGLE_PIN, id);
    },
    setColor(id: string, color: StickerColor): Promise<Sticker> {
      return ipcRenderer.invoke(IPC.STICKER_SET_COLOR, id, color);
    },
    setOpacity(id: string, opacity: number): Promise<Sticker> {
      return ipcRenderer.invoke(IPC.STICKER_SET_OPACITY, id, opacity);
    },
    setTags(id: string, tags: string[]): Promise<Sticker> {
      return ipcRenderer.invoke(IPC.STICKER_SET_TAGS, id, tags);
    },
    setReminder(id: string, reminder: string | null): Promise<Sticker> {
      return ipcRenderer.invoke(IPC.STICKER_SET_REMINDER, id, reminder);
    },
    onListChanged(callback: () => void): () => void {
      const handler = () => callback();
      ipcRenderer.on(IPC.STICKER_LIST_CHANGED, handler);
      return () => {
        ipcRenderer.removeListener(IPC.STICKER_LIST_CHANGED, handler);
      };
    },
    onChanged(callback: (id: string) => void): () => void {
      const handler = (_event: any, id: string) => callback(id);
      ipcRenderer.on(IPC.STICKER_CHANGED, handler);
      return () => {
        ipcRenderer.removeListener(IPC.STICKER_CHANGED, handler);
      };
    },
    getDeleted(): Promise<Sticker[]> {
      return ipcRenderer.invoke(IPC.STICKER_GET_DELETED);
    },
    restore(id: string): Promise<Sticker> {
      return ipcRenderer.invoke(IPC.STICKER_RESTORE, id);
    },
    focus(id: string): Promise<void> {
      return ipcRenderer.invoke(IPC.STICKER_FOCUS, id);
    },
  },
  window: {
    saveState(state: WindowState): Promise<void> {
      return ipcRenderer.invoke(IPC.WINDOW_SAVE_STATE, state);
    },
    close(): Promise<void> {
      return ipcRenderer.invoke(IPC.WINDOW_CLOSE);
    },
    setCollapsed(collapsed: boolean): Promise<void> {
      return ipcRenderer.invoke(IPC.WINDOW_SET_COLLAPSED, collapsed);
    },
    showCollapsedMenu(): Promise<void> {
      return ipcRenderer.invoke(IPC.WINDOW_SHOW_COLLAPSED_MENU);
    },
    onCollapsedChanged(callback: (collapsed: boolean) => void): () => void {
      const handler = (_event: any, collapsed: boolean) => {
        callback(collapsed);
      };
      ipcRenderer.on(IPC.WINDOW_COLLAPSED_CHANGED, handler);
      return () => {
        ipcRenderer.removeListener(IPC.WINDOW_COLLAPSED_CHANGED, handler);
      };
    },
  },
  settings: {
    get(): Promise<AppSettings> {
      return ipcRenderer.invoke(IPC.SETTINGS_GET);
    },
    set(settings: Partial<AppSettings>): Promise<void> {
      return ipcRenderer.invoke(IPC.SETTINGS_SET, settings);
    },
    onChanged(callback: (settings: AppSettings) => void): () => void {
      const handler = (_event: any, settings: AppSettings) => {
        callback(settings);
      };
      ipcRenderer.on(IPC.SETTINGS_CHANGED, handler);
      return () => {
        ipcRenderer.removeListener(IPC.SETTINGS_CHANGED, handler);
      };
    },
  },
  theme: {
    getCurrent(): Promise<string> {
      return ipcRenderer.invoke(IPC.THEME_GET_CURRENT);
    },
    onChanged(callback: (theme: string) => void): () => void {
      const handler = (_event: any, theme: string) => {
        callback(theme);
      };
      ipcRenderer.on(IPC.THEME_CHANGED, handler);
      return () => {
        ipcRenderer.removeListener(IPC.THEME_CHANGED, handler);
      };
    },
  },
  data: {
    export(): Promise<ExportData> {
      return ipcRenderer.invoke(IPC.DATA_EXPORT);
    },
    import(data: ExportData, mode: ImportMode): Promise<void> {
      return ipcRenderer.invoke(IPC.DATA_IMPORT, data, mode);
    },
  },
  shortcuts: {
    setRecording(recording: boolean): Promise<void> {
      return ipcRenderer.invoke(IPC.SHORTCUTS_SET_RECORDING, recording);
    },
  },
  app: {
    getVersion(): Promise<string> {
      return ipcRenderer.invoke(IPC.APP_GET_VERSION);
    },
  },
  ai: {
    getStatus(): Promise<AIStatus> {
      return ipcRenderer.invoke(IPC.AI_GET_STATUS);
    },
    saveKey(apiKey: string): Promise<AIStatus> {
      return ipcRenderer.invoke(IPC.AI_SAVE_KEY, apiKey);
    },
    testKey(): Promise<void> {
      return ipcRenderer.invoke(IPC.AI_TEST_KEY);
    },
    deleteKey(): Promise<AIStatus> {
      return ipcRenderer.invoke(IPC.AI_DELETE_KEY);
    },
    rewrite(request: AIRewriteRequest): Promise<AIRewriteResponse> {
      return ipcRenderer.invoke(IPC.AI_REWRITE, request);
    },
    annotate(request: AIAnnotateRequest): Promise<AIAnnotateResponse> {
      return ipcRenderer.invoke(IPC.AI_ANNOTATE, request);
    },
  },
  sync: {
    getStatus(): Promise<SyncStatus> {
      return ipcRenderer.invoke(IPC.SYNC_GET_STATUS);
    },
    setEnabled(enabled: boolean): Promise<SyncStatus> {
      return ipcRenderer.invoke(IPC.SYNC_SET_ENABLED, enabled);
    },
    setServerUrl(url: string): Promise<SyncStatus> {
      return ipcRenderer.invoke(IPC.SYNC_SET_SERVER_URL, url);
    },
    createPairingCode(): Promise<PairingCodeResult> {
      return ipcRenderer.invoke(IPC.SYNC_CREATE_PAIRING_CODE);
    },
    listDevices(): Promise<SyncDevice[]> {
      return ipcRenderer.invoke(IPC.SYNC_LIST_DEVICES);
    },
    unlinkDevice(deviceId: string): Promise<void> {
      return ipcRenderer.invoke(IPC.SYNC_UNLINK_DEVICE, deviceId);
    },
    syncNow(): Promise<SyncStatus> {
      return ipcRenderer.invoke(IPC.SYNC_NOW);
    },
    onStatusChanged(callback: (status: SyncStatus) => void): () => void {
      const handler = (_event: any, status: SyncStatus) => {
        callback(status);
      };
      ipcRenderer.on(IPC.SYNC_STATUS_CHANGED, handler);
      return () => {
        ipcRenderer.removeListener(IPC.SYNC_STATUS_CHANGED, handler);
      };
    },
  },
};

contextBridge.exposeInMainWorld('api', api);
