# StickerNote 优化与视觉重构方案

> 版本：v1.0 · 日期：2026-10-24 · 状态：待评审
> 视觉方向：**Cold Minimal Glass（冷色极简玻璃）**
> 范围：桌面端优先，移动端在第三期对齐；同时包含 P0 功能修复与后续功能路线

---

## 0. 摘要

### 0.1 目标

1. **修掉影响可信度的 P0 问题**：默认同步隐私、便签工具栏溢出、重启后强制显示、单实例锁、整窗透明度。
2. **建立统一设计体系**：用设计 token + 图标系统替代 emoji 与散落的 Tailwind 硬编码。
3. **重构三个核心界面**：便签窗口、便签列表、设置页，统一为冷色极简玻璃语言。
4. **保证可用性不退化**：对比度、键盘操作、低性能模式、旧数据兼容。

### 0.2 非目标

- 不在本方案内重写同步协议或数据层（仅做必要修复）。
- 不引入完整 UI 框架（如 Ant Design / MUI），保持轻量。
- 不做品牌换标、插画系统、营销页。

### 0.3 成功标准

| 维度 | 标准 |
|------|------|
| 视觉一致性 | 三个界面共用一套 token；无 emoji 功能图标；亮/暗色均通过检查 |
| 可用性 | 160px 宽便签窗口无按钮裁切；20% 透明度下正文仍可读 |
| 稳定性 | 单实例运行；重启不改变用户隐藏状态；同步默认不自动上传 |
| 性能 | 列表滚动 60fps；空闲 CPU < 1%；玻璃层数受控 |
| 兼容性 | 旧便签颜色、旧窗口尺寸、旧设置无需迁移即可正常显示 |

---

## 1. 设计方向：冷色极简玻璃

### 1.1 关键词

**冷静、通透、克制、层次感、低饱和。**

- 背景是冷灰蓝，不是纯白或暖米色；
- 表面是半透明磨砂玻璃，靠 **层次 + 发丝边 + 柔和阴影** 区分，而不是粗边框；
- 主色只保留一个「冰川蓝」，青色仅用于极少量装饰渐变；
- 图标统一线性风格，去掉 emoji；
- 动效短、轻、只用于反馈，不做炫技动画；
- 留白优先，信息密度低于当前版本。

### 1.2 色彩系统

#### 1.2.1 全局 Token（亮色）

| Token | 值 | 用途 |
|-------|----|------|
| `--bg` | `244 247 250` / `#F4F7FA` | 应用底色（冷灰蓝） |
| `--bg-subtle` | `237 242 247` / `#EDF2F7` | 次级底色、分组区 |
| `--surface` | `255 255 255` | 实心表面 |
| `--surface-muted` | `241 245 249` / `#F1F5F9` | 输入框、次级按钮底 |
| `--text` | `15 23 42` / `#0F172A` | 主文字 |
| `--text-muted` | `100 116 139` / `#64748B` | 次要文字 |
| `--text-subtle` | `148 163 184` / `#94A3B8` | 占位符、装饰性文字（不用于正文） |
| `--border` | `15 23 42`（配 alpha 0.08） | 发丝边 |
| `--accent` | `47 111 237` / `#2F6FED` | 主色（冰川蓝） |
| `--accent-hover` | `30 90 209` / `#1E5AD1` | 主色悬停 |
| `--accent-soft` | `47 111 237`（alpha 0.10） | 选中底色、浅色按钮 |
| `--cyan` | `34 211 238` / `#22D3EE` | 仅装饰渐变，不用于文字 |
| `--success` | `4 120 87` / `#047857` | 成功文字 |
| `--warning` | `180 83 9` / `#B45309` | 警告文字 |
| `--danger` | `220 38 38` / `#DC2626` | 危险文字/按钮 |

#### 1.2.2 全局 Token（暗色）

| Token | 值 | 用途 |
|-------|----|------|
| `--bg` | `11 18 32` / `#0B1220` | 应用底色 |
| `--bg-subtle` | `14 21 37` / `#0E1525` | 次级底色 |
| `--surface` | `20 30 48` / `#141E30` | 实心表面 |
| `--surface-muted` | `26 38 58` / `#1A263A` | 输入框、次级按钮底 |
| `--text` | `230 237 247` / `#E6EDF7` | 主文字 |
| `--text-muted` | `143 162 184` / `#8FA2B8` | 次要文字 |
| `--text-subtle` | `100 116 139` / `#64748B` | 占位符 |
| `--border` | `148 163 184`（配 alpha 0.14） | 发丝边 |
| `--accent` | `106 165 255` / `#6AA5FF` | 主色 |
| `--accent-hover` | `133 183 255` / `#85B7FF` | 主色悬停 |
| `--accent-soft` | `106 165 255`（alpha 0.16） | 选中底色 |
| `--success` | `52 211 153` / `#34D399` | 成功 |
| `--warning` | `251 191 36` / `#FBBF24` | 警告 |
| `--danger` | `248 113 113` / `#F87171` | 危险 |

> 暗色不使用纯黑 `#000`，也不使用当前偏褐的 `#BDB76B` 等脏色。

### 1.3 便签色彩迁移

当前 8 个暖色/粉彩改为 8 个低饱和冷色。**便签之间仍可区分，但材质统一为玻璃。**

| 键 | 名称 | 亮色背景 | 亮色文字 | 暗色背景 | 暗色文字 |
|----|------|----------|----------|----------|----------|
| `ice` | 冰川 | `#DFECFB` | `#1E3A5F` | `#1C2A3D` | `#DDE8F7` |
| `lake` | 湖蓝 | `#DCEDF3` | `#1F4650` | `#193238` | `#D8ECF1` |
| `mint` | 薄荷 | `#DFF2EC` | `#1F4A3D` | `#173029` | `#D8F0E8` |
| `rose` | 冷粉 | `#F5E6ED` | `#5A2A3D` | `#352631` | `#F5E3EA` |
| `sage` | 鼠尾草 | `#E6EEE3` | `#33472F` | `#243027` | `#E4F0E0` |
| `lilac` | 雾紫 | `#EAE5F8` | `#3B2F63` | `#28243A` | `#E8E3FA` |
| `frost` | 霜白 | `#FFFFFF` | `#0F172A` | `#1A2230` | `#E6EDF7` |
| `cloud` | 云灰 | `#ECEFF4` | `#334155` | `#232B35` | `#E5ECF4` |

**旧值兼容映射**（不重写用户数据，只在渲染时解析）：

```
#FFF9C4 → ice    #BBDEFB → lake
#C8E6C9 → mint   #F8BBD0 → rose
#FFE0B2 → sage   #E1BEE7 → lilac
#FFFFFF → frost  #E0E0E0 → cloud
```

实现建议：

- `src/shared/types.ts` 的 `StickerColor` 扩展为「新色 + 旧色」联合类型；
- 新增 `resolveStickerColor(color)`，旧值返回新色配置；
- 新建便签只写入新色值；
- 移动端同步使用同一张映射表，避免显示为未选中状态。

### 1.4 玻璃材质规范

玻璃由 **4 层** 组成，缺一不可：

1. **底色层**：冷灰蓝或便签色，带轻度透明；
2. **高光层**：顶部白色线性渐变（亮色）或顶部微光（暗色）；
3. **发丝边**：1px 半透明边框 + 顶部内高光；
4. **阴影层**：低透明度、大扩散的环境阴影。

```css
.glass {
  background:
    linear-gradient(180deg, rgb(var(--glass-hi) / 0.72), rgb(var(--glass-lo) / 0.52)),
    rgb(var(--surface) / 0.55);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
  backdrop-filter: blur(16px) saturate(140%);
  border: 1px solid rgb(var(--border) / 0.08);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.75),
    0 1px 2px rgb(15 23 42 / 0.06),
    0 12px 32px rgb(15 23 42 / 0.08);
}
```

> **重要技术边界**：Electron/Chromium 的 `backdrop-filter` 只能模糊**同一窗口内**位于其下层的内容，不能采样桌面壁纸。真正的「透出桌面」需要 Windows 原生材质（见 3.3）。因此视觉方案以「分层磨砂」为可靠基线，原生 acrylic 仅作为增强项。

### 1.5 字体

| 用途 | 字体栈 | 字号/字重 |
|------|--------|-----------|
| 界面正文 | `"Segoe UI Variable Text", "Segoe UI", Inter, system-ui, sans-serif` | 13/14px · 400 |
| 标题 | 同上 | 14/16/20px · 600 |
| 数字/时间 | 同上 + `font-variant-numeric: tabular-nums` | 11/12px |
| 快捷键/代码 | `"Cascadia Code", "JetBrains Mono", Consolas, monospace` | 11/12px |

- 正文行高 1.6；便签正文 1.7。
- 最小可读字号 11px，仅用于辅助信息。

### 1.6 圆角、间距、阴影

| Token | 值 | 用途 |
|-------|----|------|
| `--radius-sm` | 8px | 小按钮、标签 |
| `--radius-md` | 12px | 输入框、工具栏按钮 |
| `--radius-lg` | 16px | 卡片、弹层 |
| `--radius-xl` | 20px | 便签窗口、对话框 |
| 间距 | 4px 基准（4/8/12/16/24/32） | 全局 |
| `--shadow-glass` | `0 1px 2px rgb(15 23 42/.06), 0 12px 32px rgb(15 23 42/.08)` | 玻璃卡片 |
| `--shadow-float` | `0 16px 48px rgb(15 23 42/.14)` | 浮层、对话框 |

暗色下阴影改为纯黑高透明度，并在玻璃顶部加 `inset 0 1px 0 rgb(255 255 255/.06)`。

### 1.7 图标

- 统一使用 **Lucide**（`lucide-react`），线性、圆角端点；
- 尺寸：14 / 16 / 18px；描边 1.75；
- 颜色继承文字色；
- **禁止**用 emoji 作为功能图标（用户内容中的 emoji 不受限制）；
- 每个图标按钮必须有 `aria-label` 与 Tooltip。

替换对照：

| 现 emoji | 新图标 |
|----------|--------|
| 🎨 | `Palette` |
| 🏷 | `Tag` |
| ⏰ | `Bell` / `Clock3` |
| 📌 | `Pin` / `PinOff` |
| 👁 | `Eye` / `EyeOff` |
| ✕ | `X` |
| ☰ / 1. / ☑ | `List` / `ListOrdered` / `ListChecks` |
| ↩ / ↪ | `Undo2` / `Redo2` |
| 🚀 | `Rocket` |
| 💾 | `Database` / `Download` / `Upload` |
| 📱 | `Smartphone` |
| ⚙ | `Settings2` |

### 1.8 动效

| Token | 值 |
|-------|----|
| `--dur-fast` | 120ms |
| `--dur-base` | 180ms |
| `--dur-slow` | 240ms |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` |

- 只对 `opacity / transform` 做动画；
- 弹层：淡入 + 上移 4px；
- 卡片 hover：`translateY(-1px)` + 阴影加深；
- 按钮按压：`scale(0.98)`；
- 尊重 `prefers-reduced-motion: reduce`，全部降级为无动画。

### 1.9 无障碍

- 正文对比度 ≥ 4.5:1，大字号 ≥ 3:1；
- 焦点环：`0 0 0 2px var(--bg), 0 0 0 4px rgb(var(--accent) / 0.45)`；
- 图标点击区 ≥ 28×28，推荐 32×32；
- 弹层使用 Radix，自带焦点陷阱、Esc 关闭、键盘导航；
- Toast/同步状态使用 `aria-live="polite"`；
- 所有仅图标按钮提供可读名称。

---

## 2. 页面与组件设计

### 2.1 便签窗口

#### 布局

```
┌─────────────────────────────────────┐
│ ⠿  ⋯                          ⋯  ✕ │  30px 玻璃标题栏
├─────────────────────────────────────┤
│                                     │
│  □ 写周报                           │  正文：背景透明可调，文字始终不透明
│  ☑ 买咖啡                           │
│                                     │
│  #工作                              │
│                                     │
└─────────────────────────────────────┘
```

#### 标题栏规则（解决当前溢出）

当前 14 个按钮在 240px 窗口内必然裁切。新规则：

- **常驻**：拖拽点 `⠿`、溢出菜单 `⋯`、关闭 `✕`（共 3 个）；
- **悬停/聚焦时**显示核心 4 个：加粗 `B`、斜体 `I`、待办 `ListChecks`、提醒 `Bell`；
- **其余全部收进 `⋯` 菜单**：无序/有序列表、字号、字体颜色、换色、标签、透明度、置顶、撤销/重做、删除；
- 窗口宽度 ≥ 320px 时，可用容器查询（`@container`）内联更多按钮；
- 菜单项 32px 高，图标 + 文字，快捷键右对齐。

#### 状态

| 状态 | 表现 |
|------|------|
| 空闲 | 仅标题栏常驻项；工具栏 120ms 淡出 |
| 悬停 | 工具栏淡入；标题栏高光增强 |
| 聚焦编辑 | 工具栏常驻；光标为文本 |
| 拖拽 | 窗口轻微放大 1.01，阴影加深 |
| 收起 | 仅保留 30px 标题栏，圆角不变 |
| 低透明度 | 仅背景变透明，文字/图标保持 100% 不透明 |

#### 其他交互

- 双击标题栏：收起/展开；
- 右下角 12×12 视觉把手（实际热区 20×20）；
- 颜色/标签/提醒/透明度使用 **Radix Popover**：点击外部或 `Esc` 关闭；
- 关闭 `✕` 仍为「隐藏」，删除在列表中操作（保持现有语义）；
- 弹层锚定按钮，自动避让窗口边缘。

#### 背景与透明度

- 不再调用 `win.setOpacity()`；
- `opacity` 字段解释为「背景不透明度」，映射为 `backgroundAlpha = clamp(opacity, 0.35, 1)`；
- 文字、图标、边框始终不透明；
- 滑杆范围调整为 30%–100%，旧值 <30% 读取时按 30% 显示；
- 设置项增加「视觉效果」：`完整` / `性能优先`（关闭模糊、降低阴影）。

### 2.2 便签列表

窗口默认 **560×680**（最小 420×480），使用无边框 + 原生窗口按钮覆盖层。

```
┌──────────────────────────────────────────────┐
│  StickerNote                         ─ □ ✕   │  40px 玻璃标题栏
├──────────────────────────────────────────────┤
│  便签列表  12              ⌘K 搜索    + 新建  │
│  ┌────────────────────────────────────────┐  │
│  │ 🔍 搜索…                    [全部 ▾] [排序 ▾] │
│  └────────────────────────────────────────┘  │
│  全部 · 工作 · 生活 · 灵感                    │  标签 chips
├──────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  │
│  │ 今日待办      📌 │  │ 周末计划          │  │
│  │ 3/5 已完成        │  │ #生活 · 2 天前    │  │
│  │ #工作 · 5 分钟前  │  │                  │  │
│  └──────────────────┘  └──────────────────┘  │
│  ┌──────────────────┐  ┌──────────────────┐  │
│  │ 读书笔记          │  │ 购物清单          │  │
│  └──────────────────┘  └──────────────────┘  │
└──────────────────────────────────────────────┘
```

#### 卡片规范

- 双列网格（宽度 ≥ 520px），窄于 520px 单列；
- 内边距 14px，圆角 16px，玻璃表面；
- 标题 1 行（14px/600），摘要 2 行（12px/muted）；
- 底部：标签 chips + 相对时间（tabular-nums）；
- 左上角 8px 便签色圆点，不使用整块粉彩背景；
- 置顶显示 `Pin` 图标并排在前面；
- 待办便签显示 `3/5` + 2px 进度条；
- hover：抬升 1px + 阴影加深；hover 右上角出现 `⋯`；
- 点击卡片：显示并聚焦对应便签窗口；
- 右键：显示/隐藏、置顶、换色、复制内容、删除。

#### 列表能力

- 排序：更新时间 / 创建时间 / 颜色 / 置顶优先；
- 筛选：标签 chips、仅置顶、仅提醒、仅待办；
- 搜索：标题 + 正文 + 标签；命中词高亮；`Ctrl+K` 聚焦；
- 多选：`Ctrl+点击` 或 hover 复选框；底部浮出批量操作条（显示/隐藏/删除）；
- 空状态：玻璃圆形图标 + 标题 + 说明 + 主按钮；
- 删除后显示 Toast + 「撤销」（5 秒）。

### 2.3 设置

窗口默认 **640×640**（最小 520×480），左侧栏 + 右侧内容。

```
┌──────────────────────────────────────────────┐
│  设置                                 ─ □ ✕  │
├────────────┬─────────────────────────────────┤
│ 通用       │  外观                            │
│ 外观   ●   │  ┌─────────────────────────────┐ │
│ 同步       │  │ 主题   [跟随系统][浅色][深色] │ │
│ 数据       │  │ 默认颜色  ○ ○ ○ ○ ○ ○ ○ ○   │ │
│ 关于       │  │ 视觉效果  [完整][性能优先]   │ │
│            │  └─────────────────────────────┘ │
│            │                                  │
│            │  ┌─────────────────────────────┐ │
│            │  │ 便签默认颜色                │ │
│            │  │ [预览卡片]                  │ │
│            │  └─────────────────────────────┘ │
└────────────┴─────────────────────────────────┘
```

- 左侧栏 168px，选中项为 `accent-soft` 圆角胶囊；
- **即时生效**：开关、主题、颜色点击后立即保存并 Toast，不再需要底部「保存设置」；
- 快捷键改为 **录制控件**：点击后按下组合键，实时校验并提示冲突；
- 同步区块：
  - 状态卡：`已连接 / 未连接 / 同步中 / 异常` 徽标 + 上次同步相对时间；
  - 服务器地址收进「高级」折叠区；
  - 配对码：大号 mono + 环形倒计时 + 200px 二维码白卡；
  - 设备列表：平台图标、最后在线、解绑操作（确认对话框）；
- 数据区块：导出、导入（合并/覆盖）、最近删除入口；
- 关于：版本号来自 `app.getVersion()`，附快捷键列表与开源许可。

### 2.4 通用组件

| 组件 | 变体/尺寸 | 关键规范 |
|------|-----------|----------|
| Button | primary / secondary / ghost / danger；sm 28 / md 32 / lg 36 | 圆角 10；primary 白字；focus ring |
| IconButton | 28 / 32 | 透明底，hover 出现 `accent-soft` |
| Input | 默认 / 搜索 / 错误 | 高 32；`surface-muted` 底；聚焦 2px accent |
| Textarea | 默认 | 同上，行高 1.6 |
| Switch | 36×20 | 开为 accent；120ms 过渡 |
| Slider | 单值 | 轨道 4px，拇指 14px，数值右侧等宽 |
| SegmentedControl | 2–3 项 | 玻璃底 + 白色滑块 |
| Chip | 默认 / 可关闭 / 选中 | 圆角 999；选中 accent-soft |
| Card | 玻璃 | 圆角 16；hover 抬升 |
| Popover | 默认 | 玻璃强层；12px padding；避让边缘 |
| Dialog | 默认 / 危险 | 遮罩 `bg-black/35` + 8px blur；圆角 20 |
| Tooltip | 默认 | 深色底、白字、12px、延迟 400ms |
| Toast | success / info / error | 右下角堆叠，3s 自动消失，支持撤销 |
| EmptyState | 默认 | 玻璃圆 + 图标 + 标题 + 说明 + 操作 |
| StatusBadge | 在线 / 离线 / 同步中 / 异常 | 8px 圆点 + 文字 |
| ShortcutRecorder | 默认 | 点击录制，Esc 取消，冲突提示 |
| Skeleton | 文本 / 卡片 | 微光扫过，1.2s 循环 |

### 2.5 反馈层

- 用 Toast 替换 `alert()`（当前 `Settings.tsx` 导入成功/失败）；
- 危险操作用 Dialog，主按钮 `danger`，次按钮 ghost；
- 同步状态用 StatusBadge + `aria-live`；
- 长任务（导入、同步）按钮内显示 spinner，不阻塞界面。

---

## 3. 技术实现

### 3.1 新增依赖

```bash
npm i lucide-react clsx tailwind-merge \
  @radix-ui/react-popover @radix-ui/react-dialog \
  @radix-ui/react-tooltip @radix-ui/react-dropdown-menu \
  @radix-ui/react-slider @radix-ui/react-switch \
  @radix-ui/react-select @radix-ui/react-checkbox
```

- 全部按需引入，预计 gzip 增量 40–70KB；
- 不引入完整组件库，不引入 CSS-in-JS；
- `clsx` + `tailwind-merge` 封装 `cn()`。

### 3.2 Token 落地

新建 `src/renderer/styles/tokens.css`，在 `globals.css` 顶部引入。

```css
:root {
  --bg: 244 247 250;
  --bg-subtle: 237 242 247;
  --surface: 255 255 255;
  --surface-muted: 241 245 249;
  --glass-hi: 255 255 255;
  --glass-lo: 244 247 250;

  --text: 15 23 42;
  --text-muted: 100 116 139;
  --text-subtle: 148 163 184;

  --border: 15 23 42;
  --accent: 47 111 237;
  --accent-hover: 30 90 209;
  --success: 4 120 87;
  --warning: 180 83 9;
  --danger: 220 38 38;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;

  --dur-fast: 120ms;
  --dur-base: 180ms;
  --dur-slow: 240ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);

  --shadow-glass: 0 1px 2px rgb(15 23 42 / 0.06), 0 12px 32px rgb(15 23 42 / 0.08);
  --shadow-float: 0 16px 48px rgb(15 23 42 / 0.14);
}

.dark {
  --bg: 11 18 32;
  --bg-subtle: 14 21 37;
  --surface: 20 30 48;
  --surface-muted: 26 38 58;
  --glass-hi: 30 41 59;
  --glass-lo: 15 23 42;

  --text: 230 237 247;
  --text-muted: 143 162 184;
  --text-subtle: 100 116 139;

  --border: 148 163 184;
  --accent: 106 165 255;
  --accent-hover: 133 183 255;
  --success: 52 211 153;
  --warning: 251 191 36;
  --danger: 248 113 113;
}
```

`tailwind.config.js` 映射：

```js
theme: {
  extend: {
    colors: {
      canvas: 'rgb(var(--bg) / <alpha-value>)',
      muted: 'rgb(var(--surface-muted) / <alpha-value>)',
      surface: 'rgb(var(--surface) / <alpha-value>)',
      line: 'rgb(var(--border) / <alpha-value>)',
      ink: 'rgb(var(--text) / <alpha-value>)',
      'ink-muted': 'rgb(var(--text-muted) / <alpha-value>)',
      'ink-subtle': 'rgb(var(--text-subtle) / <alpha-value>)',
      accent: 'rgb(var(--accent) / <alpha-value>)',
      'accent-hover': 'rgb(var(--accent-hover) / <alpha-value>)',
      danger: 'rgb(var(--danger) / <alpha-value>)',
    },
    borderRadius: {
      sm: 'var(--radius-sm)',
      md: 'var(--radius-md)',
      lg: 'var(--radius-lg)',
      xl: 'var(--radius-xl)',
    },
    boxShadow: {
      glass: 'var(--shadow-glass)',
      float: 'var(--shadow-float)',
    },
    transitionTimingFunction: {
      out: 'var(--ease-out)',
    },
  },
}
```

使用示例：`bg-canvas`、`text-ink-muted`、`border-line/10`、`bg-accent`。

### 3.3 窗口形态

#### 便签窗口

- 保持 `frame: false` + `transparent: true` + 圆角；
- **移除 `win.setOpacity()` 调用**，透明度改由渲染层控制；
- 可选增强：Windows 11 22H2+ 尝试 `backgroundMaterial: 'acrylic'`；
  - 需先做技术验证（spike）：确认与 `transparent`、圆角、阴影、拖拽是否兼容；
  - 若出现黑底、圆角失效或拖拽异常，回退到分层玻璃；
  - 原生材质不可用时设计仍然完整，不作为验收阻塞项。

#### 列表 / 设置窗口

- `frame` 保留为默认，但使用原生标题栏覆盖层，兼顾现代感与 Snap Layout：

```ts
new BrowserWindow({
  width: 560,
  height: 680,
  minWidth: 420,
  minHeight: 480,
  titleBarStyle: 'hidden',
  titleBarOverlay: {
    color: '#F4F7FA',
    symbolColor: '#64748B',
    height: 40,
  },
  backgroundColor: '#F4F7FA',
  webPreferences: { /* 现有配置 */ },
})
```

- 主题切换时调用 `win.setTitleBarOverlay({ color, symbolColor })` 同步颜色；
- 若覆盖层与玻璃标题栏冲突（圆角/透明），降级为自绘标题栏 + 自绘最小化/最大化/关闭，并保留 `-webkit-app-region: drag`。

### 3.4 便签透明度重构

- `opacity` 仍存 0.2–1.0，语义改为「背景不透明度」；
- 渲染：

```tsx
const alpha = Math.min(1, Math.max(0.35, sticker.opacity));
<div
  className="sticker-shell"
  style={{ '--tint-alpha': String(alpha) } as React.CSSProperties}
/>
```

```css
.sticker-shell {
  background:
    linear-gradient(180deg, rgb(255 255 255 / 0.32), rgb(255 255 255 / 0.08)),
    rgb(var(--sticker-tint) / var(--tint-alpha));
  -webkit-backdrop-filter: blur(14px) saturate(135%);
  backdrop-filter: blur(14px) saturate(135%);
  border: 1px solid rgb(255 255 255 / 0.45);
  box-shadow: var(--shadow-glass);
}
```

- 文字色来自便签色配置，始终 `alpha = 1`；
- 滑杆显示 30%–100%，低于 30% 的旧值按 30% 处理；
- 透明度变化不触发布局，只改变背景层。

### 3.5 弹层与可访问性

- 统一封装 `Popover` / `Dialog` / `Tooltip` / `DropdownMenu`，全部基于 Radix；
- 删除 `StickerEditor` 中的手写 `activePanel` 开关逻辑，改为受控 `open`；
- 所有图标按钮补 `aria-label`；
- Dialog 打开时焦点移入，关闭后归还；
- 列表卡片支持 `tabIndex=0`、`Enter` 打开、`Delete` 删除（带确认）。

### 3.6 性能预算

- 同一屏最多 2 层 `backdrop-filter`（标题栏 + 一个弹层）；
- **滚动列表不使用 `backdrop-filter`**，用接近不透明的 `surface`；
- 玻璃模糊 12–18px，不制作动画模糊；
- 卡片使用 `content-visibility: auto`（如无副作用）；
- 「性能优先」模式：`backdrop-filter: none`、阴影降为单层、关闭卡片抬升；
- 目标：空闲 CPU < 1%，列表滚动 60fps，10 个便签窗口不出现明显卡顿。

### 3.7 兼容与迁移

| 项 | 策略 |
|----|------|
| 旧便签颜色 | `resolveStickerColor` 运行时映射，不批量改写数据 |
| 旧 `opacity` | 读取时 clamp 到 0.35–1 |
| 旧窗口尺寸 | 保持不变，仅新窗口使用新默认值 |
| 主题 | 继续使用 `.dark` class，不改变现有 `useTheme` 接口 |
| 同步 | 新色值以字符串同步；移动端需同步增加映射表，否则颜色点不显示选中 |
| 设置 | 从「手动保存」改为即时保存，旧字段不变 |

### 3.8 并行修复的 P0（非视觉）

| # | 问题 | 改动点 |
|---|------|--------|
| 1 | 默认同步到公网 HTTP | `src/main/sync.ts:26` 移除硬编码默认地址；新增 `syncEnabled` 设置，默认 `false`；设置页首次开启时填写地址并确认 |
| 2 | 单实例锁 | `src/main/index.ts` 增加 `app.requestSingleInstanceLock()`，第二实例聚焦列表 |
| 3 | 重启强制显示 | `src/main/windows.ts:284-296` 尊重 `isVisible`，不再强制全部显示 |
| 4 | 工具栏溢出 | 见 2.1，核心 4 项 + 溢出菜单 |
| 5 | 整窗透明度 | 见 3.4，改为背景透明度 |
| 6 | 已打开便签不刷新 | 新增按便签广播 `sticker:changed`，`StickerEditor` 订阅；远程删除时关闭对应窗口 |
| 7 | 版本号硬编码 | 托盘与设置页改用 `app.getVersion()` |

---

## 4. 功能迭代路线

### P0（与视觉同批）

- 同步默认关闭 + 移除公网默认地址；
- 单实例锁；
- 启动尊重隐藏状态；
- 工具栏溢出；
- 背景透明度；
- 已打开便签随同步刷新；
- 版本号统一。

### P1（第二期前后）

- 字号、标题、高亮、链接、图片拖入；
- 最近删除 / 恢复 / 版本历史；
- 提醒升级：补跑、重复、稍后提醒、自然语言；
- 贴边收纳 / 卷起；
- 全局快速捕捉 + 命令面板；
- 列表排序、筛选、多选、右键菜单；
- 同步冲突副本、HTTPS、事件驱动同步；
- 自动更新（`electron-updater`）。

### P2（中长期）

- 便签模板；
- 单条导出 Markdown / PDF；
- 隐私便签 / 应用锁；
- 移动端深色模式、小组件、分享入口、本地通知；
- 多语言。

---

## 5. 分期计划

### Phase 0 · 基础设施与 P0（1.5–2 天）

**任务**

1. 新增依赖与 `cn()` 工具；
2. 新建 `tokens.css`，改造 `tailwind.config.js`；
3. 新建 `components/ui/*` 基础组件（Button、IconButton、Input、Switch、Slider、Chip、Card、Dialog、Popover、Tooltip、Toast、EmptyState、StatusBadge、Skeleton）；
4. 移除 emoji 图标，替换 Lucide；
5. 完成 3.8 的 P0 修复。

**改动文件**

- `src/renderer/styles/tokens.css`（新增）
- `src/renderer/styles/globals.css`
- `tailwind.config.js`
- `src/renderer/components/ui/*`（新增）
- `src/main/sync.ts`、`src/main/index.ts`、`src/main/windows.ts`
- `src/shared/types.ts`

**验收**

- 旧数据正常显示；
- 两个窗口实例只保留一个；
- 同步默认关闭；
- 所有新组件在亮/暗色下可用。

### Phase 1 · 便签窗口（2–3 天）

**任务**

1. 标题栏重构：拖拽点、核心工具、溢出菜单；
2. Radix Popover 替换手写面板；
3. 背景透明度重构；
4. 便签冷色板 + 旧色映射；
5. 收起/展开、resize 把手；
6. 可选 acrylic spike。

**验收**

- 160px 宽无裁切；
- 20%/30% 透明度下正文清晰；
- 弹层点击外部与 Esc 关闭；
- 亮/暗色对比度通过；
- 旧便签颜色显示正确。

### Phase 2 · 列表与设置（2–3 天）

**任务**

1. 列表窗口尺寸与原生标题栏覆盖层；
2. 卡片网格、排序/筛选/搜索高亮；
3. 右键菜单、多选、批量操作；
4. 空状态、Toast、撤销删除；
5. 设置页侧栏、即时生效、快捷键录制、同步状态卡；
6. 对话框与 Tooltip 统一。

**验收**

- 520px 以下单列、以上双列；
- 键盘可完成主要操作；
- 设置即时生效并有反馈；
- 无 `alert()`。

### Phase 3 · 同步、移动端与打磨（3–5 天）

**任务**

1. 已打开便签的同步刷新与远程删除关窗；
2. 同步冲突副本、HTTPS 切换方案；
3. 移动端颜色映射与视觉对齐（深色模式、卡片、空状态）；
4. 动效与 `prefers-reduced-motion`；
5. 性能模式与 QA；
6. 自动更新。

**验收**

- 手机改/删便签，桌面 30 秒内反映；
- 移动端亮色下颜色选择正确；
- 低配机列表滚动无明显掉帧；
- 安装包可自动更新。

---

## 6. 验收清单

### 视觉

- [ ] 三个界面均无 emoji 功能图标；
- [ ] 颜色全部来自 token，无散落 `blue-500` / `gray-800`；
- [ ] 亮/暗色均有玻璃高光与发丝边；
- [ ] 圆角、间距、阴影符合 token；
- [ ] 便签冷色板 8 色可区分。

### 可用性

- [ ] 160px 宽便签窗口按钮不裁切；
- [ ] 透明度 30% 时正文可读；
- [ ] 弹层可点击外部 / Esc 关闭；
- [ ] 快捷键可录制并提示冲突；
- [ ] 所有图标按钮有 Tooltip 与 `aria-label`；
- [ ] 键盘可完成：新建、搜索、打开、删除、关闭弹层。

### 稳定性

- [ ] 双击启动只出现一个托盘；
- [ ] 隐藏所有便签后重启仍保持隐藏；
- [ ] 同步默认关闭，开启前不发起网络请求；
- [ ] 远程删除后对应窗口关闭。

### 兼容性

- [ ] Windows 10 / 11 正常；
- [ ] 100% / 125% / 150% 缩放正常；
- [ ] 多显示器拖动/吸附正常；
- [ ] 旧便签颜色、旧透明度正常。

### 性能

- [ ] 10 个便签窗口空闲 CPU < 1%；
- [ ] 列表滚动 60fps；
- [ ] 性能优先模式可关闭全部模糊。

---

## 7. 风险与回滚

| 风险 | 影响 | 应对 |
|------|------|------|
| Windows 原生 acrylic 不可用或与透明窗口冲突 | 玻璃质感不完整 | 设计以分层玻璃为基线；acrylic 仅增强，失败即回退 |
| `backdrop-filter` 在低端 GPU 上开销高 | 掉帧、发热 | 限制层数；列表不用；提供性能模式 |
| 冷色便签辨识度低于暖色 | 用户找不到便签 | 保留 8 色相差异；列表增加色点；可后续加自定义色 |
| Radix 与无边框窗口边缘冲突 | 弹层被裁切 | 统一 `collisionPadding`；窗口内弹层优先 |
| 旧色值未映射 | 便签显示异常 | `resolveStickerColor` 兜底返回 `frost` |
| 设置改为即时保存 | 误操作 | Toast + 撤销；关键项（服务器地址）仍需确认 |

**回滚策略**：所有视觉改动集中在 token 与 `components/ui`，保留旧组件文件直到验收通过；通过 git revert 单个 Phase 即可回退，不影响数据。

---

## 8. 默认决策与备选

| 决策 | 采用 | 备选 |
|------|------|------|
| 主色 | 冰川蓝 `#2F6FED` | 冰青 `#0EA5E9`（更冷，但白字对比度不足） |
| 列表窗口 | 560×680 双列 | 保持 360 单列（信息密度低，不推荐） |
| 设置保存 | 即时生效 | 保留底部保存按钮（交互更重） |
| 原生 acrylic | 可选增强 | 不启用（纯分层玻璃） |
| 便签默认色 | `ice` 冰川 | `cloud` 云灰（更中性） |

---

## 9. 变更记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-10-24 | 初稿：冷色极简玻璃方向、token、组件、分期计划 |
