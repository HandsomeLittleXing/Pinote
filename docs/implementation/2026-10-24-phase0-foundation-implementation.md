# Phase 0 编码实现文档：设计体系基础与 P0 修复

> 对应设计文档：`docs/design/2026-10-24-phase0-foundation-design.md`
> 上级方案：`docs/UI-REDESIGN-PLAN.md`
> 版本：v1.0 · 日期：2026-10-24 · 状态：待确认

---

## 1. 变更概览

本阶段一次性完成三件事：

1. 引入冷色极简玻璃的全局 token、Tailwind 语义色映射和 8 个基础 UI 组件；
2. 用 Lucide 替换桌面端全部功能类 emoji，并把现有组件的颜色收敛到 token；
3. 修复 7 个 P0：同步默认关闭与移除公网默认地址、单实例锁、启动尊重隐藏状态、便签工具栏不溢出、背景透明度、已打开便签同步刷新、版本号统一。

不修改服务端、移动端、数据库与同步协议；不做便签色板迁移和列表/设置完整改版。

---

## 2. 逐文件清单

### 2.1 新增

| 路径 | 说明 |
|------|------|
| `src/renderer/styles/tokens.css` | 亮/暗两套 CSS 变量 |
| `src/renderer/utils/cn.ts` | `clsx` + `tailwind-merge` |
| `src/renderer/components/ui/Button.tsx` | 按钮 |
| `src/renderer/components/ui/IconButton.tsx` | 图标按钮 |
| `src/renderer/components/ui/Tooltip.tsx` | Tooltip Provider 与封装 |
| `src/renderer/components/ui/DropdownMenu.tsx` | 下拉菜单封装 |
| `src/renderer/components/ui/Popover.tsx` | 浮层封装 |
| `src/renderer/components/ui/Switch.tsx` | 开关 |
| `src/renderer/components/ui/Slider.tsx` | 滑块 |
| `src/renderer/components/ui/Chip.tsx` | 标签 chip |

### 2.2 修改

| 路径 | 说明 |
|------|------|
| `package.json` / `package-lock.json` | 新增前端依赖 |
| `tailwind.config.js` | 语义色、圆角、阴影、缓动映射 |
| `vite.config.ts` | 注入 `__APP_VERSION__` |
| `src/renderer/main.tsx` | 引入 tokens、包裹 TooltipProvider |
| `src/renderer/styles/globals.css` | 底色/文字/滚动条/动效降级 |
| `src/renderer/styles/sticker.css` | 便签工具栏、容器查询、浮层 |
| `src/renderer/hooks/useTheme.ts` | 把 `.dark` 同步到 `<html>` |
| `src/renderer/utils/colors.ts` | 新增 `withAlpha()`、`clampOpacity()` |
| `src/renderer/types/global.d.ts` | 声明 `__APP_VERSION__` |
| `src/renderer/components/StickerEditor.tsx` | 工具栏重构、Popover、背景透明度、同步刷新订阅 |
| `src/renderer/components/Settings.tsx` | 同步开关、版本号、token/图标 |
| `src/renderer/components/StickerList.tsx` | token/图标 |
| `src/renderer/components/StickerListItem.tsx` | token/图标 |
| `src/renderer/components/SearchBar.tsx` | token/图标 |
| `src/renderer/components/TagFilter.tsx` | 改用 Chip、token |
| `src/renderer/components/TagInput.tsx` | token/图标 |
| `src/renderer/components/ReminderPicker.tsx` | token/图标、prop 同步 |
| `src/renderer/components/TransparencySlider.tsx` | 改用 Slider、文案 |
| `src/renderer/components/ColorPicker.tsx` | token |
| `src/renderer/components/ConfirmDialog.tsx` | token |
| `src/shared/types.ts` | `syncEnabled`、`SyncStatus.enabled`、`onChanged`、`setEnabled` |
| `src/shared/ipc-channels.ts` | 新增 `STICKER_CHANGED`、`SYNC_SET_ENABLED` |
| `src/preload/index.ts` | 暴露新 API |
| `src/main/index.ts` | 单实例锁、同步变更驱动窗口、版本 |
| `src/main/sync.ts` | 启用开关、默认地址、变更列表、合并优化 |
| `src/main/ipc-handlers.ts` | 设置联动、变更广播、启用 IPC |
| `src/main/windows.ts` | 移除整窗 opacity、尊重隐藏、远程状态应用 |
| `src/main/tray.ts` | 版本号 |
| `src/types/electron.d.ts` | 单实例与版本 API 类型 |

### 2.3 删除

无文件删除。仅删除 `sticker.css` 中不再使用的 `.toolbar-btn`、`.toolbar-sep`、`.panel-popover` 样式；`ConfirmDialog` 保留到 Phase 2。

---

## 3. 文件职责

| 文件 | 唯一主要职责 | 公开接口 | 直接依赖 |
|------|--------------|----------|----------|
| `tokens.css` | 定义主题变量 | CSS 变量 | 无 |
| `utils/cn.ts` | 合并 className | `cn(...inputs)` | clsx、tailwind-merge |
| `ui/Button.tsx` | 通用按钮展示 | `Button` | cn、React |
| `ui/IconButton.tsx` | 图标按钮展示 | `IconButton` | cn、Tooltip |
| `ui/Tooltip.tsx` | 统一 Tooltip | `TooltipProvider`、`Tooltip` | Radix Tooltip |
| `ui/DropdownMenu.tsx` | 菜单展示 | Root/Trigger/Content/Item/Label/Separator | Radix DropdownMenu |
| `ui/Popover.tsx` | 浮层展示 | Root/Anchor/Trigger/Content | Radix Popover |
| `ui/Switch.tsx` | 开关交互 | `Switch` | React |
| `ui/Slider.tsx` | 滑杆交互 | `Slider` | Radix Slider |
| `ui/Chip.tsx` | 标签 chip | `Chip` | cn、lucide-react |
| `StickerEditor` | 组合编辑体验 | 默认导出组件 | hooks、ui、Lucide |
| `Settings` | 设置展示与提交 | 默认导出组件 | getApi、ui、Lucide |
| `SyncManager` | 同步网络与启用状态 | `start/stop/setEnabled/syncNow/...` | StickerStore、electron-store |
| `StickerWindowManager` | 窗口生命周期 | `create/show/hide/applyRemoteState` | store、screen |
| `IpcHandlerRegistry` | IPC 编排与广播 | `registerAll` | 各主进程服务 |
| `StickerStore` | 本地持久化 | 现有方法 + 默认设置 | electron-store |

职责约束：

- UI 组件不得调用 `getApi()` 或 `ipcRenderer`；
- `SyncManager` 不得操作 `BrowserWindow`；
- `StickerWindowManager` 不得发起网络请求；
- `IpcHandlerRegistry` 只做编排，不实现同步算法。

---

## 4. 项目风格参考

| 参考 | 采用的写法 |
|------|-----------|
| `src/renderer/components/ConfirmDialog.tsx` | 函数组件 + 显式 Props 接口 + `React.FC` |
| `src/renderer/components/StickerListItem.tsx` | `useCallback` 包裹事件、Tailwind 原子类 |
| `src/main/windows.ts` | 类 + 构造函数注入依赖 + 私有方法 |
| `src/main/ipc-handlers.ts` | `registerXxxHandlers()` 分组注册 |
| `src/preload/index.ts` | 按领域暴露 `PreloadAPI`，返回取消订阅函数 |
| `src/shared/types.ts` | 跨进程接口集中定义，含 JSDoc 中文注释 |
| `src/main/sync.ts` | 私有 `request()` 统一鉴权与错误处理 |

新增代码沿用：

- 组件文件 PascalCase，Hook `useXxx.ts`，工具 camelCase；
- 业务注释用中文说明原因，不逐行翻译；
- 主进程异常使用 `console.error('中文动作:', err)`；
- 不引入新的状态管理库。

---

## 5. 复用清单

### 5.1 直接复用

| 能力 | 路径 |
|------|------|
| `getApi()` | `src/renderer/utils/api.ts` |
| `useSticker.reload()` | `src/renderer/hooks/useSticker.ts` |
| 颜色取用 | `src/renderer/utils/colors.ts` |
| 广播 | `src/main/index.ts` |
| 窗口 Map 与生命周期 | `src/main/windows.ts` |
| 设置读写 | `src/main/store.ts` |
| 确认弹窗 | `src/renderer/components/ConfirmDialog.tsx` |

### 5.2 扩展复用

- `AppSettings` 增加 `syncEnabled`；`DEFAULT_SETTINGS` 增加默认值。
- `SyncStatus` 增加 `enabled`；`SyncAPI` 增加 `setEnabled`。
- `StickerAPI` 增加 `onChanged`。
- `SyncManager.onDataChanged` 回传变更数组。
- `StickerWindowManager` 增加 `applyRemoteState`。

### 5.3 不复用

- 不引入 Ant Design / MUI：项目无该依赖，包体与样式冲突成本高。
- 不复制手写 `activePanel` 定位逻辑：Radix Popover 提供外部点击、Esc、焦点管理。
- 不新建第二套便签颜色常量：Phase 1 再迁移色板。
- 不为 Phase 0 提前创建 Dialog/Toast/EmptyState 等未使用组件：避免死代码。

---

## 6. 接口与数据变化

### 6.1 共享类型

`src/shared/types.ts`：

```ts
export interface AppSettings {
  shortcutNew: string;
  shortcutList: string;
  defaultColor: StickerColor;
  themeMode: 'system' | 'light' | 'dark';
  autoStart: boolean;
  /** 是否启用手机同步；默认 false */
  syncEnabled: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  // ...既有字段
  syncEnabled: false,
};

export interface SyncStatus {
  /** 当前是否启用同步 */
  enabled: boolean;
  linked: boolean;
  serverUrl: string;
  pairingServerUrl: string;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface SyncAPI {
  // ...既有方法
  setEnabled(enabled: boolean): Promise<SyncStatus>;
}

export interface StickerAPI {
  // ...既有方法
  onChanged(callback: (id: string) => void): () => void;
}
```

### 6.2 IPC

`src/shared/ipc-channels.ts` 新增：

```ts
STICKER_CHANGED: 'sticker:changed',
SYNC_SET_ENABLED: 'sync:set-enabled',
```

- `STICKER_CHANGED` 载荷：`stickerId: string`。
- `SYNC_SET_ENABLED` 载荷：`enabled: boolean`，返回 `SyncStatus`。

### 6.3 Preload

- `sticker.onChanged(cb)`：监听 `STICKER_CHANGED`，按 id 回调，返回取消订阅。
- `sync.setEnabled(enabled)`：`ipcRenderer.invoke(IPC.SYNC_SET_ENABLED, enabled)`。

### 6.4 主进程内部

```ts
// SyncManager
onDataChanged(listener: (changed: Sticker[]) => void): void;
async setEnabled(enabled: boolean): Promise<SyncStatus>;

// StickerWindowManager
applyRemoteState(sticker: Sticker): void;
```

### 6.5 设置存储兼容

- 存储位置不变：`electron-store` 的 `settings`。
- 新安装：`DEFAULT_SETTINGS.syncEnabled = false`，显式关闭。
- 旧数据：`settings.syncEnabled === undefined` 时，`SyncManager` 按「本地是否有 token」推断：
  - 有 token → 启用（保持原配对）；
  - 无 token → 关闭。
- 不做批量写迁移；用户首次切换开关时才写入布尔值。

### 6.6 数据库

无数据库变更，无 DDL、无迁移、无回滚脚本。

### 6.7 版本注入

- `vite.config.ts` 读取 `package.json` 的 `version`，在 renderer 配置中 `define: { __APP_VERSION__: JSON.stringify(version) }`。
- `src/renderer/types/global.d.ts` 在 `declare global` 内声明 `const __APP_VERSION__: string;`。
- 主进程托盘使用 `app.getVersion()`。

---

## 7. 实现步骤

### 步骤 1：安装依赖

命令：

```bash
npm i lucide-react clsx tailwind-merge \
  @radix-ui/react-dropdown-menu \
  @radix-ui/react-popover \
  @radix-ui/react-tooltip \
  @radix-ui/react-slider
```

完成条件：`package.json`、`package-lock.json` 更新，`npm ls` 无 peer 冲突。

### 步骤 2：设计 token 与暗色挂载

1. 新建 `src/renderer/styles/tokens.css`，按设计文档写入亮/暗变量。
2. `tailwind.config.js`：
   - `colors` 增加 `canvas / surface / muted / line / ink / ink-muted / ink-subtle / accent / accent-hover / danger`；
   - `borderRadius`、`boxShadow`、`transitionTimingFunction` 映射变量；
   - 保留现有 `sticker.*` 颜色，Phase 1 再迁移。
3. `main.tsx`：
   - 先 `import './styles/tokens.css'`，再 `import './styles/globals.css'`；
   - 用 `TooltipProvider` 包裹 `<App />`。
4. `globals.css`：`html/body/#root` 使用 `rgb(var(--bg))`、`rgb(var(--text))`；滚动条、选中色改用 token；增加 `prefers-reduced-motion` 降级。
5. `useTheme.ts`：在 `isDark` 变化时执行
   ```ts
   document.documentElement.classList.toggle('dark', isDark);
   ```
   确保 Radix Portal 到 `body` 的内容也能继承暗色变量。

完成条件：亮/暗切换时 `html` 上的 class 正确；新组件使用 token 类可正常渲染。

### 步骤 3：基础 UI 组件

按第 3 节职责实现：

- `cn.ts`；
- `Button`：`primary / secondary / ghost / danger`，`sm / md / lg`，支持 `loading`；
- `IconButton`：`sm / md`，`active`、`danger` 状态，`aria-label`，可选 Tooltip；
- `Tooltip`：导出 Provider 与封装，内容使用 `bg-ink text-canvas`；
- `DropdownMenu`：Content 使用玻璃样式，Item 支持 `data-[highlighted]`；
- `Popover`：Content 玻璃样式，`sideOffset=8`、`collisionPadding=8`；
- `Switch`：`role="switch"`、`aria-checked`、36×20；
- `Slider`：Radix Root/Track/Range/Thumb，`aria-label`；
- `Chip`：`selected`、可选关闭按钮。

完成条件：`npm run typecheck` 对新增文件无错误。

### 步骤 4：颜色工具与透明度组件

1. `colors.ts` 增加：
   ```ts
   export function withAlpha(hex: string, alpha: number): string;
   export function clampOpacity(opacity: number): number;
   ```
   - `withAlpha` 支持 3/6 位 hex，非法值回退 `rgba(255,255,255,alpha)`；
   - `clampOpacity` 返回 `Math.min(1, Math.max(0.35, opacity))`。
2. `TransparencySlider`：
   - 改用 `Slider`；
   - 显示 `Math.round(Math.min(1, Math.max(0.3, opacity)) * 100)`；
   - 滑杆 `min=30`、`max=100`、`step=5`；
   - 文案「背景不透明度」；
   - 低于 40% 显示「透明度过低可能影响阅读」。

完成条件：旧值 0.2 显示为 30%，背景实际 alpha 为 0.35，正文不透明。

### 步骤 5：共享契约与 preload

1. `src/shared/types.ts` 按 6.1 修改。
2. `src/shared/ipc-channels.ts` 按 6.2 修改。
3. `src/preload/index.ts` 按 6.3 修改。
4. `src/types/electron.d.ts` 增加：
   ```ts
   requestSingleInstanceLock(): boolean;
   getVersion(): string;
   ```

完成条件：TypeScript 能识别新增 API，旧调用不报错。

### 步骤 6：主进程同步启用逻辑

`src/main/sync.ts`：

1. `DEFAULT_SERVER_URL` 改为 `process.env.STICKERNOTE_SERVER_URL ?? ''`。
2. 新增私有 `isEnabled()`：
   ```ts
   const settings = this.store.getSettings() as AppSettings & { syncEnabled?: boolean };
   if (typeof settings.syncEnabled === 'boolean') return settings.syncEnabled;
   return !!this.getCredentials().token;
   ```
3. `getStatus()` 增加 `enabled: this.isEnabled()`。
4. `start()`：
   - 未启用 → `emitStatus()` 后返回；
   - 启用但 `serverUrl` 为空 → 设置 `lastError = '未配置同步服务器地址'`，`emitStatus()` 后返回；
   - 其余保持注册 + 定时循环。
5. 新增 `setEnabled(enabled)`：
   - 关闭：持久化 `syncEnabled: false`，`stop()`，`emitStatus()`，返回状态；
   - 开启：地址为空抛 `请先填写同步服务器地址`；持久化 `true`；无 token 则注册；启动循环；失败时记录 `lastError` 并抛出。
6. `setServerUrl()`：保存凭证后，仅在启用状态下注册并启动循环。
7. `syncNow()`：未启用或地址为空时直接返回状态，不发请求。
8. `createPairingCode()`：未启用时抛 `请先开启手机同步`。
9. `listDevices()`：未启用返回 `[]`。
10. `runSync()`：
    - 未启用或地址为空时返回；
    - 响应返回后再次检查 `isEnabled()`，关闭状态下不应用变更；
    - `applyServerChanges()` 改为一次性建立本地 `Map`，返回实际写入的 `Sticker[]`；
    - 有变更时调用 `dataChangedListener?.(changed)`。
11. `onDataChanged` 类型改为 `(changed: Sticker[]) => void`。

完成条件：新安装无网络请求；旧 token 配置保持启用；关闭后定时器停止。

### 步骤 7：主进程设置联动与广播

`src/main/ipc-handlers.ts`：

1. `SETTINGS_SET`：
   - 先计算 `newSettings = { ...oldSettings, ...settings }`；
   - 仅当 `settings` 中显式包含布尔 `syncEnabled` 且与 `syncManager.getStatus().enabled` 不同，先 `await syncManager.setEnabled(newSettings.syncEnabled)`；
   - 之后再持久化其余设置、处理快捷键/自启动/托盘。
   - 这样开启失败（地址为空/注册失败）时不会部分保存。
2. 新增 `SYNC_SET_ENABLED` 处理器：调用 `syncManager.setEnabled`，广播 `SYNC_STATUS_CHANGED`，返回状态。
3. 便签变更处理器统一广播：
   - `STICKER_UPDATE`、`STICKER_SET_COLOR`、`STICKER_SET_OPACITY`、`STICKER_SET_TAGS`、`STICKER_SET_REMINDER`、`STICKER_TOGGLE_PIN`、`STICKER_TOGGLE_VISIBLE`：
     - 广播 `STICKER_LIST_CHANGED`；
     - 广播 `STICKER_CHANGED, id`。
   - `STICKER_SET_OPACITY` 改为直接 `store.updateSticker(id, { opacity })`，不再经窗口管理器。
4. `STICKER_DELETE` 保持关闭窗口 + 列表刷新。

完成条件：编辑器自更新后收到自己广播也不会循环；列表在换色/标签/提醒后同步刷新。

### 步骤 8：窗口管理

`src/main/windows.ts`：

1. `createStickerWindow` 删除 `opacity: sticker.opacity`。
2. 删除 `setStickerOpacity()` 方法及 `win.setOpacity()` 调用。
3. `restoreAllWindows()` 删除「全部隐藏则强制显示」分支：
   ```ts
   const stickers = this.store.getAllStickers();
   if (stickers.length === 0) { /* 欢迎便签 */ return; }
   stickers.filter((s) => s.isVisible).forEach((s) => this.createStickerWindow(s));
   ```
4. 新增：
   ```ts
   applyRemoteState(sticker: Sticker): void {
     const win = this.windows.get(sticker.id);
     if (!win || win.isDestroyed()) return;
     if (sticker.deletedAt) { this.closeStickerWindow(sticker.id); return; }
     win.setAlwaysOnTop(sticker.isPinned, 'floating');
     if (sticker.isVisible) win.show(); else win.hide();
   }
   ```
   - 不创建新窗口、不写 store、不聚焦。

完成条件：远程可见状态只作用于已有窗口；远程删除关闭窗口；置顶不刷新 `updatedAt`。

### 步骤 9：主进程装配与单实例

`src/main/index.ts`：

1. 在模块顶层：
   ```ts
   const gotLock = app.requestSingleInstanceLock();
   if (!gotLock) {
     app.quit();
   } else {
     app.on('second-instance', () => {
       windowManager?.createListPanelWindow();
     });
     app.whenReady().then(() => { /* 现有初始化 */ });
   }
   ```
   - 未获得锁时不注册 `whenReady` 初始化。
2. `syncManager.onDataChanged((changed) => {...})`：
   - 广播 `STICKER_LIST_CHANGED`；
   - 遍历变更：
     - 删除：取消提醒、关闭窗口；
     - 否则：`windowManager.applyRemoteState(sticker)`；
     - 提醒：有效则 `scheduleReminder`，否则 `cancelReminder`；
     - 广播 `STICKER_CHANGED, sticker.id`。
3. 保持 `syncManager.start()` 在监听注册之后调用。

完成条件：第二次启动退出；远程变更驱动窗口显隐/关闭。

### 步骤 10：托盘与版本

1. `tray.ts` 中 `电脑便签 v1.1.0` 改为 `电脑便签 v${app.getVersion()}`。
2. `vite.config.ts` 注入 `__APP_VERSION__`。
3. `global.d.ts` 在 `declare global` 内声明 `const __APP_VERSION__: string;`。
4. `Settings.tsx` 关于区使用 `v{__APP_VERSION__}`。

完成条件：设置页与托盘版本一致，均来自 `package.json`。

### 步骤 11：便签编辑器重构

`StickerEditor.tsx`：

1. 状态：
   - `activePanel: 'color' | 'opacity' | 'tags' | 'reminder' | 'fontColor' | null`；
   - 删除 `showFontColor`。
2. 背景：
   ```ts
   const bgColor = getBackgroundColor(sticker.color, isDark);
   const alpha = clampOpacity(sticker.opacity);
   style={{ backgroundColor: withAlpha(bgColor, alpha), color: txtColor }}
   ```
3. 标题栏：
   - 常驻：拖拽点 `GripVertical`、`⋯`（`Ellipsis`）、`✕`；
   - `toolbar-optional` 组：`Bold`、`Italic`、`ListChecks`、`Bell`，仅在工具栏 hover/focus 且宽度 ≥240px 时显示；
   - 宽度 <240px 由 CSS 容器查询隐藏 optional 组。
4. `⋯` 使用 `DropdownMenu`：
   - 格式：加粗、斜体、无序、有序、待办、撤销、重做；
   - 便签：字体颜色、换色、标签、提醒、置顶/取消置顶、背景不透明度；
   - 底部：隐藏便签；
   - 每项使用 Lucide 图标，当前激活项右侧显示 `Check`；
   - 命令执行前 `editor.chain().focus()`。
5. 颜色/透明度/标签/提醒/字体颜色统一放入一个受控 `Popover`：
   - `Popover.Anchor` 放在右侧工具栏；
   - `open={activePanel !== null}`；
   - `onOpenChange(false)` 时清空；
   - 内容按 `activePanel` 渲染现有子组件或字体色板。
6. 同步刷新：
   ```ts
   useEffect(() => {
     return getApi().sticker.onChanged((id) => {
       if (id !== stickerId || editor?.isFocused) return;
       reload();
     });
   }, [stickerId, editor, reload]);
   ```
   - 正在输入时不覆盖内容，避免打断（冲突处理留到 Phase 3）。
7. 加载态改用 token + 旋转图标。

完成条件：160px 宽无裁切；所有原功能可通过菜单访问；浮层可外部点击/Esc 关闭。

### 步骤 12：其余渲染组件 token 与图标

逐文件替换：

- `StickerList`：`NotebookPen` / `Plus` / `StickyNote`；`Button` 新建；空状态图标；token 类。
- `StickerListItem`：`Pin`、`Eye/EyeOff`、`Trash2`、`Bell`；色块字母使用 `getTextColor(sticker.color, false)`；token 类。
- `SearchBar`：`Search`、`X`；token 类。
- `TagFilter`：改用 `Chip`；token 类。
- `TagInput`：`X`、`Plus`；token 类。
- `ReminderPicker`：`Bell`；新增 `useEffect` 在 `reminder` prop 变化时同步 `dateValue/timeValue`；token 类。
- `ColorPicker`：token 类，保留色点样式。
- `ConfirmDialog`：token 类，行为不变。
- `Settings`：
  - 区块图标：`Keyboard`、`Palette`、`SunMoon`、`Rocket`、`Database`、`Smartphone`；
  - 主题：`Monitor`、`Sun`、`Moon`；
  - 数据：`Download`、`Upload`；
  - 自动启动与同步启用使用 `Switch`；
  - 保存/取消使用 `Button`；
  - token 类。

完成条件：功能类 emoji 清零；亮/暗色无突兀硬编码色。

### 步骤 13：设置页同步开关

`Settings.tsx`：

1. 计算有效值：
   ```ts
   const syncEnabledValue =
     'syncEnabled' in pendingSettings
       ? !!pendingSettings.syncEnabled
       : (settings as AppSettings & { syncEnabled?: boolean })?.syncEnabled ??
         syncStatus?.enabled ??
         false;
   ```
2. 在「手机同步」区块顶部增加 Switch + 说明「关闭后不发起任何网络请求」。
3. 服务器地址配置在关闭时仍可编辑并「应用」，方便先配地址再开启。
4. 关闭时隐藏：立即同步、生成配对码、二维码、设备列表；状态显示「未启用」。
5. 开启且地址为空时，保存会失败并在页头显示内联错误 `settingsError`。
6. `handleSave` 捕获错误并设置 `settingsError`；成功时清空。
7. 保存按钮与取消按钮改用 `Button`；保存失败时不更新本地 `settings` 状态。

完成条件：新安装显示关闭；开启未填地址时保存报错且不落库；关闭后无任何同步请求。

### 步骤 14：样式收尾

`sticker.css`：

- `.sticker-window` 增加 `container-type: inline-size;`；
- `.unified-toolbar` 高度 30px、玻璃背景、16px blur；
- `.toolbar-optional` 默认 `display:none`，工具栏 hover/focus 时 `inline-flex`；
- `@container (max-width: 239px)` 强制隐藏 `.toolbar-optional`；
- 删除 `.toolbar-btn`、`.toolbar-sep`、`.panel-popover`；
- 保留 `.color-picker`、`.color-dot`、编辑器排版、待办样式；
- 暗色工具栏背景保持半透明黑。

完成条件：容器查询在 160px 窗口生效；无明显样式冲突。

---

## 8. 测试用例

| # | 类型 | 输入/动作 | 预期 |
|---|------|-----------|------|
| 1 | 正常 | 全新配置启动，未开启同步 | 无 `/devices/register`、`/sync` 请求；状态「未启用」 |
| 2 | 边界 | 旧配置有 token、无 `syncEnabled` 字段 | `getStatus().enabled === true`，继续同步 |
| 3 | 边界 | 旧配置无 token、无字段 | 视为关闭 |
| 4 | 异常 | 开启同步但地址为空 | 保存失败，提示「请先填写同步服务器地址」，设置不落库 |
| 5 | 正常 | 填写合法地址并开启 | 注册成功，状态「已连接」，开始定时同步 |
| 6 | 正常 | 关闭同步 | 定时器停止；token 与地址保留；再次开启可复用 |
| 7 | 正常 | 启动第二个实例 | 第二实例退出，第一实例打开列表窗口 |
| 8 | 正常 | 隐藏全部便签后重启 | 不创建任何便签窗口，托盘存在 |
| 9 | 边界 | 无便签 / 全部软删除 | 创建欢迎便签 |
| 10 | 边界 | 窗口拖到 160px 宽 | 仅拖拽点、`⋯`、`✕`；菜单包含全部操作 |
| 11 | 边界 | 旧 opacity=0.2 | 滑杆显示 30%，背景 alpha 0.35，正文不透明 |
| 12 | 正常 | 便签窗口设为 30% 背景不透明度 | 文字清晰可读，背景透出桌面 |
| 13 | 正常 | 手机修改已打开便签内容 | 30 秒内桌面内容刷新 |
| 14 | 正常 | 手机删除已打开便签 | 桌面窗口关闭，提醒取消 |
| 15 | 正常 | 手机隐藏已打开便签 | 桌面窗口隐藏，不新建窗口 |
| 16 | 正常 | 手机置顶已打开便签 | 窗口置顶；本地 `updatedAt` 不变，不产生同步回环 |
| 17 | 边界 | 远程设为可见但本机无窗口 | 不自动弹窗；从列表打开后正常显示 |
| 18 | 正常 | 编辑器内换色/加标签/设提醒 | 列表同步刷新；编辑器不闪烁、不循环保存 |
| 19 | 正常 | 亮/暗主题切换后打开菜单与 Tooltip | 浮层颜色随主题变化（html.dark 生效） |
| 20 | 正常 | 查看设置关于区与托盘关于 | 版本号一致且等于 `package.json` |

---

## 9. 验证命令

在 `D:\personal\sticker\sticker-note-main` 执行：

```bash
npm install
npm run typecheck
npx electron-vite build
```

预期：

- `npm install` 成功，无 peer dependency 冲突；
- `typecheck` 无输出、退出码 0；
- `electron-vite build` 成功生成 `out/main/index.js`、`out/preload/index.js`、`out/renderer/index.html`。

手动运行：

```bash
npm run dev
```

按第 8 节逐项验证。项目当前无测试框架与 lint 脚本，本阶段不新增；若命令因环境原因无法执行，将记录阻塞原因、已完成检查与剩余风险，不宣称验证完成。

---

## 10. 文档一致性

| 设计文档章节 | 实现步骤 |
|--------------|----------|
| 5.1 设计基础 | 步骤 2、3 |
| 5.2 图标替换 | 步骤 11、12 |
| 5.3 同步开关 | 步骤 5、6、7、13 |
| 5.4 单实例 | 步骤 9 |
| 5.5 启动可见性 | 步骤 8 |
| 5.6 工具栏溢出 | 步骤 11、14 |
| 5.7 背景透明度 | 步骤 4、8、11 |
| 5.8 同步刷新 | 步骤 5、6、7、9、11 |
| 5.9 版本号 | 步骤 10 |
| 6 职责边界 | 第 3 节 |
| 7 接口与数据 | 第 6 节 |
| 8 边界与异常 | 第 8 节测试用例 |
| 9 风险与兼容 | 第 11 节 |

需要说明的实现细节（不改变已确认行为）：

1. `.dark` 挂到 `<html>`：让 Radix Portal 到 `body` 的菜单/浮层也能继承暗色变量。
2. 同步关闭时仍显示服务器地址配置，便于先「应用」地址再开启；「立即同步/配对/设备」隐藏。
3. 滑杆显示 30%–100%，渲染层 clamp 到 0.35；30% 与 35% 的视觉差异可忽略。
4. Phase 0 只创建会被立即使用的 UI 组件，其余组件按首次使用时机在 Phase 2 补齐（设计文档已确认）。

---

## 11. 风险与回滚

| 风险 | 应对 |
|------|------|
| Radix 与 React 18 版本冲突 | `npm ls` 检查；按需降级到兼容版本 |
| Tooltip 与 DropdownMenu 触发器的嵌套 `asChild` | 先用一个工具栏按钮验证；失败则触发器改用原生 `title`，不影响菜单功能 |
| 容器查询在最小窗口下失效 | 常驻菜单已覆盖全部操作，功能不受影响 |
| 移除整窗 opacity 后观感变化 | 背景 alpha 可调；正文更清晰；回退只需恢复 `win.setOpacity` 与窗口选项 |
| 同步启用联动导致设置部分保存 | 先 `setEnabled` 再 `store.setSettings`；失败即中止 |
| 广播回环 | 只广播 id；远程窗口状态不写 store；编辑器内容比较守卫 |
| 无自动化测试 | 以 typecheck + build + 20 项手动清单为准，不宣称自动化验证 |

**回滚顺序**：

1. 恢复 `src/main/windows.ts` 的 opacity 与启动恢复逻辑；
2. 恢复 `src/main/index.ts` 的同步启动与单实例；
3. 恢复 `SyncManager` 与设置字段；
4. 最后回退渲染层组件与 token（不影响数据）。

数据库与服务端无改动，无需数据回滚。

---

## 12. 确认项

请确认以下实现范围与验证方式：

1. 新增依赖：`lucide-react`、`clsx`、`tailwind-merge`、Radix 的 DropdownMenu/Popover/Tooltip/Slider。
2. 变更文件共 40 个（新增 10 个，修改 30 个），无删除文件。
3. 不改服务端、移动端、数据库、同步协议。
4. 验证以 `npm install` + `npm run typecheck` + `npx electron-vite build` + `npm run dev` 手动清单为准。
5. 同步开启采用「先应用服务器地址，再保存设置」的流程。

确认后我将按步骤 1–14 实施并运行验证命令。

---

## 13. 验证记录（2026-10-24）

### 13.1 静态与构建

- `npm run typecheck`：通过（退出码 0）。
- `npx electron-vite build`：通过；`out/main/index.js`、`out/preload/index.js`、`out/renderer/index.html` 均生成。
- 构建告警：Radix / Lucide 的 `"use client"` 指令在打包时被忽略，无运行时影响。
- 最终依赖：`lucide-react`、`clsx`、`tailwind-merge`、Radix DropdownMenu / Popover / Tooltip / Slider。测试用的 `playwright-core` 已在验证后移除。

### 13.2 隔离环境 UI 冒烟

使用独立 app name / userData 的临时 Electron 实例 + Playwright CDP 驱动，未使用项目真实便签数据：

| 检查项 | 结果 |
|--------|------|
| 欢迎便签正文 | 正常显示 |
| 工具栏可选按钮 | 240px 悬停 `display: flex`；160px 容器查询 `display: none` |
| 下拉菜单 / 换色浮层 | 正常渲染，外部点击与 Esc 可关闭 |
| 便签列表 | 正常渲染，标题/搜索/卡片 token 生效 |
| 设置页 | 正常渲染，版本号显示 `v1.1.0`（来自 `__APP_VERSION__`） |
| 同步默认状态 | `stickernote-sync.json` 中 `serverUrl: ""`、`token: null`，无注册请求 |
| 同步开关 | 关闭 → 开启后显示「待保存」；空地址保存失败，提示「请先填写同步服务器地址」，无部分落库 |
| 暗色模式 | `<html class="dark">`，`body` 背景为透明，浮层随主题变色 |
| 单实例 | 第二个进程退出码 0 |
| 启动可见性 | 隐藏唯一便签后重启，页面目标数为 0 |
| 背景透明度 | opacity=0.2 → `rgba(255,249,196,0.35)`；文字 `rgb(51,51,51)` 不透明；opacity=1 → 不透明 |

### 13.3 受控快速修复

验证过程中发现 `StickerCreator` 忽略 `partial.content`，导致欢迎便签正文为空。已在 `src/main/store.ts` 最小修复为 `content: partial?.content ?? ''`，并重新通过 typecheck / build / UI 冒烟。该修复不改变接口、数据结构或业务规则。

### 13.4 未运行时验证

- 真实后端下的同步开启、远程修改/删除驱动窗口刷新（需要部署服务端）。
- 托盘菜单点击与通知交互。
- Windows 原生 acrylic（Phase 1 可选 spike）。
- 实际安装包（NSIS）打包与升级。
