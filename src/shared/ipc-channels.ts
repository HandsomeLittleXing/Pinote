/** IPC 通道常量 */
export const IPC = {
  // 便签 CRUD
  STICKER_CREATE: 'sticker:create',
  STICKER_GET_ALL: 'sticker:get-all',
  STICKER_GET_BY_ID: 'sticker:get-by-id',
  STICKER_UPDATE: 'sticker:update',
  STICKER_DELETE: 'sticker:delete',
  STICKER_TOGGLE_VISIBLE: 'sticker:toggle-visible',
  STICKER_TOGGLE_PIN: 'sticker:toggle-pin',
  STICKER_SET_COLOR: 'sticker:set-color',
  STICKER_SET_OPACITY: 'sticker:set-opacity',
  STICKER_SET_TAGS: 'sticker:set-tags',
  STICKER_SET_REMINDER: 'sticker:set-reminder',
  STICKER_GET_DELETED: 'sticker:get-deleted',
  STICKER_RESTORE: 'sticker:restore',
  STICKER_FOCUS: 'sticker:focus',
  STICKER_LIST_CHANGED: 'sticker:list-changed',
  STICKER_CHANGED: 'sticker:changed',

  // 窗口状态
  WINDOW_SAVE_STATE: 'window:save-state',
  WINDOW_CLOSE: 'window:close',
  WINDOW_SET_COLLAPSED: 'window:set-collapsed',
  WINDOW_COLLAPSED_CHANGED: 'window:collapsed-changed',
  WINDOW_SHOW_COLLAPSED_MENU: 'window:show-collapsed-menu',

  // 应用信息
  APP_GET_VERSION: 'app:get-version',

  // 设置
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SHORTCUTS_SET_RECORDING: 'shortcuts:set-recording',

  // 全局操作
  LIST_PANEL_OPEN: 'list-panel:open',
  LIST_PANEL_CLOSE: 'list-panel:close',

  // 数据导入导出
  DATA_EXPORT: 'data:export',
  DATA_IMPORT: 'data:import',

  // 主题
  THEME_GET_CURRENT: 'theme:get-current',
  THEME_CHANGED: 'theme:changed',

  // 云同步（手机互通，桌面端连接远程同步服务）
  SYNC_GET_STATUS: 'sync:get-status',
  SYNC_SET_ENABLED: 'sync:set-enabled',
  SYNC_SET_SERVER_URL: 'sync:set-server-url',
  SYNC_CREATE_PAIRING_CODE: 'sync:create-pairing-code',
  SYNC_LIST_DEVICES: 'sync:list-devices',
  SYNC_UNLINK_DEVICE: 'sync:unlink-device',
  SYNC_NOW: 'sync:now',
  SYNC_STATUS_CHANGED: 'sync:status-changed',
} as const;
