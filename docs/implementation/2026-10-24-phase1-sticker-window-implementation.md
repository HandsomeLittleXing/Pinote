# Phase 1 编码实现文档：便签窗口冷色玻璃与收起展开

> 对应设计文档：`docs/design/2026-10-24-phase1-sticker-window-design.md`
> 前置提交：`df76b3d`（Phase 0）
> 版本：v1.0 · 日期：2026-10-24 · 状态：待确认

---

## 1. 变更概览

本阶段完成：

1. 新增共享冷色板与旧色映射，主进程新建便签时归一化，渲染层兼容旧值。
2. 便签窗口改为冷色亮/暗背景与文字，增加顶部高光、发丝边、内阴影和工具栏磨砂。
3. 便签可收起为 34px 彩条、再展开；收起期间保留展开高度，状态只在当前会话有效。
4. 收起态通过原生 Electron Menu 提供「展开 / 置顶 / 隐藏」，避免 34px 窗口裁切 Radix 浮层。
5. 菜单增加字号入口（12/14/16/20/24/默认），复用现有 Tiptap FontSize 扩展。
6. 右下角增加 resize 提示；工具栏按钮统一 24px，保证 160/240px 宽不溢出。

不改服务端、移动端、数据库、同步协议；不改 `WindowState`。

---

## 2. 逐文件清单

### 2.1 新增

| 路径 | 说明 |
|------|------|
| `src/shared/palette.ts` | 冷色板、旧色映射、`resolveStickerColor` / `normalizeStickerColor` |

### 2.2 修改

| 路径 | 说明 |
|------|------|
| `src/shared/types.ts` | `StickerColor` 扩展、`ColorTheme` 增加 `key/darkTextColor`、默认色、`WindowAPI` |
| `src/shared/ipc-channels.ts` | 新增收起/收起菜单/收起状态事件通道 |
| `src/preload/index.ts` | 暴露 `setCollapsed` / `showCollapsedMenu` / `onCollapsedChanged` |
| `src/types/electron.d.ts` | `BrowserWindow.setMinimumSize/setBounds`、`Menu.popup` |
| `src/main/store.ts` | 新建便签时 `normalizeStickerColor` |
| `src/main/windows.ts` | 会话内收起状态、高度记忆、`saveBounds` 保护展开高度、清理 |
| `src/main/ipc-handlers.ts` | 收起 IPC、原生收起菜单、窗口上下文 helper |
| `src/renderer/utils/colors.ts` | 由共享色板派生 `COLOR_THEMES`、解析亮/暗文字 |
| `src/renderer/components/ColorPicker.tsx` | 旧色选中判断、暗色色点 |
| `src/renderer/components/Settings.tsx` | 默认色暗色圆点、旧色选中判断 |
| `src/renderer/components/StickerList.tsx` | 取一次 `isDark` 并传给列表项 |
| `src/renderer/components/StickerListItem.tsx` | 接收 `isDark`，色块使用当前模式色板 |
| `src/renderer/components/StickerEditor.tsx` | 收起/展开、原生收起菜单、字号面板、24px 工具栏、resize 提示 |
| `src/renderer/styles/sticker.css` | 玻璃高光/发丝边/内阴影、收起态、resize 提示 |

### 2.3 删除

无文件删除。

---

## 3. 文件职责

| 文件 | 唯一主要职责 | 公开接口 | 直接依赖 |
|------|--------------|----------|----------|
| `shared/palette.ts` | 色板数据与旧值解析 | `STICKER_PALETTE`、`LEGACY_COLOR_MAP`、`resolveStickerColor`、`normalizeStickerColor` | `shared/types` |
| `renderer/utils/colors.ts` | 把色板解析为渲染色 | `COLOR_THEMES`、`getColorTheme`、`getBackgroundColor`、`getTextColor`、`withAlpha`、`clampOpacity` | shared/palette |
| `StickerWindowManager` | 窗口尺寸与收起记忆 | `setCollapsed(id, collapsed)` | store、IPC、shared/types |
| `IpcHandlerRegistry` | 收起 IPC 与原生菜单编排 | `registerAll` | windowManager、store、Menu |
| `StickerEditor` | 便签 UI 与用户交互 | 默认导出组件 | hooks、ui、Lucide、extensions |
| `Store` | 新建便签颜色归一化 | `createSticker` | shared/palette |

约束：

- `shared/palette.ts` 不依赖 Electron 或 React。
- `renderer/utils/colors.ts` 不读写存储。
- `StickerWindowManager` 不构建菜单；菜单在 IPC 层。
- 收起状态不进入 `WindowState` 或同步数据。

---

## 4. 项目风格参考

| 参考 | 采用的写法 |
|------|-----------|
| `src/renderer/utils/colors.ts` | 纯函数、中文注释、显式返回类型 |
| `src/main/windows.ts` | 类 + 私有 Map/Set + 构造函数注入 |
| `src/main/ipc-handlers.ts` | `registerXxxHandlers()` 分组、`broadcast` |
| `src/preload/index.ts` | 领域 API + 返回取消订阅函数 |
| `src/renderer/components/StickerEditor.tsx` | `useCallback`、Lucide、Radix 组件封装 |
| `src/renderer/styles/sticker.css` | 便签窗口专用样式、`.dark` 覆盖 |

注释使用中文说明业务原因；不为显而易见的赋值加注释。

---

## 5. 复用清单

### 5.1 直接复用

- `withAlpha`、`clampOpacity`：`src/renderer/utils/colors.ts`
- `IconButton`、`Tooltip`、`DropdownMenu`、`Popover`：`src/renderer/components/ui/*`
- `FontSize`、`FONT_SIZES`：`src/renderer/extensions/index.ts`
- `useTheme`：`src/renderer/hooks/useTheme.ts`
- 窗口 Map、贴边、`setStickerAlwaysOnTop`：`src/main/windows.ts`
- `Menu.buildFromTemplate`：`src/main/tray.ts` 已验证的 Electron 用法

### 5.2 扩展复用

- `ColorTheme` 增加 `key` 与 `darkTextColor`。
- `StickerColor` 增加新冷色，保留旧色。
- `WindowAPI` 增加收起相关方法。
- `StickerList` 向下传 `isDark`，避免每个列表项各自订阅主题。
- `StickerEditor` 增加 `'fontSize'` 面板类型与收起分支。

### 5.3 不复用

- 不新增色板常量副本：统一走 `shared/palette.ts`。
- 不在收起态使用 Radix 菜单：34px 窗口会裁切浮层，改用原生 Menu。
- 不把字号做成 Radix Submenu：240px 窗口内主子菜单并排空间不足，改用 Popover 面板。
- 不给便签窗口加外边距做外部阴影：会改变窗口几何与收起高度；改用内阴影/高光。

---

## 6. 接口与数据变化

### 6.1 色板

`src/shared/types.ts`：

```ts
export type StickerColor =
  | '#DFECFB' | '#DCEDF3' | '#DFF2EC' | '#F5E6ED'
  | '#E6EEE3' | '#EAE5F8' | '#FFFFFF' | '#ECEFF4'
  | '#FFF9C4' | '#BBDEFB' | '#C8E6C9' | '#F8BBD0'
  | '#FFE0B2' | '#E1BEE7' | '#E0E0E0';

export interface ColorTheme {
  key: string;
  name: string;
  color: StickerColor;
  darkColor: string;
  textColor: string;
  darkTextColor: string;
}

export const DEFAULT_SETTINGS = {
  // ...
  defaultColor: '#DFECFB',
};
```

`src/shared/palette.ts`：

```ts
export const STICKER_PALETTE: ColorTheme[];
export const LEGACY_COLOR_MAP: Record<string, StickerColor>;
export function resolveStickerColor(color: StickerColor): ColorTheme;
export function normalizeStickerColor(color: StickerColor): StickerColor;
```

- 旧值映射：`#FFF9C4→#DFECFB`、`#BBDEFB→#DCEDF3`、`#C8E6C9→#DFF2EC`、`#F8BBD0→#F5E6ED`、`#FFE0B2→#E6EEE3`、`#E1BEE7→#EAE5F8`、`#FFFFFF→#FFFFFF`、`#E0E0E0→#ECEFF4`。
- 未知值回退 `ice`。

### 6.2 窗口 API

`src/shared/types.ts`：

```ts
export interface WindowAPI {
  saveState(state: WindowState): Promise<void>;
  close(): Promise<void>;
  setCollapsed(collapsed: boolean): Promise<void>;
  showCollapsedMenu(): Promise<void>;
  onCollapsedChanged(callback: (collapsed: boolean) => void): () => void;
}
```

新增 IPC：

```ts
WINDOW_SET_COLLAPSED: 'window:set-collapsed',
WINDOW_COLLAPSED_CHANGED: 'window:collapsed-changed',
WINDOW_SHOW_COLLAPSED_MENU: 'window:show-collapsed-menu',
```

- `setCollapsed`：渲染层请求收起/展开。
- `onCollapsedChanged`：主进程在收起状态实际变化后通知渲染层（原生菜单展开也走这条）。
- `showCollapsedMenu`：在收起态弹出原生菜单。

### 6.3 主进程

```ts
// StickerWindowManager
setCollapsed(id: string, collapsed: boolean): void;
```

常量：

```ts
const MIN_WIDTH = 160;
const MIN_EXPANDED_HEIGHT = 120;
const COLLAPSED_HEIGHT = 34;
```

内部状态：

```ts
private collapsedIds = new Set<string>();
private expandedHeights = new Map<string, number>();
```

### 6.4 数据库与同步

- 无数据库变更。
- 无 `WindowState` 字段变更。
- 收起状态不写 store、不参与同步。
- 颜色仍以 hex 字符串同步；旧值由客户端解析，无需服务端迁移。
- 移动端不改；新 hex 作为背景色可正常渲染，取色器选中态留到 Phase 3。

---

## 7. 实现步骤

### 步骤 1：共享色板

1. 新建 `src/shared/palette.ts`，写入 8 个 `ColorTheme` 与旧值映射。
2. 实现 `resolveStickerColor`：
   - 新值直接查表；
   - 旧值走 `LEGACY_COLOR_MAP`；
   - 未知值返回 `ice`。
3. 实现 `normalizeStickerColor`，返回解析后的新 hex。
4. `src/shared/types.ts`：
   - 扩展 `StickerColor`；
   - `ColorTheme` 增加 `key`、`darkTextColor`；
   - `DEFAULT_SETTINGS.defaultColor = '#DFECFB'`。

完成条件：类型检查通过；旧/新色值都能解析。

### 步骤 2：渲染层颜色

1. `src/renderer/utils/colors.ts`：
   - `COLOR_THEMES` 改为 `STICKER_PALETTE`；
   - `getColorTheme` 使用 `resolveStickerColor`；
   - `getBackgroundColor` 返回 `darkColor/color`；
   - `getTextColor` 返回 `darkTextColor/textColor`（暗色不再固定 `#e0e0e0`）。
2. `ColorPicker`：
   - 选中判断：`resolveStickerColor(currentColor).color === theme.color`；
   - 色点背景：`getBackgroundColor(theme.color, isDark)`。
3. `Settings`：
   - 调用 `useTheme()`；
   - 默认色选中判断按解析后的值；
   - 圆点背景使用 `getBackgroundColor(theme.color, isDark)`。
4. `StickerList`：
   - 调用 `useTheme()` 一次；
   - 把 `isDark` 传给每个 `StickerListItem`。
5. `StickerListItem`：
   - Props 增加 `isDark: boolean`；
   - 色块使用 `getBackgroundColor(sticker.color, isDark)` 与 `getTextColor(sticker.color, isDark)`。
6. `src/main/store.ts`：
   - `createSticker` 的 `color` 改为 `normalizeStickerColor(partial?.color ?? settings.defaultColor)`。

完成条件：旧便签按新色渲染；新建便签写入新 hex；亮/暗色块正确。

### 步骤 3：窗口收起能力

1. `src/shared/types.ts`：`WindowAPI` 增加 3 个方法。
2. `src/shared/ipc-channels.ts`：增加 3 个通道。
3. `src/types/electron.d.ts`：
   - `BrowserWindow.setMinimumSize(width, height)`；
   - `BrowserWindow.setBounds(bounds)`；
   - `Menu.popup({ window })`。
4. `src/preload/index.ts`：
   - `setCollapsed` invoke；
   - `showCollapsedMenu` invoke；
   - `onCollapsedChanged` 监听 `WINDOW_COLLAPSED_CHANGED`。
5. `src/main/windows.ts`：
   - 增加常量与 `collapsedIds` / `expandedHeights`；
   - `setCollapsed(id, collapsed)`：
     - 收起：记录当前高度 → 加 Set → `setMinimumSize(160, 34)` → `setBounds(height=34)`；
     - 展开：取回高度（缺省 200，最小 120）→ 删 Set → `setMinimumSize(160, 120)` → `setBounds(height)`；
     - 状态实际变化后 `win.webContents.send(WINDOW_COLLAPSED_CHANGED, collapsed)`。
   - `saveBounds`：
     - 收起期间高度使用 `expandedHeights.get(id) ?? current.height ?? bounds.height`；
     - 非收起使用当前高度；
     - x/y/width 始终保存。
   - `closeStickerWindow` 清理两个集合。
6. `src/main/ipc-handlers.ts`：
   - 新增 `getWindowContext(event)` 返回 `{ win, id }`，替换 `WINDOW_SAVE_STATE` / `WINDOW_CLOSE` 中重复的 URL 解析。
   - `WINDOW_SET_COLLAPSED`：读取 id，调用 `windowManager.setCollapsed(id, collapsed)`。
   - `WINDOW_SHOW_COLLAPSED_MENU`：构建原生菜单：
     - 展开便签 → `setCollapsed(id, false)`；
     - 置顶/取消置顶 → `setStickerAlwaysOnTop(id, !sticker.isPinned)`，广播 `STICKER_LIST_CHANGED` 与 `STICKER_CHANGED`；
     - 隐藏便签 → `hideStickerWindow(id)`；
     - `menu.popup({ window: win })`。

完成条件：收起/展开高度正确；收起期间移动/改宽不会覆盖展开高度；原生菜单可展开。

### 步骤 4：便签编辑器

1. 状态：
   - `collapsed: boolean`（初始 `false`）；
   - `ActivePanel` 增加 `'fontSize'`；
   - 订阅 `window.onCollapsedChanged` 同步状态。
2. `toggleCollapsed`：
   - 本地先切换；
   - 调 `window.setCollapsed(next)`；
   - 失败回滚并 `console.error`；
   - 同时关闭 Popover。
3. 工具栏：
   - 所有 `IconButton` 改为 `size="sm"`；
   - 收起/展开按钮（`ChevronUp` / `ChevronDown`）；
   - 收起时：
     - 不渲染可选工具组；
     - 不渲染 Popover；
     - `⋯` 改为普通按钮，点击 `showCollapsedMenu()`；
   - 展开时：
     - 保留可选工具组与 Popover；
     - `⋯` 使用 Radix DropdownMenu。
   - 工具栏 `onDoubleClick`：若目标不是按钮则切换收起。
4. 菜单（展开态）：
   - 原有格式/便签项；
   - 新增 `字号` 项（`ALargeSmall` 图标）→ `openPanel('fontSize')`；
   - 新增 `收起便签` 项（`ChevronUp`）→ `toggleCollapsed`；
   - 保留隐藏便签。
5. 字号面板：
   - Popover 内 3 列网格：12/14/16/20/24/默认；
   - `applyFontSize(value)`：有值调 `setFontSize`，无值调 `unsetFontSize`，完成后关闭面板；
   - 当前字号可用 `editor.getAttributes('textStyle').fontSize` 高亮。
6. 编辑区：
   - `{!collapsed && <div className="sticker-editor ...">...}`；
   - `{!collapsed && <div className="sticker-resize-handle" aria-hidden="true" />}`。
7. 根节点 class：`sticker-window no-select` + `collapsed`。

完成条件：160/240px 工具栏不溢出；收起态无浮层；双击标题栏可切换；字号命令生效。

### 步骤 5：玻璃样式

`src/renderer/styles/sticker.css`：

1. `.sticker-window`：
   - `position: relative`；
   - `border-radius: 16px`；
   - `box-shadow: inset 0 1px 0 rgba(255,255,255,.55), inset 0 0 0 1px rgba(255,255,255,.4), inset 0 -10px 24px rgba(15,23,42,.04)`；
   - `::before` 顶部高光渐变，`pointer-events: none`，`border-radius: inherit`；
   - 暗色覆盖：低透明白光 + `inset 0 0 0 1px rgba(255,255,255,.06)`。
2. `.unified-toolbar`：
   - 高度 30、24px 按钮；
   - 渐变 + `backdrop-filter: blur(18px) saturate(140%)`；
   - 底部分隔线；暗色改为低透明黑/白光。
3. `.sticker-window.collapsed`：
   - 工具栏底边透明；
   - `.toolbar-optional` 强制隐藏。
4. `.sticker-resize-handle`：
   - 右下角 12×12 点阵；
   - `pointer-events: none`；
   - 悬停提高不透明度。
5. 说明：透明窗口的外阴影会被窗口边界裁切，本阶段用内阴影/发丝边实现层次，不改变窗口几何。

完成条件：亮/暗模式有顶部高光、发丝边、内阴影；收起态为 34px 彩条。

---

## 8. 测试用例

| # | 类型 | 输入/动作 | 预期 |
|---|------|-----------|------|
| 1 | 正常 | 新建便签 | 颜色为 `#DFECFB`（ice） |
| 2 | 正常 | 旧便签 `#FFF9C4` | 背景渲染为 ice 亮/暗色；数据不变 |
| 3 | 边界 | 未知颜色值 | 回退 ice |
| 4 | 正常 | 打开颜色面板 | 旧色对应新色点显示选中 |
| 5 | 正常 | 设置页旧默认色 | 选中态显示为 ice |
| 6 | 正常 | 暗色模式 | 8 色使用暗色背景与暗色文字 |
| 7 | 正常 | 列表暗色模式 | 色块使用暗色板 |
| 8 | 正常 | 点击收起 | `window.innerHeight ≈ 34`；编辑区消失 |
| 9 | 正常 | 点击展开 | 恢复收起前高度；编辑区出现 |
| 10 | 正常 | 双击标题栏空白 | 收起/展开切换 |
| 11 | 正常 | 收起态 `⋯` | 弹出原生菜单（展开/置顶/隐藏） |
| 12 | 边界 | 收起后移动/改宽 | x/y/width 保存；展开高度不变 |
| 13 | 边界 | 收起后隐藏再显示 | 仍保持收起 |
| 14 | 边界 | 收起后重启 | 恢复展开（会话内状态） |
| 15 | 边界 | 160px 宽 | 工具栏无横向溢出 |
| 16 | 边界 | 240px 宽 + 悬停 | 可选按钮与收起按钮都放下 |
| 17 | 正常 | 字号选 20px | HTML 出现 `font-size: 20px` |
| 18 | 正常 | 字号选默认 | 清除字号 |
| 19 | 正常 | resize 提示 | 右下角可见，不阻挡缩放 |
| 20 | 正常 | 亮/暗色板对比度 | 正文 ≥ 4.5:1 |
| 21 | 异常 | 收起 IPC 失败 | UI 回滚并记录错误 |
| 22 | 正常 | 远程同步更新颜色/内容 | 已打开便签仍能刷新（沿用 Phase 0） |

---

## 9. 验证命令

```bash
npm run typecheck
npx electron-vite build
```

UI 冒烟沿用 Phase 0 的隔离 userData + Vite IPv4 + Playwright CDP 方式：

- 8 色亮/暗渲染与截图；
- 旧色映射与 ColorPicker 选中；
- 收起/展开高度、双击、收起菜单；
- 160/240px 工具栏 `scrollWidth <= clientWidth`；
- 字号面板；
- resize 提示；
- 对比度脚本（一次性计算，不提交测试框架）。

项目无测试框架；不新增。若命令无法执行，逐项记录原因与剩余风险。

---

## 10. 文档一致性与偏差

| 设计文档 | 实现 | 说明 |
|----------|------|------|
| 5.4 字号子菜单 | Popover 字号面板 | 240px 窗口内主/子菜单并排空间不足；面板与现有颜色/标签面板一致 |
| 5.3 收起态菜单 | 原生 Electron Menu | 34px 窗口无法容纳 Radix 浮层；行为仍是展开/置顶/隐藏 |
| 5.2 环境阴影 | 内阴影 + 发丝边 | 透明窗口的外阴影会被窗口边界裁切；不改变窗口几何 |
| 5.5 列表项 useTheme | 由 StickerList 传 `isDark` | 避免每个列表项重复订阅主题 |
| 7.2 仅 `setCollapsed` | 增加 `showCollapsedMenu` / `onCollapsedChanged` | 原生菜单与状态通知所需 |
| 收起状态 | 会话内，不持久化 | 与设计一致 |
| 服务端/移动端/DB | 不改 | 与设计一致 |

确认后我将按步骤 1–5 实施，并运行 typecheck、build 与隔离 UI 冒烟。

---

## 11. 验证记录（2026-10-24）

### 11.1 静态与构建

- `npm run typecheck`：通过。
- `npx electron-vite build`：通过；main 581.14 kB、preload 5.68 kB、renderer 1,417.56 kB。
- 构建告警仅为 Radix/Lucide 的 `"use client"` 指令被忽略，无运行时影响。
- 测试用的 `playwright-core` 与 `vite.smoke.config.ts` 已在验证后移除。

### 11.2 隔离环境 UI 冒烟

使用独立 app name / userData + IPv4 Vite dev server + Playwright CDP：

| 检查项 | 结果 |
|--------|------|
| 亮色 8 色对比度 | 8.50–17.85（均 ≥ 4.5） |
| 暗色 8 色对比度 | 11.06–13.55（均 ≥ 4.5） |
| 旧色 `#FFF9C4` | 渲染为 ice：`rgb(223,236,251)` / 文字 `rgb(30,58,95)` |
| ColorPicker 旧色选中 | 冰蓝点 active，边框/焦点环均为 accent |
| 暗色模式 | `<html class="dark">`，body 背景透明 |
| 列表色块（暗色） | `rgb(28,42,61)` / 文字 `rgb(221,232,247)` |
| 设置默认色圆点（暗色） | `rgb(28,42,61)` |
| 玻璃样式 | 圆角 16px、inset 阴影、`::before` 渐变、工具栏 `blur(18px) saturate(1.4)` |
| 收起 | 200 → 34；编辑区与可选工具组消失；展开/更多/隐藏按钮存在 |
| 展开 | 34 → 200 |
| 双击拖拽把手 | 200 → 34 → 200 |
| 工具栏 240px | `scrollWidth=240`、`clientWidth=240`，可选组 `display:flex` |
| 工具栏 160px | `scrollWidth=160`、`clientWidth=160`，可选组 `display:none` |
| 字号 | 选中文字应用 20px，HTML 出现 `font-size: 20px`；清除后消失 |
| resize 提示 | 存在，`pointer-events: none` |
| 控制台/页面错误 | 无 |

补充说明：

1. Playwright 的 viewport 模拟会把 `window.innerHeight` 固定为模拟值，导致首轮冒烟误读收起高度；改用不启用 viewport 模拟的聚焦脚本后确认真实高度 200 → 34 → 200。
2. 颜色面板选中点原先被 Windows 系统焦点环染成橙色，已增加 `.color-dot:focus-visible` 的 accent 焦点环，复测边框/outline/box-shadow 均为 `#2F6FED`。
3. 收起态原生菜单通过 `Menu.popup` 打开，无法用 CDP 点击系统菜单；已验证按钮存在与 IPC 调用路径，实际菜单项点击留作手动检查。
4. 收起状态按设计只在当前会话有效，重启后恢复展开；未做跨重启 E2E。

### 11.5 后续可用性修复（2026-10-24）

反馈「换色/字体颜色用不了」经隔离环境复现：功能本身正常，问题在于菜单过长（200px 高便签只显示前 4–5 项）以及收起态菜单不含换色。已做受控修复：

- 展开态工具栏新增常驻颜色按钮；
- 菜单顶部调整为「外观：换色 / 字体颜色 / 字号」；
- 收起态原生菜单增加「换色」子菜单（8 个冷色，radio 选中态）；
- 可选工具组由 4 个减为 3 个（加粗 / 斜体 / 待办），提醒保留在菜单中。

复测：菜单首项为换色，颜色按钮生效，选中文字设红生效，240/160px 均无溢出，无 console/pageerror。
