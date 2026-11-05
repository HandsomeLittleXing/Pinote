# Glass Card 替换第一套皮肤编码实现文档

> 对应设计：`docs/design/2026-11-03-glass-card-first-skin-design.md`（已确认）
> 日期：2026-11-03
> 状态：初版已实施；材质与视觉规则已由 `../design/2026-11-03-glass-saas-refinement-design.md` 修订
> 范围：Windows Electron 桌面端与 Android Expo 手机端；三套皮肤总数不变

## 1. 变更概览

把规范皮肤 ID 从 `cursor` 替换为 `glass`，读取旧配置时统一迁移；在共享色板中增加只影响显示的 Glass Card 材质映射。桌面通过 CSS token、卡片和透明便签外壳呈现彩色磨砂，手机通过现有主题与 `GlassSurface` 呈现同一语言，长列表保持预合成表面。Cursor 专属闪烁光标移除；Vellum、Mote 的行为、便签数据和同步接口不变。

## 2. 逐文件清单与职责

### 2.1 共享层与桌面主进程

| 操作 | 路径 | 唯一主要职责、接口及直接依赖 |
| --- | --- | --- |
| 修改 | `src/shared/types.ts` | `SkinId` 改为 `glass | vellum | mote`，`DEFAULT_SETTINGS.skin = 'glass'`；类型供两端使用 |
| 修改 | `src/shared/skins.ts` | 第一项元数据、圆角、原生标题栏色改为 Glass Card；导出 `normalizeSkinId(value: unknown): SkinId`，依赖 `SkinId` |
| 修改 | `src/shared/palette.ts` | 保留 `STICKER_PALETTE` 与旧色映射；新增 `resolveGlassCardColor(color: StickerColor, dark: boolean)`，返回材质底色、前景色和描边色 |
| 修改 | `src/main/store.ts` | 获取、写入、覆盖导入设置时调用 `normalizeSkinId`；只规范 `settings.skin`，不改便签字段 |
| 修改 | `src/main/windows.ts` | `getEffectiveSkin()` 回退 Glass Card；原生列表/设置标题栏使用 `SKIN_NATIVE_CHROME.glass` |

### 2.2 桌面渲染层

| 操作 | 路径 | 唯一主要职责、接口及直接依赖 |
| --- | --- | --- |
| 修改 | `src/renderer/hooks/useTheme.ts` | 默认值与设置事件使用规范 `glass`，继续向 `<html>` 写 `data-skin`；依赖共享归一化函数 |
| 修改 | `src/renderer/App.tsx` | 更新指向 Cursor 默认 token 的旧注释；不改变页面路由 |
| 修改 | `src/renderer/styles/tokens.css` | 默认 `:root/.dark` 改为 Glass Card 明暗 token；Vellum/Mote 覆盖规则保留 |
| 修改 | `src/renderer/styles/globals.css` | 中性网格、玻璃面板与列表卡片的 Glass Card 规则；移除 Cursor 闪烁光标规则 |
| 修改 | `src/renderer/styles/sticker.css` | 将 Cursor 便签规则替换为 Glass Card 外壳、边框和工具栏规则；保持收起和窄窗口布局 |
| 修改 | `src/renderer/components/SkinBackdrop.tsx` | `glass` 时呈现不拦截点击的网格背景；Vellum/Mote 分支保留 |
| 修改 | `src/renderer/components/WindowChrome.tsx` | 删除不再使用的 `skin-caret` DOM 节点；标题栏拖拽区不变 |
| 修改 | `src/renderer/components/StickerEditor.tsx` | 新皮肤用共享材质底色与前景色，继续经 `clampOpacity`/`withAlpha` 只调整背景；保留编辑/自动保存逻辑 |
| 修改 | `src/renderer/components/StickerList.tsx` | 把当前 `skin` 传给列表项，避免每张卡单独订阅主题设置 |
| 修改 | `src/renderer/components/StickerListItem.tsx` | `glass` 时按便签色设置卡片材质与文字/图标色；Vellum/Mote 保持原 CSS 类与交互 |
| 修改 | `src/renderer/components/settings/AppearanceSettings.tsx` | 第一套名称和缩略预览改为 Glass Card 材质；仍显示三张选择卡 |

### 2.3 手机端

| 操作 | 路径 | 唯一主要职责、接口及直接依赖 |
| --- | --- | --- |
| 修改 | `mobile/src/storage/preferences.ts` | 默认皮肤改为 `glass`，读取 `cursor` 映射为 `glass`；保持 AsyncStorage 键名和其他字段 |
| 修改 | `mobile/src/theme.tsx` | Cursor 明暗 spec 替换为 Glass Card spec，`SPECS.glass` 和默认主题改为新值；移除 `effects.caret`，保留编辑器光标颜色 token |
| 修改 | `mobile/src/components/ScreenBackground.tsx` | 新皮肤显示中性底与稀疏网格；现有 BlurTargetView 继续供少量模糊表面使用 |
| 修改 | `mobile/src/components/GlassSurface.tsx` | 新皮肤支持材质色覆盖与 Android 低版本预合成回退；保留既有 `blur`、`radius`、`style` 用法 |
| 修改 | `mobile/src/components/GlassHeader.tsx` | 移除 Cursor 专属闪烁光标引用；标题/操作和安全区布局不变 |
| 修改 | `mobile/src/components/StickerCard.tsx` | 依据共享材质色给 Glass Card 卡片、文字、图标和标签着色；继续 `blur={false}` |
| 修改 | `mobile/src/screens/StickerEditorScreen.tsx` | 便签外壳与色板使用材质色，`RichEditor` 的 WebView 背景继续使用可读实色；将 Cursor 专属条件改为 Glass Card 条件 |
| 修改 | `mobile/src/screens/SettingsScreen.tsx` | 第一套皮肤预览展示彩色卡片质感，继续复用 `SKIN_DEFINITIONS` 和现有选择逻辑 |
| 删除 | `mobile/src/components/BlinkingCaret.tsx` | 仅用于旧 Cursor 标题栏，引用移除后删除 |

不新增业务代码文件、原生依赖或服务端文件。实现中发现此清单之外的必要文件时，先核对是否改变已确认的设计边界。

## 3. 项目风格参考与复用

| 参考 | 沿用方式 |
| --- | --- |
| `src/shared/skins.ts` 的 `isSkinId`、`SKIN_DEFINITIONS` | 共享元数据驱动两端设置页；新归一化函数放在同一模块 |
| `src/shared/palette.ts` 的 `resolveStickerColor` | 旧色值先解析为现有 8 色，再获取 Glass Card 材质；不让 UI 自行硬编码映射 |
| `src/renderer/utils/colors.ts` 的 `withAlpha`/`clampOpacity` | 便签只透明化背景，保留原透明度交互；新材质不设置整个窗口 opacity |
| `src/renderer/hooks/useTheme.ts` 与 CSS `data-skin` | 一次设置广播驱动所有桌面窗口和 Portal 浮层 |
| `mobile/src/theme.tsx` 的 `ThemeSpec`/`buildAppTheme` | 继续由皮肤 + 明暗组合生成页面 token |
| `mobile/src/components/GlassSurface.tsx` | 扩展现有表面组件；`StickerCard` 保持非实时模糊 |
| `mobile/src/components/ScreenBackground.tsx` | 保留 `BlurTargetContext` 结构，网格只作为背景装饰 |

SwiftUI `GlassCard`、`GlassCardPile`、Ring/Layered 布局均不直接复用：目标平台和交互结构不同。Vellum 的 `PaperStack`、颗粒层与 Mote 的 mascot 不用于 Glass Card，避免两套皮肤混同。

## 4. 接口、数据与兼容策略

### 4.1 皮肤标识

```ts
type SkinId = 'glass' | 'vellum' | 'mote';

function normalizeSkinId(value: unknown): SkinId {
  if (value === 'cursor' || value === 'glass') return 'glass';
  if (value === 'vellum' || value === 'mote') return value;
  return 'glass';
}
```

`isSkinId` 只识别三个规范值；旧 `cursor` 只在读取边界由 `normalizeSkinId` 接受。桌面 `getSettings`、`setSettings` 和覆盖导入均规范化；移动端 `getPreferences` 规范化。旧 `cursor` 偏好读出后显示 Glass Card，下一次保存时写回 `glass`。桌面合并导入不覆盖当前设置。非法值回退默认值，不写入无效皮肤。

### 4.2 材质色接口

```ts
interface GlassCardColor {
  tint: string;       // 参考色；预览和调色器使用
  surface: string;    // 与当前明暗的中性底预合成后的实色
  ink: string;        // 卡片标题、正文和控件前景色
  border: string;     // 卡片高光/描边色
}

function resolveGlassCardColor(color: StickerColor, dark: boolean): GlassCardColor;
```

函数先调用 `resolveStickerColor` 兼容旧色值，再按设计文档的 8 色映射取得参考色。浅色以近白纸底、深色以中性炭灰底预合成 `surface`；卡片标题和正文始终使用不透明的 `ink`。桌面独立便签将 `surface` 传给既有 `withAlpha(surface, clampOpacity(sticker.opacity))`，因此 `Sticker.opacity` 的存储、滑杆和背景透明语义不变。原有 `STICKER_PALETTE`、`StickerColor` 与 `Sticker` 字段不改。

### 4.3 外部边界

- 无 HTTP、IPC channel、数据库、SQLite 表或同步消息变更；`AppSettings.skin` 仍是原键，手机仍用 `stickernote.preferences.v1`。
- 不复制参考仓库的 SwiftUI 源码或图片，故无需引入其版权文件；仅在开发文档记录视觉来源。
- Vellum/Mote 使用原色板和原组件路径；共享材质映射只在 `glass` 分支应用。

## 5. 按依赖顺序实施

| 步骤 | 文件 | 行为与完成条件 |
| --- | --- | --- |
| 1. 兼容入口 | `src/shared/{types,skins}.ts`、`src/main/{store,windows}.ts`、`mobile/src/storage/preferences.ts`、`src/renderer/hooks/useTheme.ts` | 三套规范 ID 生效；旧 `cursor` 在桌面读取、写入、覆盖导入和手机读取时稳定映射为 `glass`；Vellum/Mote 不变 |
| 2. 共享材质色 | `src/shared/palette.ts` | 8 个现有颜色和旧色值均返回稳定的明暗材质色、文字色和边框色；不修改数据色板 |
| 3. 桌面基础 | `src/renderer/styles/{tokens,globals,sticker}.css`、`SkinBackdrop.tsx`、`WindowChrome.tsx`、`App.tsx` | 新皮肤背景、通用表面、标题栏和便签外壳具备明暗效果；删除旧闪烁光标 |
| 4. 桌面业务视图 | `StickerEditor.tsx`、`StickerList.tsx`、`StickerListItem.tsx`、`AppearanceSettings.tsx` | 独立便签/列表卡/皮肤预览使用对应便签色；原操作与窄窗口布局可用 |
| 5. 手机基础 | `mobile/src/theme.tsx`、`ScreenBackground.tsx`、`GlassSurface.tsx`、`GlassHeader.tsx`、删除 `BlinkingCaret.tsx` | 明暗 token、背景网格和低版本回退生效；无旧光标效果或不可点击装饰层 |
| 6. 手机业务视图 | `StickerCard.tsx`、`StickerEditorScreen.tsx`、`SettingsScreen.tsx` | 列表卡和编辑外壳呈现彩玻；WebView 可读、输入流畅；三套皮肤可切换 |
| 7. 验证与校准 | 无预定代码文件 | 类型检查、桌面构建、Android 构建/实机检查和截图；按结果只调整 Glass Card 色值、透明度、边框或回退，不改变设计边界 |

当前工作区存在多处未提交变更。实施时逐文件读取现有 diff，在其基础上编辑；不清理或回退用户已有修改。

## 6. 测试用例

| 输入/条件 | 操作 | 预期结果 |
| --- | --- | --- |
| 新安装、无皮肤设置 | 启动桌面/手机并打开设置 | 第一套 Glass Card 被选中，另外两套仍可选 |
| 旧 `skin: cursor` | 启动桌面或读取手机偏好 | 自动显示 Glass Card；下一次保存写 `glass` |
| 旧备份 `skin: cursor` | 桌面覆盖导入 | 设置变为 `glass`；便签内容和颜色未改变 |
| `skin: vellum`、`skin: mote` | 启动、切换、重启 | 原皮肤效果与选择状态不变 |
| 缺失、空值或未知 skin | 读取设置 | 回退 Glass Card，不崩溃 |
| 8 个新便签色及旧色值 | 切换明暗并查看桌面/手机列表与编辑 | 每个颜色显示相同语义的材质色；旧值映射后显示正确 |
| 桌面便签宽 160px、折叠、高低透明度 | 拖动、编辑、收起/展开、调整滑杆 | 工具栏不溢出；文本不随背景一起透明；位置与内容正常保存 |
| 桌面列表宽度跨 520px | 缩放窗口、搜索、打开菜单 | 单双列切换正常，卡片文字/菜单不遮挡 |
| 手机大量便签、Android 31+ | 连续滚动列表、打开编辑 | 无逐卡 BlurView；滚动无明显掉帧；键盘和 WebView 正常 |
| 手机 Android 31 以下或模糊不可用 | 打开列表/设置/浮层 | 表面回退为预合成实色，文字和操作仍可用 |
| 自定义文字色、AI 标注与搜索高亮 | 查看不同底色的便签 | 编辑区内容及标注可读，突出状态可辨识 |
| 同一便签在桌面/手机同步 | 分别选择不同皮肤再同步便签 | 内容/便签色一致；两端皮肤偏好各自保持本地选择 |

仓库目前没有统一单元测试脚本。本次优先用类型检查、构建和上述交互/视觉用例验证；共享归一化与色彩映射若在实施时引入可运行的测试入口，再增加针对性自动化用例，不为 UI 改动单独引入测试框架。

## 7. 验证命令与预期

在仓库根目录执行：

```powershell
npm run typecheck
npx electron-vite build
npx tsc -p mobile/tsconfig.json --noEmit
```

预期三项退出码均为 0；`electron-vite build` 验证桌面主进程、preload 与渲染资源，不生成安装包。当前无统一 lint/formatter 脚本，不额外运行未配置的命令。

在 Android SDK、设备或模拟器可用时，从 `mobile/` 执行：

```powershell
npx expo run:android
```

预期原生构建和启动成功，并按第 6 节在真机核对视觉、列表滚动、键盘、明暗切换。若环境没有 Android SDK/设备，则记录未验证项和原因，不把 TypeScript 通过视为 Android 验证通过。桌面需在 Windows 上人工检查独立透明窗口、标题栏、低透明度与截图；对比度按最终实际底色核对。

## 8. 与设计文档的一致性及确认关卡

实现保持三套皮肤、替换第一套、旧 Cursor 自动映射、8 色数据和现有列表交互。桌面不承诺模糊系统桌面；手机长列表不逐卡实时模糊。没有偏离已确认设计的项目。

初版已按用户“开始编码”的要求实施。本次 SaaS 风格修订按用户后续的明确视觉要求继续编码，变更和验证记录见下文；不会自行提交 Git。

## 9. 轻玻璃 SaaS 修订记录

共享 `src/shared/{palette,skins}.ts` 把高饱和整卡色改成低饱和小色标、中性表面和统一 16px 圆角。桌面 `src/renderer/styles/{tokens,globals,sticker}.css` 调整浅/深 token、轻模糊、颗粒、软阴影和通用控件；列表、独立便签、色板及设置预览消费新材质。手机 `mobile/src/{theme.tsx,components/*,screens/*}` 对应调整背景、卡片、浮层、编辑区和色板；Vellum/Mote 仍走原有分支。

验证：桌面和手机 TypeScript 检查、Electron 构建、Android Metro export 已通过；桌面开发窗口的浅色列表、外观设置和独立便签已截图检查，深色列表与独立便签仍待实际核对。Android release 构建需要解析 `org.gradle.toolchains.foojay-resolver-convention:1.0.0`，当前插件仓库未解析成功，故新 APK 与实机视觉未验证；`adb devices -l` 目前没有连接设备。

用户追加桌面配色参考图后，桌面浅色画布和便签卡改为更有明度差的冷灰蓝；深色改为蓝灰石墨表面，青色与淡紫只用于小面积强调。手机端材质不随本次桌面校准改变。最终复查已覆盖浅色列表、外观设置和深色外观设置；临时切换深色后恢复了原有“跟随系统”偏好。桌面 TypeScript 检查与 Electron 构建再次通过。
