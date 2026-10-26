# Phase 2 编码实现文档：列表与设置重构

> 对应设计文档：`docs/design/2026-10-24-phase2-list-settings-design.md`
> 前置提交：Phase 0 `df76b3d`；Phase 1 尚未提交
> 版本：v1.0 · 日期：2026-10-24 · 状态：待确认

---

## 1. 变更概览

本阶段完成：

1. 列表与设置窗口统一为 40px 玻璃标题栏 + 原生窗口按钮覆盖层；列表 560×680、设置 640×640。
2. 列表改为双列卡片网格，增加排序、筛选、搜索高亮、卡片菜单、空状态、骨架屏、键盘操作。
3. 删除改为「软删除 + 撤销 Toast」；新增最近删除查询与恢复。
4. 设置改为左侧 5 类导航 + 即时生效；快捷键录制并在冲突时回滚。
5. 新增 Toast / Radix Dialog / StatusBadge / EmptyState / Skeleton 反馈层。
6. 主题切换即时广播有效主题，并同步列表/设置窗口的原生标题栏覆盖层颜色。
7. 不改服务端、移动端、数据库、同步协议。

---

## 2. 逐文件清单

### 2.1 新增

| 路径 | 说明 |
|------|------|
| `src/renderer/components/ui/Toast.tsx` | Toast Provider / useToast / 视口 |
| `src/renderer/components/ui/Dialog.tsx` | Radix Dialog 封装 |
| `src/renderer/components/ui/EmptyState.tsx` | 空状态 |
| `src/renderer/components/ui/StatusBadge.tsx` | 同步状态徽标 |
| `src/renderer/components/ui/Skeleton.tsx` | 骨架屏 |
| `src/renderer/components/WindowChrome.tsx` | 40px 共享标题栏 |
| `src/renderer/components/ShortcutRecorder.tsx` | 快捷键录制控件 |
| `src/renderer/components/FilterBar.tsx` | 列表筛选 chips（替代 TagFilter） |
| `src/renderer/components/settings/SectionCard.tsx` | 设置分类卡片容器 |
| `src/renderer/components/settings/GeneralSettings.tsx` | 通用设置页 |
| `src/renderer/components/settings/AppearanceSettings.tsx` | 外观设置页 |
| `src/renderer/components/settings/SyncSettings.tsx` | 同步设置页 |
| `src/renderer/components/settings/DataSettings.tsx` | 数据设置页 |
| `src/renderer/components/settings/AboutSettings.tsx` | 关于页 |
| `src/renderer/utils/note.ts` | 摘要、待办进度、搜索匹配工具 |

### 2.2 修改

| 路径 | 说明 |
|------|------|
| `package.json` / `package-lock.json` | 增加 `@radix-ui/react-dialog` |
| `src/main/windows.ts` | 窗口尺寸/标题栏覆盖层/主题更新 |
| `src/main/index.ts` | 有效主题广播 + 覆盖层更新 |
| `src/main/ipc-handlers.ts` | 快捷键原子更新、主题广播、回收站、录制开关 |
| `src/main/shortcuts.ts` | 注册返回结果、失败回滚、录制期间暂停 |
| `src/main/store.ts` | 最近删除查询与恢复 |
| `src/shared/types.ts` | StickerAPI、ShortcutAPI |
| `src/shared/ipc-channels.ts` | 回收站/录制/主题相关通道 |
| `src/preload/index.ts` | 暴露新 API |
| `src/types/electron.d.ts` | `setTitleBarOverlay` |
| `src/renderer/main.tsx` | 包裹 ToastProvider |
| `src/renderer/hooks/useTheme.ts` | 直接采用有效主题 |
| `src/renderer/components/StickerList.tsx` | 卡片网格、排序/筛选/搜索、撤销、空状态 |
| `src/renderer/components/StickerListItem.tsx` | 卡片展示与菜单 |
| `src/renderer/components/SearchBar.tsx` | 搜索框 id/快捷键聚焦 |
| `src/renderer/components/ConfirmDialog.tsx` | 内部改为 Radix Dialog |
| `src/renderer/components/Settings.tsx` | 侧栏 Shell + 即时保存 |
| `src/renderer/components/ui/DropdownMenu.tsx` | 增加 RadioGroup/RadioItem |

### 2.3 删除

- `src/renderer/components/TagFilter.tsx`（由 `FilterBar.tsx` 替代）。

---

## 3. 文件职责

| 文件 | 唯一主要职责 | 公开接口 | 直接依赖 |
|------|--------------|----------|----------|
| `Toast.tsx` | 全局反馈 | `ToastProvider`、`useToast` | React、Portal、Lucide |
| `Dialog.tsx` | 模态对话框展示 | Root/Content/Title/Description/Footer | Radix Dialog |
| `WindowChrome.tsx` | 40px 标题栏 | `WindowChrome` | cn |
| `ShortcutRecorder.tsx` | 捕获键位并提交 | `ShortcutRecorder` | Button、Toast、getApi |
| `StickerList` | 列表状态与卡片网格 | 默认导出 | 卡片、FilterBar、SearchBar |
| `StickerListItem` | 单张卡片与菜单 | `StickerListItem` | DropdownMenu、note utils |
| `Settings` | 分类导航与设置状态 | 默认导出 | 5 个 section |
| `settings/*` | 单个分类的设置项 | 各自 Props | getApi、UI 组件 |
| `ShortcutManager` | 注册/注销/失败回滚 | `registerAll`、`updateShortcuts`、`setRecording` | globalShortcut |
| `StickerWindowManager` | 窗口尺寸与覆盖层 | `updatePanelWindowChrome` | store、nativeTheme |
| `IpcHandlerRegistry` | 原子设置、主题、回收站 | `registerAll` | 各服务 |

约束：

- 设置 section 不直接调用 `windowManager`，只通过 preload API。
- 列表不直接读 tombstone；回收站走 `getDeleted`。
- `WindowChrome` 不处理窗口按钮；原生覆盖层负责。

---

## 4. 项目风格参考

| 参考 | 采用的写法 |
|------|-----------|
| `StickerEditor.tsx` | `useCallback`、Radix 封装、Lucide、token 类 |
| `ConfirmDialog.tsx` | 保持 `open/title/message/onConfirm/onCancel` 调用签名 |
| `Settings.tsx` | 现有同步逻辑可拆分复用 |
| `windows.ts` | 构造函数注入、私有 helper |
| `sync.ts` | 错误中文、状态回调 |
| `Toast`/`Dialog` | 与现有 `ui/*` 保持相同的玻璃/圆角/焦点样式 |

---

## 5. 复用清单

### 5.1 直接复用

- `Button`、`IconButton`、`Tooltip`、`DropdownMenu`、`Popover`、`Switch`、`Slider`、`Chip`。
- `getApi`、`useTheme`、`extractTitle`、`getBackgroundColor/getTextColor`。
- `StickerStore.getAllStickersRaw`、`updateSticker`、`deleteSticker`。
- `Menu`、`globalShortcut`、`nativeTheme`。

### 5.2 扩展复用

- `StickerListItem` 从行改为卡片，保留 `onFocus/onDelete/onToggleVisible` 并增加 `onTogglePin/onCopy`。
- `ConfirmDialog` 内部换 Radix Dialog，调用方不变。
- `DropdownMenu` 增加 Radio 项，供排序使用。
- `ShortcutManager` 扩展返回失败列表与录制暂停。
- `useTheme` 简化为直接采用有效主题。

### 5.3 不复用

- 不引入完整 UI 框架或 ContextMenu 依赖。
- 不新建第二套 Toast/Dialog 样式。
- 不在 Settings 内继续堆 600 行；拆分为 5 个 section。
- 不在列表内直接操作 tombstone。

---

## 6. 接口与数据变化

### 6.1 便签 API

```ts
export interface StickerAPI {
  // 既有方法...
  getDeleted(): Promise<Sticker[]>;
  restore(id: string): Promise<Sticker>;
}
```

IPC：

```ts
STICKER_GET_DELETED: 'sticker:get-deleted',
STICKER_RESTORE: 'sticker:restore',
```

### 6.2 快捷键 API

```ts
export interface ShortcutAPI {
  /** 录制时暂停全局快捷键，避免录制组合键触发新建/列表 */
  setRecording(recording: boolean): Promise<void>;
}
```

`PreloadAPI` 增加 `shortcuts: ShortcutAPI`；IPC `SHORTCUTS_SET_RECORDING`。

### 6.3 Store

```ts
getDeletedStickers(): Sticker[];   // deletedAt 非空，按 deletedAt 倒序
restoreSticker(id: string): Sticker; // deletedAt=null, isVisible=true, updatedAt=now
```

### 6.4 快捷键注册

```ts
updateShortcuts(settings: AppSettings): string[]; // 返回失败的 accelerator
setRecording(recording: boolean): void;
private registerShortcut(accelerator, cb): boolean;
```

- `updateShortcuts` 失败时重新注册 store 中的旧设置。
- `SETTINGS_SET` 在持久化前调用；失败抛错，不落库。

### 6.5 主题

```ts
function getEffectiveTheme(): 'light' | 'dark';
// StickerWindowManager
updatePanelWindowChrome(theme: 'light' | 'dark'): void;
```

- `theme:changed` 载荷改为 `'light' | 'dark'`。
- 列表/设置窗口的 `titleBarOverlay` 颜色：
  - 亮色：`color: '#FFFFFF'`、`symbolColor: '#64748B'`
  - 暗色：`color: '#141E30'`、`symbolColor: '#8FA2B8'`
- 窗口 `backgroundColor`：亮 `#F4F7FA`、暗 `#0B1220`。

### 6.6 窗口配置

```ts
// 列表
{ width: 560, height: 680, minWidth: 420, minHeight: 480,
  titleBarStyle: 'hidden',
  titleBarOverlay: { ...themeColors, height: 40 },
  backgroundColor: themeBackground }
// 设置
{ width: 640, height: 640, minWidth: 520, minHeight: 480, ...同上 }
```

### 6.7 数据库 / 同步

- 无 DB 变更。
- `getDeleted`/`restore` 仅读取/更新本地 tombstone；恢复后 `updatedAt` 更新并随同步传播。
- 移动端不识别新 API，不影响现有字段。

---

## 7. 实现步骤

### 步骤 1：依赖与反馈层

1. `npm i @radix-ui/react-dialog`。
2. 新建 `ui/Toast.tsx`：
   - `ToastProvider`、`useToast`；
   - success/info/error；可选 action；5 秒自动消失；`aria-live`；
   - 右下角堆叠，Portal 到 body。
3. 新建 `ui/Dialog.tsx`，重写 `ConfirmDialog` 内部为 Radix Dialog，保持调用签名。
4. 新建 `EmptyState`、`StatusBadge`、`Skeleton`。
5. `ui/DropdownMenu.tsx` 增加 `DropdownMenuRadioGroup` / `DropdownMenuRadioItem`（带 Check 指示）。
6. `main.tsx` 用 `ToastProvider` 包裹 App。

完成条件：组件可在亮/暗色下渲染；Dialog 焦点陷阱/Esc 正常。

### 步骤 2：回收站与快捷键 API

1. `StickerStore` 增加 `getDeletedStickers` / `restoreSticker`。
2. IPC 增加 `STICKER_GET_DELETED` / `STICKER_RESTORE`；preload 暴露。
3. `ShortcutAPI.setRecording` + IPC；`ShortcutManager.setRecording`。
4. `ShortcutManager` 改为返回注册结果；`updateShortcuts` 失败回滚。
5. `SETTINGS_SET`：
   - 若快捷键字段变化，先 `updateShortcuts(newSettings)`；
   - 失败抛错，不持久化；
   - 成功后持久化。

完成条件：恢复后列表出现；快捷键冲突时旧值仍可用。

### 步骤 3：窗口外壳与主题

1. `windows.ts`：
   - 列表/设置新尺寸；
   - `titleBarStyle`/`titleBarOverlay`/`backgroundColor`；
   - `updatePanelWindowChrome(theme)` 遍历 list/settings 窗口调用 `setTitleBarOverlay`。
2. `electron.d.ts` 增加 `setTitleBarOverlay`。
3. `main/index.ts`：
   - `getEffectiveTheme()`；
   - `nativeTheme.updated` 广播有效主题并更新覆盖层。
4. `ipc-handlers.ts`：
   - `SETTINGS_SET` 在主题变化后广播有效主题并更新覆盖层。
5. `useTheme.ts`：
   - `theme:changed` 直接 `setIsDark(theme === 'dark')`；
   - 保留 `changeThemeMode` 供设置页即时切换。
6. 新建 `WindowChrome`；列表/设置页使用 40px 头部、`pr-[150px]`、拖拽区、操作区 `no-drag`。

完成条件：窗口尺寸正确；主题切换所有窗口即时更新；头部不与原生按钮重叠。

### 步骤 4：列表重构

1. `utils/note.ts`：
   - `extractSnippet(html, maxLength)`；
   - `getChecklistProgress(html)`；
   - `escapeRegExp` / 高亮分段。
2. `SearchBar`：增加 `id="sticker-search"`，支持 `Ctrl+K` 聚焦。
3. `FilterBar`：全部 / 标签 / 置顶 / 待办 / 提醒。
4. `StickerList`：
   - `loading` 初始骨架；
   - 排序：最近更新 / 最近创建 / 置顶优先；
   - 搜索 + 筛选 + 排序组合；
   - 双列网格（`min-[520px]:grid-cols-2`）；
   - 删除：软删除 + Toast 撤销；
   - 空状态（无便签 / 无匹配）；
   - `Ctrl+K` 聚焦搜索；
   - 卡片 Enter 打开、Delete 删除。
5. `StickerListItem` 卡片：
   - 颜色圆点、标题、摘要 2 行、标签、相对更新时间、置顶/提醒、待办进度；
   - 搜索命中高亮（`<mark>`）；
   - hover `⋯` 菜单：显示/隐藏、置顶、复制内容、删除；
   - 键盘与点击操作不冲突。
6. 删除旧的 `TagFilter.tsx`。

完成条件：560 双列 / 360 单列；排序/筛选/搜索高亮正确；删除撤销可用；无 console error。

### 步骤 5：设置 Shell 与分类页

1. `Settings.tsx`：
   - 加载设置；
   - 侧栏 5 类 + 图标；
   - `update(patch)`：调用 `settings.set`，成功后更新本地并 Toast，失败 Toast 并抛出；
   - 移除全局保存/取消/pending。
2. `GeneralSettings`：
   - `ShortcutRecorder` ×2；
   - 开机自启动 Switch。
3. `ShortcutRecorder`：
   - 进入录制调用 `shortcuts.setRecording(true)`；
   - 捕获组合键，生成 accelerator；
   - 应用/Cancel；失败显示错误并保持旧值；
   - 退出录制调用 `setRecording(false)`；卸载时清理。
4. `AppearanceSettings`：
   - 主题即时切换；
   - 默认颜色 8 色，即时保存。
5. `SyncSettings`：
   - 启用开关即时保存；
   - 状态卡（StatusBadge + 上次同步）；
   - 服务器地址应用；
   - 立即同步、配对码/QR、设备列表/解绑（Dialog）；
   - 错误 Toast/内联。
6. `DataSettings`：
   - 导出；导入模式 + Dialog；Toast；
   - 最近删除列表（最多 20）与恢复。
7. `AboutSettings`：版本、快捷键、License。
8. 删除设置中的 `alert()`。

完成条件：所有设置即时生效；快捷键冲突回滚；同步/数据流程保留。

### 步骤 6：验证

1. `npm run typecheck`
2. `npx electron-vite build`
3. 隔离 userData + CDP UI 冒烟（见第 8 节）。
4. 运行 `npm run dev` 手动检查原生标题栏覆盖层与窗口尺寸。

---

## 8. 测试用例

| # | 类型 | 输入/动作 | 预期 |
|---|------|-----------|------|
| 1 | 正常 | 打开列表（560×680） | 双列卡片；头部不与原生按钮重叠 |
| 2 | 边界 | 列表缩到 <520px | 单列卡片 |
| 3 | 正常 | 搜索关键词 | 标题/摘要命中高亮 |
| 4 | 正常 | 排序：最近更新/创建/置顶 | 顺序正确 |
| 5 | 正常 | 筛选：标签/置顶/待办/提醒 | 结果正确 |
| 6 | 正常 | 卡片 `⋯` → 显示/隐藏 | 窗口显隐，列表刷新 |
| 7 | 正常 | 卡片 `⋯` → 删除 | 软删除 + Toast 撤销 |
| 8 | 正常 | Toast 撤销 | 便签恢复，列表出现 |
| 9 | 正常 | 数据页最近删除 → 恢复 | 便签恢复 |
| 10 | 正常 | 卡片 Enter / Delete | 打开 / 删除 |
| 11 | 正常 | 无便签 | 空状态 + 新建 |
| 12 | 正常 | 搜索无结果 | 空状态 + 清除筛选 |
| 13 | 正常 | 首次加载 | 骨架卡片 |
| 14 | 正常 | 设置侧栏 5 类 | 内容切换 |
| 15 | 正常 | 切换主题 | 所有窗口即时切换；覆盖层颜色更新 |
| 16 | 正常 | 改默认颜色 | 即时保存；新便签使用新颜色 |
| 17 | 正常 | 录制快捷键并应用 | 生效；Toast |
| 18 | 异常 | 录制已被占用的快捷键 | 报错；旧快捷键仍可用 |
| 19 | 正常 | 自动启动开关 | 即时保存 |
| 20 | 正常 | 同步开关/地址/配对/解绑 | 行为与 Phase 0 一致 |
| 21 | 正常 | 导入成功/失败 | Toast；Dialog 确认 |
| 22 | 正常 | 暗色模式 | 列表/设置/Toast/Dialog 全暗色 |
| 23 | 异常 | 关闭同步 | 无网络请求 |
| 24 | 正常 | 窗口最小尺寸 | 420×480 / 520×480 布局不破 |

---

## 9. 验证命令

```bash
npm run typecheck
npx electron-vite build
```

UI 冒烟沿用隔离 userData + Playwright CDP：

- 通过创建与正式窗口相同配置的 BrowserWindow 验证列表/设置页面；
- 列表网格、排序、筛选、搜索高亮、删除撤销、最近删除；
- 设置侧栏、即时保存、主题、Toast/Dialog；
- 原生标题栏覆盖层通过 `npm run dev` 手动检查（CDP 截图不含原生按钮）。

项目无测试框架；不新增。命令无法执行时记录原因与剩余风险。

---

## 10. 文档一致性与偏差

| 设计 | 实现 | 说明 |
|------|------|------|
| 原生标题栏覆盖层颜色 | 使用 `#FFFFFF`/`#141E30`（surface） | 与 40px 头部背景一致；设计文档中的 `#F4F7FA`/`#0B1220` 用于窗口底色 |
| 右键菜单 | 卡片 `⋯` 菜单 | 设计已确认暂不做右键 |
| 多选/批量 | 不做 | 设计已确认 |
| 快捷键录制 | 增加 `setRecording` 暂停全局快捷键 | 避免录制组合键触发新建/列表 |
| 排序控件 | DropdownMenu Radio | 不新增 Select 依赖 |
| 复制内容 | `navigator.clipboard.writeText` + fallback | 不新增 IPC |
| 设置拆分 | Shell + 5 个 section 文件 | 降低单文件复杂度，不改变交互 |
| 回收站 | 最近 20 条 + 单条恢复 | 与设计一致 |
| 服务端/移动端/DB | 不改 | 与设计一致 |

确认后我将按步骤 1–6 实施，并运行 typecheck、build 与隔离 UI 冒烟。主进程窗口配置与主题广播会需要重启开发版。

---

## 11. 验证记录（2026-10-24）

### 11.1 静态与构建

- `npm run typecheck`：通过。
- `npx electron-vite build`：通过；renderer 约 1,467 kB，新增 Radix Dialog 后增量正常。
- 构建告警仅为 Radix 的 `"use client"` 指令被忽略，无运行时影响。
- 测试用的 `playwright-core` 与临时 app 已在验证后移除。

### 11.2 隔离环境 UI 冒烟

| 检查项 | 结果 |
|--------|------|
| 列表 560px | 4 张卡片，首行 2 列 |
| 列表 360px | 首行 1 列 |
| 搜索「会议」 | 命中 1 张卡片，标题高亮 |
| 筛选「工作」 | 2 张卡片 |
| 排序「最近创建」 | 菜单选择生效 |
| 卡片置顶 | `isPinned=true` |
| 删除 + Toast 撤销 | 删除提示出现，撤销后便签恢复 |
| 空状态 | 搜索无结果显示「没有匹配的便签」 |
| 设置侧栏 | 通用 / 外观 / 同步 / 数据 / 关于 |
| 主题即时切换 | `<html class="dark">` |
| 快捷键录制 | 捕获 `Ctrl+Alt+M` 并保存 |
| 同步空地址 | 开关保持关闭，Toast「请先填写同步服务器地址」 |
| 回收站 | 已删除「周末计划」出现在最近删除，恢复成功 |
| 导入 Dialog | Radix Dialog 正常打开/取消 |
| 关于 | 版本号正常显示 |
| 控制台/页面错误 | 无 |

### 11.3 验证中发现并修复

1. **关于页 `__APP_VERSION__` 未定义**：开发服务器未注入 Vite define 时组件崩溃。改为新增 `AppAPI.getVersion()`（主进程 `app.getVersion()`），关于页异步读取；生产/开发行为一致。
2. **多段便签标题截取不准**：`extractTitle` 改为优先取第一个段落/标题/列表项，摘要不再与标题重复。
3. **恢复便签后点击卡片无反应**：新增 `focusOrShowStickerWindow`，窗口不存在时自动创建。
4. **导入确认按钮语义**：合并导入使用 primary，覆盖导入使用 danger；`ConfirmDialog` 增加 `confirmVariant`。
5. **标题栏覆盖层更新容错**：`setTitleBarOverlay` 增加 try/catch，避免非覆盖层窗口报错中断流程。

### 11.4 未自动化/待手动

- 原生标题栏覆盖层与 560×680 / 640×640 实际窗口尺寸（CDP 页面截图不含原生按钮；已重启开发版，可手动打开列表/设置确认）。
- 快捷键冲突（需占用组合键模拟）。
- 文件导入/导出的系统文件选择器。
- 卡片复制内容、显示/隐藏、键盘 Enter/Delete。
- 真实同步后端联调。

> 冒烟中的 `Titlebar overlay is not enabled` 是因为测试把便签窗口导航到了 `?page=settings`（该窗口没有覆盖层）；正式列表/设置窗口由 `createListPanelWindow` / `createSettingsWindow` 创建，已启用覆盖层。
