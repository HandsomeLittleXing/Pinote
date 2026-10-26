# Phase 1 功能设计文档：便签窗口冷色玻璃与收起展开

> 上级方案：`docs/UI-REDESIGN-PLAN.md`
> 前置阶段：`docs/design/2026-10-24-phase0-foundation-design.md`（已完成）
> 版本：v1.0 · 日期：2026-10-24 · 状态：待确认
> 范围：桌面端便签窗口的冷色板、玻璃质感、收起/展开、字号入口

---

## 1. 背景与目标

### 1.1 背景

Phase 0 已建立冷色 token、基础组件、Lucide 图标，并修复了工具栏溢出、背景透明度、单实例等 P0。当前便签窗口仍有两个明显短板：

1. **便签色板仍是 2014 风格的暖色粉彩**，暗色模式下的 `#BDB76B` 等颜色发脏，与冷色极简玻璃方向冲突。
2. **窗口缺少收起/展开能力**，便签多时只能隐藏，无法像桌面贴纸一样收成一条彩条；同时字号能力已有 Tiptap 扩展但没有入口。

### 1.2 目标

1. 用 8 个低饱和冷色替换现有粉彩，并提供亮/暗两套背景与文字色。
2. 旧便签不迁移数据即可按新色板渲染；新建便签写入新色值。
3. 便签窗口增加玻璃高光、发丝边、柔和阴影和右下角 resize 提示。
4. 增加收起/展开：收起为 34px 彩条，展开恢复原高度；双击标题栏可切换。
5. 增加字号子菜单（12–24px / 默认），补齐 README 已声明但缺失的能力。
6. 不修改服务端、移动端、数据库与同步协议。

### 1.3 成功标准

| 维度 | 标准 |
|------|------|
| 色板 | 8 个冷色亮/暗背景与文字对比度达到 AA；暗色不再出现脏黄/脏褐 |
| 兼容 | 旧色值 `#FFF9C4` 等无需迁移即可按新色渲染；新便签写入新色值 |
| 玻璃 | 亮/暗模式均有顶部高光、发丝边、柔和阴影；文字始终不透明 |
| 收起 | 收起后窗口约 34px；编辑区隐藏；展开恢复收起前高度 |
| 交互 | 160px 宽标题栏不溢出；双击标题栏切换收起；收起态菜单可用 |
| 字号 | 菜单可选 12/14/16/20/24px 或恢复默认；HTML 内容可同步 |
| 范围 | 不改 server / mobile / DB / 同步协议 |

---

## 2. 非目标

- 列表页与设置页的完整改版（Phase 2：卡片网格、侧栏、自定义标题栏）。
- 收起状态跨重启持久化（本阶段只做会话内状态；不写 `WindowState`、不写数据库、不参与同步）。
- 原生 Windows acrylic 正式上线（仅做技术 spike；不满足条件则只保留 CSS 玻璃）。
- 移动端色板对齐（Phase 3；当前移动端仍使用旧色列表，但能正常显示新背景色）。
- 字号以外的富文本扩展（标题、高亮、图片）。
- 新主题/自定义颜色/渐变便签。
- 拖拽排序、标签管理、提醒升级。

---

## 3. 现状分析

### 3.1 相关入口与调用链

| 领域 | 现状 | 位置 |
|------|------|------|
| 便签色板 | 8 个暖色/粉彩，暗色使用偏脏的深色 | `src/renderer/utils/colors.ts:4-13` |
| 颜色类型 | `StickerColor` 为 8 个十六进制联合类型 | `src/shared/types.ts:27-36` |
| 颜色主题接口 | `ColorTheme` 只有 `name/color/darkColor/textColor` | `src/shared/types.ts:59-65` |
| 默认颜色 | `#FFF9C4` | `src/shared/types.ts:50-57` |
| 新建便签 | 直接使用 `settings.defaultColor`，不做归一化 | `src/main/store.ts:53-72` |
| 便签渲染 | `getBackgroundColor`/`getTextColor` + `withAlpha` | `src/renderer/components/StickerEditor.tsx` |
| 颜色选择器 | 直接比较 `currentColor === theme.color` | `src/renderer/components/ColorPicker.tsx` |
| 设置默认色 | 亮色圆点，暗色模式下仍显示亮色 | `src/renderer/components/Settings.tsx:356-380` |
| 列表色块 | 固定使用亮色 + 亮色文字 | `src/renderer/components/StickerListItem.tsx:47-56` |
| 窗口创建 | 固定 `minHeight: 120`，无收起逻辑 | `src/main/windows.ts:38-55` |
| 窗口保存 | `saveBounds` 每次 resize 都写入完整宽高 | `src/main/windows.ts:66-97` |
| 窗口 API | 只有 `saveState` / `close` | `src/shared/types.ts:138-141` |
| IPC | 只有 `WINDOW_SAVE_STATE` / `WINDOW_CLOSE` | `src/shared/ipc-channels.ts:18-19` |
| 字号扩展 | `FontSize` 与 `FONT_SIZES` 已存在，但无 UI | `src/renderer/extensions/index.ts:7-51,98-104` |
| 下拉菜单 | 无 Submenu 封装 | `src/renderer/components/ui/DropdownMenu.tsx` |
| 移动端色板 | 硬编码旧 8 色 | `mobile/src/screens/StickerEditorScreen.tsx:15-24` |

### 3.2 数据流

- **颜色**：`Sticker.color`（hex 字符串）随便签同步到服务端 `stickers.color` 与移动端 SQLite；渲染时由桌面端映射为亮/暗背景与文字色。
- **窗口状态**：`WindowState { x, y, width, height }` 保存在本地并随便签同步；`saveBounds` 在 move/resize 后 300ms 写入。
- **字号**：Tiptap 以 inline `style="font-size: 20px"` 写入 HTML，随内容同步；移动端 pell 编辑器按 HTML 渲染。
- **收起**：本阶段只在主进程内存中记录，不进入 `WindowState`，不写 store，不参与同步。

### 3.3 现有约束

- Electron 28 / Chromium 120；Windows 10/11；透明无边框窗口。
- `backdrop-filter` 只能采样同一窗口内的内容，不能透出桌面；CSS 玻璃以分层高光为基线。
- 原生 `backgroundMaterial: 'acrylic'` 仅 Windows 11 22H2+，且与 `transparent`/圆角组合需实测。
- 无测试框架；验证依赖 `typecheck`、`electron-vite build` 与隔离 userData 的 CDP UI 冒烟。
- 服务端 `stickers.color` 为字符串、`window_state` 为 JSON，本阶段无需改表。

---

## 4. 参考与复用

### 4.1 直接复用

| 能力 | 位置 |
|------|------|
| 颜色转换/透明度 | `src/renderer/utils/colors.ts` 的 `withAlpha`、`clampOpacity` |
| 主题 Hook | `src/renderer/hooks/useTheme.ts` |
| 图标按钮/菜单/浮层 | `src/renderer/components/ui/*` |
| 字号扩展 | `src/renderer/extensions/index.ts` 的 `FontSize`、`FONT_SIZES` |
| 窗口 Map 与贴边 | `src/main/windows.ts` |
| 窗口 API / IPC 模式 | `WindowAPI` + `preload` + `ipc-handlers` |

### 4.2 扩展复用

- 把色板数据提取到 `src/shared/palette.ts`，主进程与渲染进程共用：
  - `STICKER_PALETTE`
  - `LEGACY_COLOR_MAP`
  - `resolveStickerColor()`
  - `normalizeStickerColor()`
- `ColorTheme` 增加 `key`、`darkTextColor`。
- `WindowAPI` 增加 `setCollapsed()`；新增 IPC `WINDOW_SET_COLLAPSED`。
- `DropdownMenu` 增加 Radix Submenu 封装，用于字号子菜单。
- `StickerWindowManager` 增加会话内收起状态与高度记忆。

### 4.3 不复用

- 不在渲染层硬编码第二份色板：避免主进程归一化与渲染映射漂移。
- 不把收起状态塞进 `WindowState`：避免改变同步与移动端数据语义；本阶段明确只做会话内。
- 不引入新动画库：CSS transition + Radix 现成动画足够。
- 不做原生 acrylic 的强制依赖：CSS 玻璃必须独立成立。

---

## 5. 实现思路

### 5.1 冷色板

新增 `src/shared/palette.ts`，定义 8 个颜色：

| key | 名称 | 亮色背景 | 亮色文字 | 暗色背景 | 暗色文字 |
|-----|------|----------|----------|----------|----------|
| `ice` | 冰川 | `#DFECFB` | `#1E3A5F` | `#1C2A3D` | `#DDE8F7` |
| `lake` | 湖蓝 | `#DCEDF3` | `#1F4650` | `#193238` | `#D8ECF1` |
| `mint` | 薄荷 | `#DFF2EC` | `#1F4A3D` | `#173029` | `#D8F0E8` |
| `rose` | 冷粉 | `#F5E6ED` | `#5A2A3D` | `#352631` | `#F5E3EA` |
| `sage` | 鼠尾草 | `#E6EEE3` | `#33472F` | `#243027` | `#E4F0E0` |
| `lilac` | 雾紫 | `#EAE5F8` | `#3B2F63` | `#28243A` | `#E8E3FA` |
| `frost` | 霜白 | `#FFFFFF` | `#0F172A` | `#1A2230` | `#E6EDF7` |
| `cloud` | 云灰 | `#ECEFF4` | `#334155` | `#232B35` | `#E5ECF4` |

旧值映射（只用于渲染与归一化，不批量改数据）：

```
#FFF9C4 → ice    #BBDEFB → lake
#C8E6C9 → mint   #F8BBD0 → rose
#FFE0B2 → sage   #E1BEE7 → lilac
#FFFFFF → frost  #E0E0E0 → cloud
```

行为：

- `resolveStickerColor(color)`：新值直接查表；旧值走映射；未知值回退 `ice`。
- `normalizeStickerColor(color)`：返回映射后的新 hex，用于**新建便签**。
- `DEFAULT_SETTINGS.defaultColor` 改为 `#DFECFB`（ice）。
- 旧便签数据保持原 hex；渲染时解析为新色。用户主动换色后才写入新 hex。
- 移动端暂不改色板；旧/新 hex 都能作为背景色渲染，但移动端取色器不会把新色标为选中（Phase 3 对齐）。

### 5.2 玻璃质感

便签窗口保持透明无边框，通过分层实现玻璃：

1. **底色层**：`withAlpha(背景色, clampOpacity(opacity))`（保持 Phase 0 语义）。
2. **高光层**：`.sticker-window::before` 顶部白色渐变，暗色为极低透明度白光。
3. **发丝边**：`inset 0 0 0 1px rgba(255,255,255,.45)`；暗色 `rgba(255,255,255,.06)`。
4. **环境阴影**：亮色 `0 10px 30px rgba(15,23,42,.12)`；暗色 `0 16px 44px rgba(0,0,0,.5)`。
5. **工具栏**：顶部白色/黑色渐变 + `blur(18px) saturate(140%)` + 底部分隔线。
6. **resize 提示**：右下角 12×12 点阵/斜线，`pointer-events: none`，悬停时提高不透明度。

圆角统一 16px；收起时形成 34px 高的胶囊彩条。

### 5.3 收起/展开

采用**会话内状态**，不持久化、不写 `WindowState`、不参与同步：

- 主进程 `StickerWindowManager` 增加：
  - `collapsedIds: Set<string>`
  - `expandedHeights: Map<string, number>`
- 收起：
  - 记录当前窗口高度；
  - `setMinimumSize(160, 34)`；
  - `setBounds({ ...bounds, height: 34 })`；
  - `saveBounds` 在收起期间只保存 x/y/width，保留原 height，避免把展开高度覆盖成 34。
- 展开：
  - 从 `expandedHeights` 取回高度，缺省 200，最小 120；
  - `setMinimumSize(160, 120)`；
  - `setBounds({ ...bounds, height })`。
- 关闭/删除窗口时清理两个 Map/Set。
- 应用重启后默认展开（本阶段明确限制）。
- 渲染层：
  - `collapsed` 本地 state；
  - 收起按钮 + 双击标题栏切换；
  - 收起时隐藏编辑区、可选工具组、浮层；菜单只保留「展开 / 置顶 / 隐藏」；
  - 展开时恢复完整菜单（含「收起便签」与字号子菜单）。
- 工具栏所有按钮改为 24px（`IconButton size="sm"`），保证 240px 宽时展开态仍不溢出。

### 5.4 字号子菜单

- 复用 `FONT_SIZES`（12/14/16/20/24px）。
- 在「格式」区域增加「字号」子菜单，选项：12 / 14 / 16 / 20 / 24 / 默认。
- 选择后调用 `editor.chain().focus().setFontSize('20px').run()` 或 `unsetFontSize()`。
- HTML 以 inline style 保存并同步；移动端按 HTML 渲染。

### 5.5 列表与设置色块

- `StickerListItem` 增加 `useTheme()`，色块使用 `getBackgroundColor(sticker.color, isDark)` 与 `getTextColor(sticker.color, isDark)`。
- `Settings` 默认颜色区增加 `useTheme()`，圆点使用当前模式下的背景色。
- `ColorPicker`：
  - 选中判断改为 `resolveStickerColor(currentColor).color === theme.color`；
  - 色点使用 `getBackgroundColor(theme.color, isDark)`。
- `COLOR_THEMES` 由 `STICKER_PALETTE` 派生，供两个选择器共用。

### 5.6 原生 acrylic spike（可选）

- 在 Windows 11 22H2+ 上尝试 `backgroundMaterial: 'acrylic'` + `transparent` + 圆角。
- 若出现黑底、圆角失效、拖拽异常或性能问题，**直接放弃**，不进入正式代码。
- 验收不依赖该能力；CSS 分层玻璃是唯一必达方案。

---

## 6. 职责边界

| 模块 | 负责 | 不负责 |
|------|------|--------|
| `shared/palette.ts` | 色板数据、旧值映射、归一化 | 窗口/组件逻辑 |
| `renderer/utils/colors.ts` | 把色板解析为亮/暗背景与文字色 | 数据存储、同步 |
| `StickerEditor` | 便签 UI、收起交互、字号命令 | 窗口尺寸调整、持久化 |
| `StickerWindowManager` | 窗口收起/展开尺寸、记忆高度 | 渲染层状态、同步 |
| `ipc-handlers` | 把收起请求转给窗口管理器 | 计算高度 |
| `ColorPicker` / `Settings` / `StickerListItem` | 展示当前模式下的色块 | 色板定义 |
| `DropdownMenu` | Submenu 展示 | 字号业务 |
| `store.ts` | 新建便签时归一化颜色 | 旧数据迁移 |

---

## 7. 接口与数据

### 7.1 色板与类型

`src/shared/types.ts`：

```ts
export type StickerColor =
  // 新冷色
  | '#DFECFB' | '#DCEDF3' | '#DFF2EC' | '#F5E6ED'
  | '#E6EEE3' | '#EAE5F8' | '#FFFFFF' | '#ECEFF4'
  // 旧色（兼容读取）
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
```

`src/shared/palette.ts`：

```ts
export const STICKER_PALETTE: ColorTheme[];
export const LEGACY_COLOR_MAP: Record<string, StickerColor>;
export function resolveStickerColor(color: StickerColor): ColorTheme;
export function normalizeStickerColor(color: StickerColor): StickerColor;
```

- 无数据库字段变化；`color` 仍是字符串。
- `DEFAULT_SETTINGS.defaultColor` 改为 `#DFECFB`。
- 旧设置中的 `#FFF9C4` 通过 `resolveStickerColor` 显示为 ice；不写回。

### 7.2 收起接口

`src/shared/types.ts`：

```ts
export interface WindowAPI {
  saveState(state: WindowState): Promise<void>;
  close(): Promise<void>;
  setCollapsed(collapsed: boolean): Promise<void>;
}
```

- 新增 IPC：`WINDOW_SET_COLLAPSED = 'window:set-collapsed'`。
- 载荷：`collapsed: boolean`。
- 主进程从 sender URL 读取便签 id，再调用 `windowManager.setCollapsed(id, collapsed)`。
- 无 `WindowState` 字段变化；收起状态不持久化。

### 7.3 主进程内部

```ts
// StickerWindowManager
setCollapsed(id: string, collapsed: boolean): void;
```

- 常量：`COLLAPSED_HEIGHT = 34`、`MIN_EXPANDED_HEIGHT = 120`、`MIN_WIDTH = 160`。
- `saveBounds` 在收起期间只保存 x/y/width，保留原 height。

### 7.4 字号

- 无接口变化；沿用 Tiptap 命令与 HTML inline style。
- 菜单选项来自 `FONT_SIZES`。

---

## 8. 边界与异常

| 场景 | 预期行为 |
|------|----------|
| 旧便签颜色 | 渲染为新色板对应色；数据不变 |
| 未知颜色值 | 回退 `ice`，不崩溃 |
| 旧默认色设置 | 设置页选中态按映射后的 ice 显示 |
| 新建便签 | 写入归一化后的新 hex |
| 移动端收到新 hex | 作为背景色正常渲染；取色器选中态 Phase 3 处理 |
| 低透明度 + 高光 | 文字仍不透明；高光只叠加在背景层 |
| 收起时窗口高度 | 34px；编辑区不渲染；可选工具组隐藏 |
| 收起时移动窗口 | 保存 x/y/width，保留展开高度 |
| 收起时调整宽度 | 保存 width，高度仍为 34，展开高度不变 |
| 收起后隐藏再显示 | 仍保持收起（同一窗口实例） |
| 收起后重启应用 | 恢复展开（会话内状态，明确限制） |
| 删除收起中的便签 | 关闭窗口并清理收起 Map/Set |
| 双击按钮 | 不触发收起；仅标题栏空白区域双击生效 |
| 收起态打开菜单 | 仅显示展开/置顶/隐藏，不打开需要高度的 Popover |
| 160px 宽展开态 | 常驻 4 个 24px 按钮，无横向溢出 |
| 240px 宽展开态 | 悬停时可选 4 个按钮仍能放下 |
| 字号无选区 | 对光标后续输入生效；菜单关闭后聚焦编辑器 |
| 清除字号 | 调用 `unsetFontSize`，不破坏其他 textStyle |
| 原生 acrylic 不可用 | 回退 CSS 玻璃，不影响功能 |

---

## 9. 风险与兼容性

| 风险 | 影响 | 应对 |
|------|------|------|
| 旧色值回退 | 回滚代码后新色值可能显示为黄色 | 新色值仍在 `StickerColor` 联合类型中；回滚前先确认；不做数据迁移 |
| 移动端取色器不同步 | 新色在手机上不显示选中 | 背景色正常；Phase 3 对齐色板 |
| 收起状态不持久 | 重启后展开 | 明确产品限制；后续如需持久化再扩展 WindowState |
| `setBounds` 触发 resize 覆盖高度 | 展开高度丢失 | 收起期间 `saveBounds` 只保存 x/y/width |
| 透明窗口 + 原生 acrylic | 黑底/圆角异常 | 仅做 spike，失败即放弃 |
| 玻璃层太多 | 多便签时 GPU 压力 | 每窗仅一层高光 + 工具栏 blur；不动画 blur |
| 字号 inline style 与移动端兼容 | 显示差异 | 使用标准 `font-size` inline style；Phase 3 验证 |
| 菜单更长 | 需要滚动 | 字号放子菜单；菜单保留滚动 |
| 对比度 | 部分冷色文字偏淡 | 色板文字色按 AA 选取；实现后做对比度检查 |

---

## 10. 验证策略

### 10.1 自动化

- `npm run typecheck`
- `npx electron-vite build`
- 无新增测试框架；沿用隔离 userData + Playwright CDP 的 UI 冒烟方式。

### 10.2 UI 冒烟

- 8 个冷色在亮/暗模式下渲染正确；文字对比度达到 AA。
- 旧 hex（如 `#FFF9C4`）渲染为 ice；ColorPicker 选中态正确。
- 设置页默认色圆点在暗色模式下使用暗色板。
- 列表色块在暗色模式下使用暗色板。
- 收起：点击后 `window.innerHeight ≈ 34`，编辑区消失；展开恢复原高度；双击标题栏可切换。
- 收起态菜单仅含展开/置顶/隐藏。
- 160px / 240px 宽标题栏无横向溢出（`scrollWidth <= clientWidth`）。
- 字号：选中文字应用 20px，HTML 出现 `font-size: 20px`；清除后恢复。
- 右下角 resize 提示存在且不阻挡原生缩放。
- 暗色模式无脏黄/脏褐；玻璃高光与发丝边可见。
- 无渲染层 pageerror / console error（预期错误除外）。

### 10.3 未覆盖

- 原生 acrylic：只在 Windows 11 22H2+ 手动 spike，不作为验收项。
- 移动端色板对齐：Phase 3。
- 收起状态持久化：本阶段非目标。

---

## 11. 关键决策（需确认）

1. **色板**：采用上表 8 个冷色；旧值运行时映射，不迁移数据；新建便签写入新 hex；默认色改为 ice。
2. **收起/展开**：会话内状态，不写 `WindowState`、不参与同步；重启后恢复展开。
3. **窗口高度**：收起 34px；展开最小 120px；收起期间只保存 x/y/width。
4. **字号**：使用现有 `FONT_SIZES`（12–24px）+ 默认，放入「格式」子菜单。
5. **玻璃**：CSS 分层玻璃为必达方案；原生 acrylic 仅 spike，不作为验收项。
6. **范围**：不改服务端、移动端、数据库、同步协议；移动端色板对齐留到 Phase 3。
7. **工具栏**：全部按钮改为 24px；收起态菜单最小化；双击标题栏切换收起。
