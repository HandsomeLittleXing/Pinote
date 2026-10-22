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
  STICKER_LIST_CHANGED: 'sticker:list-changed',

  // 窗口状态
  WINDOW_SAVE_STATE: 'window:save-state',
  WINDOW_CLOSE: 'window:close',

  // 设置
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // 全局操作
  LIST_PANEL_OPEN: 'list-panel:open',
  LIST_PANEL_CLOSE: 'list-panel:close',

  // 数据导入导出
  DATA_EXPORT: 'data:export',
  DATA_IMPORT: 'data:import',

  // 主题
  THEME_GET_CURRENT: 'theme:get-current',
  THEME_CHANGED: 'theme:changed',
} as const;
