# Phase 0 功能设计文档：设计体系基础与 P0 修复

> 上级方案：`docs/UI-REDESIGN-PLAN.md`
> 版本：v1.0 · 日期：2026-10-24 · 状态：待确认
> 范围：桌面端 Phase 0（设计 token、基础 UI 组件、Lucide 图标、7 项 P0 修复）

---

## 1. 背景与目标

### 1.1 背景

`docs/UI-REDESIGN-PLAN.md` 确定了「冷色极简玻璃」方向，并把落地拆为 Phase 0–3。Phase 0 是全链路的地基：没有 token 与基础组件，后续便签窗口、列表、设置的改版会继续堆积硬编码样式；同时现有代码里存在 7 个影响数据安全或日常体验的 P0 问题，需要与视觉基础同批解决。

### 1.2 业务目标

1. 建立可复用的设计 token 与基础 UI 组件，后续页面改版只组合组件，不再重复写样式。
2. 用 Lucide 替换全部功能类 emoji，统一图标语言。
3. 修复 P0：
   - 桌面端默认不再向硬编码公网地址自动注册/同步；
   - 单实例运行；
   - 重启尊重用户隐藏状态；
   - 便签工具栏在 160px 窗口内不裁切；
   - 透明度只作用于背景，正文始终可读；
   - 手机端修改/删除后，桌面已打开的便签能刷新/关闭；
   - 版本号统一从构建信息读取。

### 1.3 成功标准

| 维度 | 标准 |
|------|------|
| 视觉基础 | 全局颜色全部来自 token；新增组件只引用 token，不写 `blue-500` / `gray-800` |
| 图标 | 功能按钮不再出现 emoji；用户输入内容中的 emoji 不受影响 |
| 同步隐私 | 新安装默认不发任何同步网络请求；开启前必须显式操作 |
| 稳定性 | 双击启动只有一个实例；隐藏全部便签后重启仍全部隐藏 |
| 布局 | 160px 宽便签窗口标题栏无裁切 |
| 可读性 | 背景不透明度 30% 时正文对比度仍满足 AA |
| 同步刷新 | 手机端修改/删除后，桌面已打开便签 30 秒内更新/关闭 |
| 兼容 | 旧便签数据、旧设置、旧窗口尺寸无需迁移 |

---

## 2. 非目标

本阶段明确不做：

- 便签窗口的完整视觉重构（Phase 1：hover 工具栏、Popover 重做、冷色便签板、收起/展开）；
- 列表与设置页的完整改版（Phase 2：卡片网格、侧栏、Toast、快捷键录制）；
- 便签颜色板迁移（Phase 1）；
- 字号、标题、图片、最近删除、提醒升级、贴边收纳、命令面板（P1）；
- 原生 acrylic 材质（仅作为 Phase 1 可选 spike）；
- 移动端视觉与默认地址清理（Phase 3）；
- 同步协议、HTTPS、冲突副本、服务端改动；
- 数据库结构改动；
- 自动更新。

---

## 3. 现状分析

### 3.1 相关入口与调用链

| 领域 | 现状 | 关键位置 |
|------|------|----------|
| 同步启动 | 应用启动即 `syncManager.start()`，无 token 时自动注册 | `src/main/index.ts:53,76-86` |
| 默认服务器 | 硬编码公网 IP + HTTP | `src/main/sync.ts:26-28` |
| 同步设置 | 无「启用/禁用」开关，仅服务器地址 | `src/shared/types.ts:39-54`；`src/renderer/components/Settings.tsx:395-514` |
| 同步状态 | `SyncStatus` 无 enabled 字段 | `src/shared/types.ts:75-119` |
| 单实例 | 未调用 `requestSingleInstanceLock` | `src/main/index.ts` 全文件 |
| 启动恢复 | 所有便签隐藏时强制改为可见 | `src/main/windows.ts:284-296` |
| 便签工具栏 | 左侧 8 按钮 + 3 分隔线，右侧 6 按钮；默认窗口 240px | `src/renderer/components/StickerEditor.tsx:136-275`；`src/main/windows.ts:66-71` |
| 透明度 | `win.setOpacity` 作用于整窗 | `src/main/windows.ts:50,210-217` |
| 透明度 UI | 20%–100% | `src/renderer/components/TransparencySlider.tsx:20-28` |
| 同步刷新 | 同步只广播 `STICKER_LIST_CHANGED`，便签编辑器不订阅 | `src/main/index.ts:80-83`；`src/renderer/components/StickerEditor.tsx:68-78` |
| 版本号 | 托盘与设置页硬编码 `v1.1.0` | `src/main/tray.ts:115`；`src/renderer/components/Settings.tsx:518` |
| 视觉 | emoji 图标、`blue-500`/`gray-*` 散落、无 token | 全部 renderer 组件；`src/renderer/styles/globals.css`；`tailwind.config.js` |

### 3.2 数据流

- **本地便签**：Renderer → preload `window.api.sticker` → IPC → `IpcHandlerRegistry` → `StickerStore`（electron-store）→ `StickerWindowManager`。
- **同步**：`SyncManager` 定时 POST `/sync` → 写入 `StickerStore` → 回调 `onDataChanged` → `main/index.ts` 广播 `STICKER_LIST_CHANGED` → 列表窗口刷新；便签窗口无感知。
- **设置**：Renderer → `settings:set` → `StickerStore.setSettings` → 快捷键/自启动/托盘联动。
- **主题**：`nativeTheme.updated` → 广播 `theme:changed` → `useTheme`。

### 3.3 现有测试与工程约束

- 无单元测试、无 E2E、无 lint 脚本。
- 可用验证：`npm run typecheck`、`npx electron-vite build`。
- TypeScript `strict: true`；React 18；Tailwind 3.4；Electron 28（Chromium 120，支持容器查询）。
- `src/types/electron.d.ts` 是手写的 Electron 类型垫片，新增主进程 API 时必须同步补充。
- 主进程与渲染进程通过 `contextBridge` 通信，`contextIsolation: true`、`nodeIntegration: false`。

---

## 4. 参考与复用

### 4.1 直接复用

| 能力 | 位置 | 复用方式 |
|------|------|----------|
| IPC 获取入口 | `src/renderer/utils/api.ts` | 新组件继续通过 `getApi()` 访问，不直接读 `window.api` |
| 便签数据 Hook | `src/renderer/hooks/useSticker.ts` | 增加远程刷新时复用 `reload()` |
| 颜色主题 | `src/renderer/utils/colors.ts` | Phase 0 不改便签色板，仅新增 `withAlpha()` |
| 窗口管理 | `src/main/windows.ts` | 新增 `applyRemoteState()`，复用现有窗口 Map |
| 广播 | `src/main/index.ts` 的 `broadcast` | 新增 `STICKER_CHANGED` 通道 |
| 确认对话框 | `src/renderer/components/ConfirmDialog.tsx` | Phase 0 保留，Phase 2 再换 Radix Dialog |

### 4.2 扩展复用

- `AppSettings` 增加 `syncEnabled`；`SyncStatus` 增加 `enabled`；`SyncAPI` 增加 `setEnabled()`。
- `SyncManager.onDataChanged` 从无参回调改为回传实际变更的 `Sticker[]`，供主进程驱动窗口状态。
- `StickerAPI` 增加 `onChanged()`。

### 4.3 不复用

- 不引入 Ant Design / MUI：现有项目没有组件库依赖，引入会显著增大包体并带来样式冲突。
- 不复制现有 `panel-popover` 手写定位逻辑：改用 Radix Popover 获得外部点击、Esc、焦点管理。
- 不新建第二套颜色常量：便签色板 Phase 1 再迁移，Phase 0 只处理全局 token。

---

## 5. 实现思路

### 5.1 设计基础

1. 新建 `src/renderer/styles/tokens.css`，定义亮/暗两套 CSS 变量（颜色、圆角、动效、阴影）。
2. `globals.css` 引入 tokens，并把 `body` 背景、文字、滚动条改为 token。
3. `tailwind.config.js` 把 token 映射为语义色：`canvas / surface / muted / line / ink / ink-muted / accent / danger`。
4. 新建 `src/renderer/components/ui/`，本阶段只实现会被立即使用的组件：
   - `cn()`、`Button`、`IconButton`、`DropdownMenu`、`Popover`、`Tooltip`、`Switch`、`Slider`、`Chip`。
   - Dialog / Toast / EmptyState / StatusBadge / Skeleton 推迟到首次使用的 Phase 2，避免死代码。
5. 依赖：`lucide-react`、`clsx`、`tailwind-merge`、`@radix-ui/react-dropdown-menu`、`@radix-ui/react-popover`、`@radix-ui/react-tooltip`、`@radix-ui/react-slider`。

### 5.2 图标替换

- 在 `StickerEditor`、`StickerList`、`StickerListItem`、`Settings`、`SearchBar`、`TagFilter`、`TagInput`、`ReminderPicker`、`TransparencySlider` 中替换功能 emoji。
- 图标按钮统一使用 `IconButton`，必须带 `aria-label` + `Tooltip`。
- 不改变任何业务行为。

### 5.3 同步开关

1. `AppSettings` 增加 `syncEnabled: boolean`，`DEFAULT_SETTINGS` 为 `false`。
2. `SyncManager` 读取设置判断是否启用：
   - 新安装：设置中显式 `false` → 不注册、不启动定时器、不发网络请求；
   - 升级用户：旧设置对象没有该字段（`undefined`）且本地已有 token → 视为 `true`，保持原有配对不中断；
   - 旧设置对象没有该字段且无 token → 视为 `false`。
3. 新增 `setEnabled(enabled)`：
   - 开启：要求服务器地址非空；无 token 则注册；启动定时同步；
   - 关闭：停止定时器，保留 token 与服务器地址，便于再次开启。
4. `getStatus()` 返回 `enabled`；`syncNow()`、`createPairingCode()` 在未启用时直接返回/抛出明确错误。
5. 新增 IPC `sync:set-enabled` 与 preload `sync.setEnabled()`。
6. 设置页增加「启用手机同步」Switch；关闭时隐藏同步操作区，开启且地址为空时提示填写地址。
7. 移除硬编码默认公网地址，仅保留 `STICKERNOTE_SERVER_URL` 环境变量作为本地调试覆盖。

### 5.4 单实例

- 在模块加载阶段调用 `app.requestSingleInstanceLock()`。
- 未获得锁：立即 `app.quit()`，不注册 `whenReady` 初始化。
- 获得锁：监听 `second-instance`，若窗口管理器已初始化则打开列表窗口。

### 5.5 启动可见性

- 删除 `restoreAllWindows()` 中「全部隐藏则强制显示」的逻辑。
- 仍保留：
  - 无任何便签（含墓碑）→ 创建欢迎便签；
  - 有可见便签 → 只恢复可见的；
  - 全部隐藏 → 不创建窗口，仅保留托盘。

### 5.6 工具栏溢出

Phase 0 采用稳定方案：

- 标题栏常驻：拖拽点、`⋯` 菜单、`✕`。
- 窗口宽度 ≥ 240px 时，悬停/聚焦额外显示：加粗、斜体、待办、提醒（CSS 容器查询控制）。
- `⋯` 菜单包含：加粗、斜体、无序/有序列表、待办、撤销/重做、字体颜色、换色、标签、提醒、置顶、透明度。
- 颜色/标签/提醒/透明度面板改用 Radix Popover，支持点击外部与 Esc 关闭。
- 160px 宽时仅常驻 3 个按钮，所有能力仍可通过菜单访问。

### 5.7 背景透明度

- 移除 `BrowserWindow` 的 `opacity` 选项与 `win.setOpacity()` 调用。
- Renderer 读取 `sticker.opacity`，计算 `alpha = clamp(opacity, 0.35, 1)`，通过 `withAlpha(bgColor, alpha)` 设置窗口背景。
- 文字颜色不带 alpha，保持 100% 不透明。
- 透明度滑杆范围改为 30%–100%，标签改为「背景不透明度」；旧值 20%–29% 按 30% 显示。

### 5.8 同步刷新已打开便签

1. `SyncManager.applyServerChanges()` 返回实际写入本地的 `Sticker[]`。
2. `main/index.ts` 的 `onDataChanged` 回调：
   - 广播 `STICKER_LIST_CHANGED`；
   - 对每条变更：
     - `deletedAt` 非空 → 关闭对应窗口，取消提醒；
     - `isVisible === false` 且窗口存在 → 隐藏；
     - `isVisible === true` 且窗口已存在 → 显示（不为远程便签新建窗口，避免弹窗风暴）；
     - 置顶状态变化 → 直接设置窗口 `setAlwaysOnTop`，**不写回 store**，避免 `updatedAt` 被刷新导致同步回环；
     - 提醒变化 → 重新调度；
     - 广播 `STICKER_CHANGED(id)`。
3. 本地便签更新（内容/颜色/标签/提醒/置顶/透明度）后也广播 `STICKER_CHANGED(id)`。
4. `StickerEditor` 订阅 `onChanged`：
   - 仅处理与自身 id 匹配的事件；
   - 调用 `useSticker.reload()`；
   - 若取回 `null`（已删除），保留主进程关窗行为，不额外渲染；
   - 若编辑器正在聚焦输入，不强制覆盖内容，避免打断输入（冲突处理留到 Phase 3）。

### 5.9 版本号

- `vite.config.ts` 从 `package.json` 读取版本并注入 `__APP_VERSION__`。
- Renderer 设置页使用 `__APP_VERSION__`。
- 主进程托盘使用 `app.getVersion()`。

---

## 6. 职责边界

| 模块 | 负责 | 不负责 |
|------|------|--------|
| `styles/tokens.css` | 定义 CSS 变量 | 组件样式、业务逻辑 |
| `components/ui/*` | 展示、交互状态、可访问性 | 数据访问、IPC、业务规则 |
| `StickerEditor` | 组合编辑器与工具、响应用户操作 | 直接读写存储、网络 |
| `useSticker` | 单条便签的数据读写与远程刷新 | 窗口创建、同步调度 |
| `Settings` | 设置项展示与用户意图提交 | 网络注册、窗口管理 |
| `SyncManager` | 启用状态、凭证、网络同步、变更计算 | 窗口显隐、UI 广播 |
| `IpcHandlerRegistry` | IPC 编排、广播 | 网络细节、窗口布局 |
| `StickerWindowManager` | 窗口生命周期、远程窗口状态应用 | 同步网络、设置持久化 |
| `StickerStore` | 数据持久化 | 窗口管理、网络 |
| `preload` | 类型化桥接 | 业务判断 |
| `shared/types.ts` | 跨进程契约 | 运行逻辑 |

接口方向：Renderer → preload → IPC → 主进程服务；主进程不得依赖 Renderer 实现。

---

## 7. 接口与数据

### 7.1 设置模型

```ts
export interface AppSettings {
  shortcutNew: string;
  shortcutList: string;
  defaultColor: StickerColor;
  themeMode: 'system' | 'light' | 'dark';
  autoStart: boolean;
  /** 是否启用手机同步；默认 false。旧数据缺省时按“是否已有 token”推断 */
  syncEnabled: boolean;
}
```

- 存储：`electron-store` 的 `settings` 对象，无数据库变更。
- 默认值：`syncEnabled: false`。
- 兼容：旧设置对象无该字段时保持 `undefined`，由 `SyncManager` 推断，不批量回写。

### 7.2 同步状态与 API

```ts
export interface SyncStatus {
  enabled: boolean;
  linked: boolean;
  serverUrl: string;
  pairingServerUrl: string;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface SyncAPI {
  // 既有方法...
  setEnabled(enabled: boolean): Promise<SyncStatus>;
}
```

- 新增 IPC：`SYNC_SET_ENABLED = 'sync:set-enabled'`。
- `setEnabled(true)` 无服务器地址时抛出 `请先填写同步服务器地址`。
- `setEnabled(false)` 不清理 token、不删除服务器地址。

### 7.3 便签变更事件

```ts
export interface StickerAPI {
  // 既有方法...
  onChanged(callback: (id: string) => void): () => void;
}
```

- 新增 IPC：`STICKER_CHANGED = 'sticker:changed'`，载荷为便签 id。
- 订阅方按 id 过滤，避免所有窗口重复拉取。

### 7.4 主进程内部接口

```ts
// SyncManager
onDataChanged(listener: (changed: Sticker[]) => void): void;

// StickerWindowManager
applyRemoteState(sticker: Sticker): void;
```

- `applyRemoteState` 只调整已存在窗口的显示/隐藏/置顶，不创建新窗口、不写 store。

### 7.5 版本注入

- `__APP_VERSION__: string`，由 Vite `define` 注入。
- Renderer 新增全局声明；主进程使用 `app.getVersion()`。

### 7.6 数据迁移

- 无数据库变更。
- 无便签字段变更。
- 设置新增字段采用「缺省推断」，不执行写迁移。
- 透明度语义变化在渲染层完成，存储值不变。

---

## 8. 边界与异常

| 场景 | 预期行为 |
|------|----------|
| 新安装、未开启同步 | 不注册、不请求、状态显示「未启用」 |
| 旧用户已有 token、无 syncEnabled 字段 | 自动视为启用，继续同步 |
| 旧用户无 token、无字段 | 视为未启用 |
| 开启同步但地址为空 | 抛出「请先填写同步服务器地址」，UI 提示 |
| 地址非法（非 http/https） | `setServerUrl` 拒绝并提示 |
| 关闭同步时正在同步 | 停止后续定时器；当前请求允许完成，结果不再触发新循环 |
| 关闭后再次开启 | 复用原 token 与地址；token 失效则请求报错并展示 |
| 第二次启动应用 | 第二实例退出；已有实例打开列表窗口 |
| 无便签 | 创建欢迎便签并显示 |
| 全部便签隐藏后重启 | 不创建任何便签窗口；托盘可用 |
| 全部便签已软删除 | 视为无便签，创建欢迎便签 |
| 便签宽度 160px | 仅显示拖拽点、`⋯`、`✕`，无横向溢出 |
| 透明度 20%（旧数据） | 按 35% 背景 alpha 渲染，正文不透明 |
| 远程删除便签时窗口打开 | 关闭窗口并取消提醒 |
| 远程隐藏便签 | 已存在窗口隐藏；不创建新窗口 |
| 远程设为可见但本机无窗口 | 不自动弹窗，等待用户从列表打开或重启恢复 |
| 远程更新时用户正在输入 | 不覆盖当前编辑内容；以本地后续保存为准（已知限制，Phase 3 解决冲突） |
| 同一便签快速连续更新 | 广播只带 id，编辑器按 id 合并；`useAutoSave` 防抖避免频繁写 |
| 窗口已销毁 | 所有窗口操作先判 `isDestroyed()` |
| 广播自触发 | 编辑器已持有最新内容，`setContent` 前比较内容，避免回环 |

---

## 9. 风险与兼容性

| 风险 | 影响 | 应对 |
|------|------|------|
| 默认关闭同步改变现有用户行为 | 升级后不同步 | 旧数据按 token 推断启用；设置页明确展示开关与状态 |
| 移除整窗透明度后视觉变化 | 用户觉得“没以前透” | 背景 alpha 可调至 35%，正文更清晰；设置说明文案 |
| Radix 增加包体 | 启动变慢 | 按需引入，预计 gzip +40–70KB；构建后检查产物 |
| 工具栏结构调整引入回归 | 编辑操作不可用 | 保留原有 handler；逐项手动回归 |
| 容器查询兼容性 | 窄窗口布局异常 | Electron 28 = Chromium 120，已支持；提供常驻菜单兜底 |
| 同步广播回环 | 无限刷新 | 仅广播 id；不写回 store；内容比较守卫 |
| 远程可见状态触发弹窗 | 打扰用户 | 只为已存在窗口应用显示状态，不新建 |
| 无自动化测试 | 回归风险 | 严格执行 typecheck + build + 手动清单；不宣称自动化验证 |
| 手写 Electron 类型垫片缺 API | 编译失败 | 同步补充 `requestSingleInstanceLock`、`getVersion` 等声明 |

**回滚**：Phase 0 的改动可按文件分组回退；`syncEnabled` 为新增字段，回退后旧代码忽略该字段，不影响数据。透明度存储值未变，回退后旧逻辑仍可读取。

---

## 10. 验证策略

### 10.1 自动化

项目当前无测试框架，本阶段不引入大型测试设施。执行：

1. `npm run typecheck`：TypeScript 严格检查通过。
2. `npx electron-vite build`：主进程、preload、renderer 均构建成功。
3. 构建产物检查：`out/main/index.js`、`out/preload/index.js`、`out/renderer/index.html` 存在。

> 若上述命令因环境原因无法执行，必须逐项记录阻塞原因、已完成检查与剩余风险，不得宣称验证完成。

### 10.2 手动验收

**同步隐私**

- [ ] 删除本地同步凭证后首次启动，抓包/观察日志确认无 `/devices/register` 与 `/sync` 请求。
- [ ] 设置页默认显示「未启用」，开启时若地址为空给出提示。
- [ ] 已有 token 的旧配置升级后仍保持同步（可用旧版 `stickernote-sync.json` 模拟）。

**单实例**

- [ ] 启动两次，任务管理器只有一个进程组；第二次启动打开列表窗口。

**启动可见性**

- [ ] 隐藏全部便签 → 退出 → 启动：无便签窗口，托盘存在。
- [ ] 删除全部便签 → 重启：出现欢迎便签。

**工具栏与透明度**

- [ ] 将便签窗口拖到最小宽度（160px）：标题栏无裁切，菜单可打开全部操作。
- [ ] 背景不透明度 30%：正文清晰可读；窗口透出桌面背景。
- [ ] 旧便签 opacity=0.2：按 35% 渲染，文字不透明。

**同步刷新**

- [ ] 桌面打开便签 A，手机修改 A 内容 → 30 秒内桌面内容更新。
- [ ] 手机删除 A → 桌面 A 窗口关闭。
- [ ] 手机隐藏 A → 桌面 A 窗口隐藏。
- [ ] 手机置顶 A → 桌面窗口置顶状态变化，且不会触发新的同步写入。

**图标与视觉基础**

- [ ] 三个界面无功能类 emoji。
- [ ] 亮/暗色切换后，新组件颜色来自 token，无突兀硬编码色。
- [ ] 所有图标按钮有 Tooltip 与 `aria-label`。

**构建**

- [ ] `npm run typecheck` 通过。
- [ ] `npx electron-vite build` 通过。
- [ ] `npm run dev` 可正常启动并操作便签。

---

## 11. 关键决策（需确认）

1. **Phase 0 只实现会被立即使用的 UI 组件**（Button / IconButton / DropdownMenu / Popover / Tooltip / Switch / Slider / Chip），Dialog/Toast/EmptyState/StatusBadge/Skeleton 推迟到 Phase 2。
2. **同步默认关闭**：新安装显式 `false`；旧配置无该字段时，有 token 视为开启、无 token 视为关闭。
3. **移除硬编码公网地址**：开启同步必须由用户填写服务器地址；环境变量仅用于本地调试。
4. **透明度语义**：`opacity` 改为背景不透明度，渲染时 clamp 到 0.35–1；UI 滑杆 30%–100%。
5. **工具栏 Phase 0 方案**：常驻拖拽点、`⋯`、`✕`；≥240px 时悬停显示 B/I/待办/提醒；其余进菜单。
6. **同步刷新**：远程可见状态只为已存在窗口应用，不自动新建窗口；远程删除会关闭窗口。
7. **Phase 0 不改移动端与服务端**；移动端默认地址与视觉对齐留到 Phase 3。
