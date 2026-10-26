# Phase 2 功能设计文档：列表与设置重构

> 上级方案：`docs/UI-REDESIGN-PLAN.md`
> 前置阶段：Phase 0（设计基础）、Phase 1（便签窗口冷色玻璃，已完成）
> 版本：v1.0 · 日期：2026-10-24 · 状态：待确认
> 范围：列表面板与设置窗口的窗口外壳、信息架构、交互与反馈层

---

## 1. 背景与目标

### 1.1 背景

Phase 0 建立了 token 与基础组件，Phase 1 完成了便签窗口的冷色板、玻璃质感和收起/展开。列表与设置仍保留旧结构：

- 列表窗口 360×600，单列行式列表，只有搜索与标签筛选，无排序、卡片信息、删除撤销。
- 设置窗口 500×500，单页长滚动 + 全局「保存设置」；快捷键是普通文本框，注册失败只在控制台告警。
- 两个窗口使用系统默认标题栏，与便签窗口的视觉语言割裂。
- `alert()` 作为导入反馈；确认框是手写遮罩，无焦点陷阱。
- 删除是软删除，但没有回收站/恢复入口。

### 1.2 目标

1. 统一列表与设置的窗口外壳：原生窗口按钮覆盖层 + 40px 玻璃标题栏。
2. 列表改为双列卡片网格，补齐排序、筛选、搜索高亮、卡片操作菜单、空状态、骨架屏。
3. 删除改为「立即软删除 + 撤销 Toast」，并在设置中提供「最近删除」恢复。
4. 设置改为左侧分类 + 右侧内容，所有项即时生效，去掉全局保存按钮。
5. 快捷键改为录制控件，注册冲突时给出明确错误并回滚。
6. 建立 Toast / Radix Dialog / StatusBadge / EmptyState / Skeleton 反馈层。
7. 主题切换即时作用于所有窗口，并同步原生标题栏覆盖层颜色。
8. 不改服务端、移动端、数据库、同步协议。

### 1.3 成功标准

| 维度 | 标准 |
|------|------|
| 窗口 | 列表 560×680、设置 640×640；原生最小化/最大化/关闭可用；标题栏 40px |
| 列表 | ≥520px 双列、<520px 单列；排序/筛选/搜索高亮可用；空状态与骨架屏正常 |
| 删除 | 立即软删除 + 5 秒撤销；最近删除可恢复 |
| 设置 | 左侧 5 类导航；所有项即时生效；无全局保存按钮 |
| 快捷键 | 可录制；冲突时提示并保持旧值 |
| 反馈 | 导入/删除/设置变更使用 Toast；确认框使用 Radix Dialog |
| 主题 | 切换后所有窗口与标题栏颜色即时更新 |
| 兼容 | 旧数据、旧设置正常；不改表/同步协议 |
| 范围 | 不改 server / mobile / DB |

---

## 2. 非目标

本阶段不做：

- 多选与批量操作（后续单独迭代）。
- 右键上下文菜单（先用卡片右上角 `⋯` 菜单；右键留到后续）。
- 列表拖拽排序、自定义视图、命令面板、全局搜索。
- 回收站的完整管理（批量清理、保留天数设置）；只做最近删除列表 + 单条恢复。
- 设置中的「视觉效果/性能优先」开关（Phase 1 的 CSS 玻璃已可用）。
- 移动端视觉对齐与色板对齐（Phase 3）。
- 服务端/数据库/同步协议改动。
- 自动更新、安装包签名。

---

## 3. 现状分析

### 3.1 相关入口与调用链

| 领域 | 现状 | 位置 |
|------|------|------|
| 列表窗口 | 360×600，默认系统标题栏 | `src/main/windows.ts:298-327` |
| 设置窗口 | 500×500，每次新建，默认系统标题栏 | `src/main/windows.ts:329-355` |
| 列表 UI | 单列行式，搜索 + 标签筛选 | `src/renderer/components/StickerList.tsx` |
| 列表项 | 标题 + 标签 + 时间，hover 显示可见/删除 | `src/renderer/components/StickerListItem.tsx` |
| 删除 | `ConfirmDialog` 后软删除 | `StickerListItem.tsx` + `ConfirmDialog.tsx` |
| 搜索 | 去标签纯文本 includes | `StickerList.tsx:41-54` |
| 设置 UI | 单页长滚动 + 全局保存 | `src/renderer/components/Settings.tsx` |
| 设置保存 | 暂存 pending，点保存统一提交 | `Settings.tsx` 的 `handleSave` |
| 快捷键 | 文本框直接写值，主进程注册失败仅 warn | `shortcuts.ts:35-50` |
| 主题 | `nativeTheme.updated` 广播；设置修改主题后不广播 | `src/main/index.ts:80-84` |
| 主题 Hook | 只在 `themeMode==='system'` 时响应广播 | `src/renderer/hooks/useTheme.ts` |
| 导入反馈 | `alert()` | `Settings.tsx` 的 `handleImport` |
| 确认框 | 手写遮罩，无焦点陷阱 | `src/renderer/components/ConfirmDialog.tsx` |
| Toast/Dialog | 未实现 | — |
| 回收站 | 软删除有 tombstone，但无读取/恢复入口 | `src/main/store.ts:100-110` |
| 主题覆盖层 | 未使用 `titleBarOverlay` | `windows.ts` |

### 3.2 数据流

- 列表：`sticker.getAll()` → `StickerList` 本地筛选/搜索 → 卡片；变更通过 `STICKER_LIST_CHANGED` 刷新。
- 设置：`settings.get()` → pending state → `settings.set(partial)` → 主进程更新设置/快捷键/自启动/同步。
- 主题：`nativeTheme.updated` → 广播 `theme:changed` → `useTheme` 设置 `isDark`；设置修改主题不触发。
- 删除：`sticker.delete(id)` → 软删除 + 关闭窗口 + 列表刷新。
- 同步：远程变更广播列表与单条便签。

### 3.3 约束

- Electron 28 / Windows 10/11；`titleBarStyle: 'hidden'` + `titleBarOverlay` 可保留原生窗口按钮与 Snap Layouts。
- 渲染层通过 preload 访问 IPC；`contextIsolation: true`。
- 无测试框架；沿用 typecheck/build + 隔离 userData + CDP UI 冒烟。
- 服务端 `color`/`window_state` 为字符串/JSON；本阶段无 DB 改动。
- 设置项即时生效意味着每次操作都会走 `settings.set`，需要防抖/避免重复提交。

---

## 4. 参考与复用

### 4.1 直接复用

- token 与基础组件：`Button`、`IconButton`、`Tooltip`、`DropdownMenu`、`Popover`、`Switch`、`Slider`、`Chip`。
- `useTheme`、`getApi`、`useSticker`。
- `StickerStore.getAllStickersRaw()`、软删除字段、`getStickerById`。
- `ShortcutManager` 的注册/注销逻辑（扩展为返回结果）。
- `Menu`/原生窗口 API。

### 4.2 扩展复用

- `StickerAPI` 增加 `getDeleted()` / `restore(id)`。
- `StickerStore` 增加 `getDeletedStickers()` / `restoreSticker()`。
- `ShortcutManager.updateShortcuts()` 返回失败列表，并在失败时恢复旧快捷键。
- `SETTINGS_SET` 先应用快捷键再持久化；主题变化时广播有效主题。
- `useTheme` 在收到 `theme:changed` 时直接采用有效主题。
- `ConfirmDialog` 内部改用 Radix Dialog，保持现有调用签名。
- `main.tsx` 增加 `ToastProvider`。

### 4.3 不复用

- 不引入完整 UI 框架（Ant Design/MUI）。
- 不新增 ContextMenu 依赖：卡片右上角 `⋯` 菜单先满足主要操作。
- 不把设置项继续堆在单页长滚动里。
- 不在渲染层读取 tombstone：回收站读取走专用 IPC。

---

## 5. 实现思路

### 5.1 窗口外壳

- 列表窗口：`560×680`，最小 `420×480`；设置窗口：`640×640`，最小 `520×480`。
- 两个窗口使用：
  ```ts
  titleBarStyle: 'hidden',
  titleBarOverlay: {
    color: light ? '#F4F7FA' : '#0B1220',
    symbolColor: light ? '#64748B' : '#8FA2B8',
    height: 40,
  },
  backgroundColor: light ? '#F4F7FA' : '#0B1220',
  ```
- 新增 `WindowChrome` 渲染组件：40px 高、`-webkit-app-region: drag`、左侧图标/标题、右侧操作区；右侧预留约 150px 给原生窗口按钮（`pr-[150px]`），操作按钮/输入加 `no-drag`。
- 主进程在主题变化时对已打开的 list/settings 窗口调用 `setTitleBarOverlay()`，颜色随亮/暗切换。
- 保留原生按钮，避免自绘最小化/最大化/关闭带来 Snap Layouts 与可访问性退化。

### 5.2 列表页

#### 布局

```
┌──────────────────────────────────────────────┐
│  📌 电脑便签   12            ⌘K 搜索   + 新建 │  WindowChrome
├──────────────────────────────────────────────┤
│  [搜索…]                       [排序 ▾]       │
│  全部 · 工作 · 生活 · 灵感 · 置顶 · 待办 · 提醒 │  filter chips
├──────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  │
│  │ 今日待办      ⋯ │  │ 周末计划      ⋯ │  │
│  │ 3/5 已完成        │  │ #生活 · 2 天前    │  │
│  │ #工作 · 5 分钟前  │  │                  │  │
│  └──────────────────┘  └──────────────────┘  │
└──────────────────────────────────────────────┘
```

#### 卡片

- 2 列网格（容器 ≥520px），<520px 单列；间距 12px。
- 内容：便签色条/圆点、标题（1 行）、摘要（2 行）、标签（最多 3 个）、相对时间、置顶/提醒徽标、待办进度（`3/5` + 2px 进度条）。
- 卡片 hover：抬升 1px + 阴影；右上角出现 `⋯` 菜单。
- 点击卡片：显示并聚焦对应便签窗口。
- `⋯` 菜单：显示/隐藏、置顶/取消、复制内容、删除。
- 删除：立即软删除 + Toast「已删除「标题」」+ 撤销（5 秒）；不再弹确认框。
- 键盘：卡片 `tabIndex=0`，Enter 打开，Delete 删除（带撤销）。
- 删除后若当前筛选结果为空，显示空状态。

#### 搜索 / 排序 / 筛选

- 搜索：标题 + 摘要 + 标签；命中词高亮（`<mark>`）。
- 排序：最近更新（默认）、最近创建、置顶优先。
- 筛选 chips：全部、标签（动态）、置顶、有待办、有提醒。
- 搜索框 `Ctrl+K` 聚焦。
- 顶部计数显示当前筛选结果数。

#### 空状态与加载

- 空状态：玻璃圆 + `NotebookPen` + 标题 + 说明 + 「新建便签」按钮。
- 加载中：2–4 个 Skeleton 卡片（首次加载）。
- 搜索/筛选无结果：空状态变体，提供「清除筛选」。

#### 暂不做

- 多选/批量操作、右键菜单、拖拽排序。

### 5.3 设置页

#### 结构

```
┌──────────────────────────────────────────────┐
│  ⚙ 设置                                      │  WindowChrome
├────────────┬─────────────────────────────────┤
│ 通用       │  快捷键                          │
│ 外观   ●   │  ┌─────────────────────────────┐ │
│ 同步       │  │ 新建便签   [录制] Ctrl+Alt+N │ │
│ 数据       │  │ 打开列表   [录制] Ctrl+Alt+S │ │
│ 关于       │  └─────────────────────────────┘ │
└────────────┴─────────────────────────────────┘
```

- 左侧 168px：通用 / 外观 / 同步 / 数据 / 关于；选中项为 accent-soft 胶囊。
- 右侧内容滚动，最大宽度 520px。
- 不再有全局「保存设置」；每项即时生效。

#### 通用

- 快捷键录制：
  - 点击「录制」进入捕获态，按组合键生成 accelerator（如 `Ctrl+Alt+N`）。
  - Esc 取消；输入非法组合时提示。
  - 保存时调用 `settings.set`；主进程先尝试重新注册，失败则抛出「快捷键已被占用：...」，渲染层回滚显示并 Toast。
- 开机自启动：Switch 即时保存。

#### 外观

- 主题：跟随系统 / 浅色 / 深色；点击即时生效，并更新所有窗口与标题栏覆盖层。
- 默认便签颜色：8 个冷色圆点；点击即时保存。
- 显示当前选中状态，支持旧色映射。

#### 同步

- 启用开关：即时保存；未填地址时提示。
- 状态卡：StatusBadge（已连接/未连接/同步中/异常）+ 上次同步相对时间。
- 服务器地址：输入 + 应用；切换地址需确认（会重新注册、旧配对失效）。
- 立即同步、生成配对码（QR + 倒计时）、已配对设备列表 + 解绑（Dialog 确认）。
- 错误以内联文本 + Toast 展示。

#### 数据

- 导出数据（Toast 成功）。
- 导入：模式选择 + Dialog 确认；成功/失败用 Toast。
- 最近删除：列出 `deletedAt` 非空的便签（最近 20 条），支持恢复；恢复后刷新列表并 Toast。

#### 关于

- 版本号（`__APP_VERSION__`）、快捷键说明、License。

### 5.4 反馈层

- **Toast**：Context + Provider；success/info/error；可选 action（如「撤销」）；5 秒自动消失；右下角堆叠；`aria-live`。
- **Dialog**：基于 Radix Dialog 重写 `ConfirmDialog`，保留现有 props，获得焦点陷阱、Esc、遮罩点击关闭。
- **StatusBadge**：圆点 + 文案（在线/离线/同步中/异常）。
- **EmptyState**：玻璃圆 + 图标 + 标题 + 说明 + 操作。
- **Skeleton**：列表加载占位。

### 5.5 主题即时生效

- 主进程新增 `getEffectiveTheme()`：`themeMode==='system'` 取 `nativeTheme.shouldUseDarkColors`，否则取 `themeMode`。
- `SETTINGS_SET` 检测 `themeMode` 变化后：
  - 持久化；
  - 广播 `theme:changed`（有效主题）；
  - 更新 list/settings 窗口的 `titleBarOverlay`。
- `nativeTheme.updated` 同样广播有效主题并更新覆盖层。
- `useTheme` 收到 `theme:changed` 时直接 `setIsDark(theme === 'dark')`，不再依赖本地 `themeMode` 判断。
- 设置页主题按钮调用 `changeThemeMode`，即时持久化并触发上述流程。

### 5.6 快捷键原子更新

- `ShortcutManager.registerShortcut` 返回 boolean。
- `updateShortcuts(settings)`：
  - 注销全部；
  - 注册新快捷键；
  - 若有失败，重新注册 store 中的旧设置，并返回失败列表。
- `SETTINGS_SET`：
  - 若快捷键字段变化，先 `updateShortcuts(newSettings)`；
  - 有失败 → 抛出 `快捷键已被占用：...`，不持久化；
  - 无失败 → 持久化，再处理自启动/主题/托盘。
- 渲染层捕获错误，回滚输入值并 Toast。

### 5.7 回收站

- `StickerStore.getDeletedStickers()`：过滤 `deletedAt` 非空，按 `deletedAt` 倒序。
- `StickerStore.restoreSticker(id)`：`deletedAt: null`、`isVisible: true`、`updatedAt: now`。
- IPC：`STICKER_GET_DELETED`、`STICKER_RESTORE`；preload 暴露 `getDeleted` / `restore`。
- 恢复后广播 `STICKER_LIST_CHANGED`；若便签原本被关闭，不自动打开窗口（列表点击再打开）。
- 删除 Toast 的撤销也调用 `restore`。

---

## 6. 职责边界

| 模块 | 负责 | 不负责 |
|------|------|--------|
| `WindowChrome` | 40px 标题栏展示与拖拽区域 | 窗口尺寸/原生按钮 |
| `StickerList` | 搜索/排序/筛选/网格/空状态 | 单个卡片操作细节 |
| `StickerListItem` | 卡片展示、`⋯` 菜单、键盘 | 列表级筛选 |
| `Settings` | 分类导航与设置提交 | 快捷键注册、主题广播 |
| `ShortcutRecorder` | 捕获按键、展示、校验格式 | 实际注册 |
| `ShortcutManager` | 注册/注销/失败回滚 | UI 提示 |
| `IpcHandlerRegistry` | 快捷键原子更新、主题广播、回收站 IPC | 列表/设置布局 |
| `StickerStore` | tombstone 查询/恢复 | UI |
| `ToastProvider` | 反馈展示 | 业务逻辑 |
| `WindowManager` | 窗口尺寸/覆盖层 | 页面内容 |

---

## 7. 接口与数据

### 7.1 便签 API

```ts
export interface StickerAPI {
  // 既有方法...
  getDeleted(): Promise<Sticker[]>;
  restore(id: string): Promise<Sticker>;
}
```

IPC：`STICKER_GET_DELETED`、`STICKER_RESTORE`。

### 7.2 Store

```ts
getDeletedStickers(): Sticker[];
restoreSticker(id: string): Sticker;
```

- 恢复：`deletedAt: null`、`isVisible: true`、`updatedAt: now`。
- 无数据库字段变化。

### 7.3 快捷键

```ts
// ShortcutManager
updateShortcuts(settings: AppSettings): string[]; // 返回失败的 accelerator
private registerShortcut(accelerator: string, callback: () => void): boolean;
```

- `SETTINGS_SET` 在持久化前调用；失败抛错。
- `registerAll` 仍用于启动时注册，忽略返回值并记录日志。

### 7.4 主题

```ts
// 主进程内部
function getEffectiveTheme(): 'light' | 'dark';
function updatePanelWindowChrome(theme: 'light' | 'dark'): void;
```

- `theme:changed` 载荷改为有效主题（'light' | 'dark'）。
- `useTheme` 直接采用。
- 新增 `BrowserWindow.setTitleBarOverlay(options)` 类型。

### 7.5 窗口配置

```ts
// 列表
{ width: 560, height: 680, minWidth: 420, minHeight: 480,
  titleBarStyle: 'hidden', titleBarOverlay: { height: 40, color, symbolColor },
  backgroundColor: color }
// 设置
{ width: 640, height: 640, minWidth: 520, minHeight: 480, ... }
```

### 7.6 无 DB / 服务端 / 移动端变化

- 颜色/窗口状态照旧同步。
- 回收站只是本地 tombstone 查询；删除/恢复会随同步传播。
- 移动端不识别 `getDeleted`/`restore`，不影响现有同步字段。

---

## 8. 边界与异常

| 场景 | 预期 |
|------|------|
| 列表窗口窄于 520px | 单列卡片 |
| 列表为空 | 空状态 + 新建按钮 |
| 搜索无结果 | 空状态变体 + 清除筛选 |
| 删除后 5 秒内撤销 | 恢复便签；列表刷新 |
| 删除后超过 5 秒 | Toast 消失；仍可在最近删除恢复 |
| 恢复已删除便签 | `deletedAt=null`、可见；列表出现 |
| 快捷键与系统/其他应用冲突 | 注册失败，SETTINGS_SET 抛错，输入回滚，Toast 提示 |
| 快捷键为空 | 拒绝保存并提示 |
| 主题切换 | 所有窗口即时切换；标题栏覆盖层颜色同步 |
| 系统主题变化且设置跟随系统 | 有效主题变化并广播 |
| 同步关闭 | 不请求网络；状态显示未启用 |
| 启用同步但地址为空 | 报错，不落库 |
| 导入成功/失败 | Toast，替代 alert |
| 设置窗口重复打开 | 每次新开；主题/覆盖层正确 |
| 列表删除正在打开便签的当前项 | 关闭对应窗口 + Toast；撤销后恢复数据，窗口不自动打开 |
| 窗口原生按钮 | 由覆盖层提供；渲染层右侧预留空间 |
| Windows 10 不支持覆盖层 | 回退到默认标题栏（需实现/验证） |

---

## 9. 风险与兼容性

| 风险 | 影响 | 应对 |
|------|------|------|
| titleBarOverlay 在部分 Windows 版本表现不一致 | 标题栏错位 | Windows 11 必测；若异常回退默认 frame（窗口仍可用） |
| 即时保存频繁写 electron-store | 性能/磁盘 | 设置项为低频操作；必要时 200ms 防抖 |
| 快捷键原子更新失败 | 旧快捷键丢失 | 失败时重新注册 store 中的旧值 |
| 删除即撤销替代确认框 | 误删 | 5 秒撤销 + 最近删除恢复 |
| 回收站恢复与同步冲突 | 旧 tombstone 覆盖 | 恢复更新 `updatedAt`，按最后写入优先 |
| 列表卡片性能 | 大量便签 | 当前规模可接受；后续可虚拟化 |
| 卡片菜单/Toast/Portal 暗色 | 颜色不一致 | 使用 html.dark + token |
| 窗口尺寸变化 | 用户习惯 | 新尺寸为默认值；用户仍可缩放 |
| 主题广播改动 | 旧 `useTheme` 逻辑失效 | 同步更新 hook；验证跟随系统/手动切换 |
| 迁移 `ConfirmDialog` 到 Radix | 调用方回归 | 保持 props 不变 |

---

## 10. 验证策略

### 10.1 自动化

- `npm run typecheck`
- `npx electron-vite build`
- 隔离 userData + CDP UI 冒烟。

### 10.2 UI 冒烟

- 列表 560×680：双列卡片；<520px 单列；卡片信息完整。
- 搜索高亮、排序、置顶/提醒/待办筛选。
- 删除 → Toast 撤销 → 恢复；最近删除恢复。
- 卡片 `⋯` 菜单：显示/隐藏、置顶、复制、删除。
- 空状态、骨架屏、键盘 Enter/Delete。
- 设置 640×640：侧栏 5 类；即时保存；主题即时切换；快捷键录制与冲突回滚；同步卡；导入 Dialog；Toast。
- 窗口标题栏覆盖层：列表/设置窗口的 40px 头部不与原生按钮重叠；暗色切换后颜色正确（截图 + 手动检查）。
- 无 pageerror/console error。

### 10.3 未覆盖

- 多选/批量操作、右键菜单（本阶段非目标）。
- 系统级快捷键冲突的自动化（需占用组合键模拟，手动验证）。
- Windows 10 覆盖层回退（如有条件，手动验证）。
- 真实同步后端联调。

---

## 11. 关键决策（需确认）

1. **窗口外壳**：列表 560×680、设置 640×640；使用 `titleBarStyle: hidden` + `titleBarOverlay` 保留原生按钮；共享 40px `WindowChrome`。
2. **列表**：双列卡片网格 + 排序/筛选/搜索高亮 + 卡片 `⋯` 菜单；删除改为「立即软删除 + 撤销 Toast」。
3. **暂不做**：多选/批量操作、右键菜单、拖拽排序；先用卡片菜单。
4. **设置**：左侧 5 类 + 即时生效，移除全局保存；快捷键录制并在冲突时回滚。
5. **回收站**：新增 `getDeleted`/`restore`，设置「数据」页提供最近 20 条恢复；不做完整回收站管理。
6. **反馈层**：Toast + Radix Dialog（重写 ConfirmDialog 内部）+ StatusBadge + EmptyState + Skeleton。
7. **主题**：主进程广播有效主题，所有窗口与标题栏覆盖层即时更新。
8. **范围**：不改 server / mobile / DB / 同步协议。
