# Phase 3 功能设计文档：移动端冷色玻璃 UI

> 上级方案：`docs/UI-REDESIGN-PLAN.md`
> 前置阶段：Phase 0/1/2（桌面端已完成）
> 版本：v1.0 · 日期：2026-10-24 · 状态：待确认
> 视觉方向：Cold Minimal Glass（移动端真玻璃：BlurView + 渐变）

---

## 1. 背景与目标

### 1.1 背景

桌面端已完成冷色板、玻璃质感和列表/设置重构，但移动端仍是旧 UI：

- 列表是单列色条卡片，只有搜索和长按删除；
- 编辑页使用旧的 8 个粉彩色，没有深色模式；
- 配对页是普通白底表单；
- `app.json` 的 `userInterfaceStyle` 仍是 `light`；
- 移动端取色器未使用桌面新冷色板，桌面新建的冷色便签在手机上不会显示为选中。

刚安装的 APK 就是这套旧 UI。本次要把移动端也提升到「冷色极简玻璃」语言，并使用真玻璃效果。

### 1.2 目标

1. 建立移动端主题 token（冷色、明暗、圆角、间距、阴影、字体）。
2. 使用 `expo-blur` + `expo-linear-gradient` 实现：
   - 冷色渐变背景 + 柔和光斑；
   - 玻璃标题栏、玻璃搜索框、玻璃按钮/浮层；
   - 列表卡片采用半透明实色 + 高光边，避免长列表全部实时模糊。
3. 三个核心页面统一改版：配对页、列表页、编辑页。
4. 支持系统深色模式，状态栏/导航/键盘/编辑器同步切换。
5. 复用桌面共享冷色板与旧色映射，保证两端颜色一致。
6. 不改服务端、数据库、同步协议与同步逻辑。

### 1.3 成功标准

| 维度 | 标准 |
|------|------|
| 视觉 | 冷色渐变背景 + 玻璃层；亮/暗模式下文字对比度 ≥ AA |
| 页面 | 配对/列表/编辑三页统一风格；无明显旧样式残留 |
| 深色 | 跟随系统；切换后背景、卡片、输入框、状态栏同步 |
| 颜色 | 8 个冷色；旧色值正常映射；桌面新色在手机取色器中选中 |
| 性能 | 列表滚动无明显掉帧；模糊只用于标题栏/浮层/按钮 |
| 数据 | 便签、配对、同步数据不丢失；不改 DB/服务端 |
| 构建 | 可重新打 arm64 APK，`adb install -r` 覆盖安装成功 |

---

## 2. 非目标

- 不做移动端小组件、系统分享入口、本地提醒通知（`expo-notifications` 接入留待后续）。
- 不新增标签编辑、提醒编辑、多选/批量操作。
- 不做 iOS 构建（当前环境只有 Android SDK/adb；iOS 需要 macOS）。
- 不改同步协议、服务端、数据库结构。
- 不升级 Expo/React Native 核心版本（只新增兼容 SDK 58 的模块）。
- 不做 E2E 自动化测试框架。

---

## 3. 现状分析

### 3.1 相关入口

| 领域 | 现状 | 位置 |
|------|------|------|
| 应用入口 | `NavigationContainer`，无主题/安全区 Provider | `mobile/App.tsx` |
| 配对页 | 白底表单，默认硬编码服务器地址，扫码视图 | `mobile/src/screens/PairingScreen.tsx` |
| 列表页 | 单列卡片、旧色条、搜索、长按删除、同步按钮 | `mobile/src/screens/StickerListScreen.tsx` |
| 编辑页 | 旧 8 色、RichEditor、顶部返回/删除/同步 | `mobile/src/screens/StickerEditorScreen.tsx` |
| 主题 | `app.json` `userInterfaceStyle: "light"` | `mobile/app.json` |
| 颜色 | 编辑页硬编码旧 8 色 | `StickerEditorScreen.tsx:15-24` |
| 数据 | SQLite 缓存 + AsyncStorage 凭证 | `mobile/src/storage/db.ts`、`credentials.ts` |
| 同步 | 聚焦列表时同步、手动同步、下拉刷新 | `mobile/src/api/syncClient.ts`、列表页 |
| 共享类型 | `@shared/*` → `../src/shared/*`，Metro watchFolders 已配置 | `mobile/tsconfig.json`、`metro.config.js` |
| 共享色板 | `STICKER_PALETTE`、旧色映射、解析函数 | `src/shared/palette.ts` |
| 标题/摘要工具 | 桌面 `src/renderer/utils/{note,position}.ts`；移动端另有旧 `extractTitle` | 两端各一份 |
| 构建 | `mobile/android` 已生成（gitignored）；JDK17 + SDK + adb 可用 | `mobile/android` |
| 玻璃依赖 | 尚未安装 | — |

### 3.2 数据流

- 列表：SQLite `getActiveStickers()` → FlatList；编辑保存 `upsertSticker`；同步 `syncNow()` 合并远程数据。
- 配对：`redeemPairingCode()` 写 AsyncStorage token；`isPaired()` 决定首屏。
- 颜色：`Sticker.color` 字符串随同步传递；移动端目前直接用旧色值。

### 3.3 约束

- Expo SDK 58 / RN 0.88 / React 19；Android 15 手机（arm64）。
- `expo-blur` 在 Android 使用 `dimezisBlurView` 实验实现，性能开销高于 iOS；不能给长列表每个 item 都加实时模糊。
- `expo-linear-gradient`、`expo-blur`、`expo-system-ui` 都是原生模块，安装后需要重新构建 APK。
- `android/` 是 gitignored 的生成目录；本地已有构建辅助：
  - `mobile/android/aliyun-mirrors.gradle`
  - `gradle.properties` 堆内存 1536m
  预构建时可能被覆盖，需要备份/恢复。
- 手机已安装并配对，覆盖安装需保持相同 applicationId 与签名（debug keystore）。

---

## 4. 参考与复用

### 4.1 直接复用

- `src/shared/palette.ts`：冷色板、`resolveStickerColor`、`normalizeStickerColor`。
- `src/shared/types.ts`：`Sticker`、`StickerColor`。
- `src/renderer/utils/note.ts` 的文本工具（建议上移到 `src/shared/note.ts`）。
- `@shared/*` 路径与 Metro watchFolders。
- 现有同步、SQLite、凭证、导航逻辑。

### 4.2 扩展复用

- 新增 `mobile/src/theme.ts`：把桌面 token 转成 RN 可用的 hex/数值。
- 新增 `mobile/src/components/GlassSurface.tsx`：BlurView + LinearGradient + 边/阴影；列表可关闭 blur 用半透明实色。
- 新增 `GlassHeader`、`SearchField`、`FilterChips`、`StickerCard`、`EmptyState`、`StatusBadge`、`GlassToast`。
- 将 `extractTitle`/`stripHtml`/`extractSnippet`/`getChecklistProgress` 抽到 `src/shared/note.ts`，桌面与移动端共用。

### 4.3 不复用

- 不复用桌面 CSS/Tailwind（RN 没有 CSS）。
- 不引入完整 UI 框架（NativeBase/Paper）。
- 不给长列表每张卡片加 BlurView。
- 不升级 Expo/RN 核心，避免连锁原生问题。

---

## 5. 视觉规范：冷色极简玻璃（移动端）

### 5.1 背景

- 使用 `LinearGradient` 冷色渐变作为页面底色：
  - 亮色：`#F4F7FA → #E7EEF7`
  - 暗色：`#0B1220 → #111C2E`
- 叠加 2–3 个绝对定位的半透明圆形光斑（冰川蓝 / 青色，低透明度），让玻璃层有可感知的模糊对象。
- 内容使用 `SafeAreaView` + 内边距。

### 5.2 玻璃材质

`GlassSurface` 由四层组成：

1. `BlurView`（`intensity` 亮 55 / 暗 45，`tint` light/dark）；
2. `LinearGradient` 白色/黑色低透明高光；
3. 1px 发丝边：
   - 亮 `rgba(255,255,255,0.55)`
   - 暗 `rgba(255,255,255,0.08)`
4. 阴影/高度：
   - iOS `shadowColor #0F172A, opacity .10, radius 18, offset (0,8)`
   - Android `elevation: 6`

Android 使用 `experimentalBlurMethod="dimezisBlurView"`；如果当前 expo-blur 版本属性名不同，以安装版本的类型为准，并保留降级为半透明实色的能力。

**性能策略：**

- 标题栏、搜索框、底部 FAB、弹层、配对卡片：使用 BlurView；
- 列表卡片：使用半透明实色 + 高光边 + 阴影（`blur={false}`），保证滚动性能；
- 编辑页工具栏：使用半透明实色，避免覆盖 WebView 的模糊开销。

### 5.3 颜色 token

复用桌面冷色板（`src/shared/palette.ts`）：

| key | 亮背景 | 亮文字 | 暗背景 | 暗文字 |
|-----|--------|--------|--------|--------|
| ice | `#DFECFB` | `#1E3A5F` | `#1C2A3D` | `#DDE8F7` |
| lake | `#DCEDF3` | `#1F4650` | `#193238` | `#D8ECF1` |
| mint | `#DFF2EC` | `#1F4A3D` | `#173029` | `#D8F0E8` |
| rose | `#F5E6ED` | `#5A2A3D` | `#352631` | `#F5E3EA` |
| sage | `#E6EEE3` | `#33472F` | `#243027` | `#E4F0E0` |
| lilac | `#EAE5F8` | `#3B2F63` | `#28243A` | `#E8E3FA` |
| frost | `#FFFFFF` | `#0F172A` | `#1A2230` | `#E6EDF7` |
| cloud | `#ECEFF4` | `#334155` | `#232B35` | `#E5ECF4` |

全局：

- 主色：亮 `#2F6FED` / 暗 `#6AA5FF`
- 文字：亮 `#0F172A` / 暗 `#E6EDF7`
- 次要文字：亮 `#64748B` / 暗 `#8FA2B8`
- 分隔线：亮 `rgba(15,23,42,0.08)` / 暗 `rgba(148,163,184,0.14)`
- 成功 `#047857` / 暗 `#34D399`；警告 `#B45309` / 暗 `#FBBF24`；危险 `#DC2626` / 暗 `#F87171`

旧色值通过 `resolveStickerColor` 映射，不迁移 SQLite 数据。

### 5.4 字体、间距、圆角、阴影

- 字体：系统字体（Android Roboto），不新增字体文件。
- 字号：11 辅助 / 13 正文 / 15 标题 / 20 页面标题 / 28 配对页主标题。
- 行高：正文 1.5，标题 1.25。
- 间距：4/8/12/16/20/24/32。
- 圆角：卡片/输入框 16，按钮 14，FAB 20，弹层 20，chips 999。
- 阴影：`shadow` + Android `elevation`；不使用重阴影。

### 5.5 图标

- 使用 `lucide-react-native`（依赖已有的 `react-native-svg`，无新增原生模块）。
- 尺寸 16/18/20，`strokeWidth={1.75}`。
- 替换列表/编辑/配对中的文字符号（⟳、+、← 等）。

---

## 6. 页面设计

### 6.1 App Shell

- `App.tsx`：
  - `SafeAreaProvider` 包裹；
  - `useColorScheme()` 决定 `isDark`；
  - 自定义 `NavigationContainer` theme（背景透明、主色 accent）；
  - `<StatusBar style={isDark ? 'light' : 'dark'} />`；
  - `screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}`。
- 每个页面用 `ScreenBackground`：冷色渐变 + 光斑 + 安全区内边距。

### 6.2 配对页

- 顶部：玻璃圆形 App 图标 + 主标题「连接电脑便签」+ 副标题。
- 玻璃卡片：
  - 服务器地址输入（半透明输入框，mono 字体）；
  - 配对码输入（大号、居中、字距）；
  - 主按钮「确认配对」；
  - 次按钮「扫描二维码」。
- 扫码视图：
  - 相机全屏，玻璃取景框 + 四角高光；
  - 顶部/底部玻璃浮层；
  - 取消按钮。
- 错误使用玻璃 Toast/内联红字；loading 使用 accent ActivityIndicator。
- 保持现有配对逻辑与默认服务器地址。

### 6.3 列表页

- 顶部玻璃 Header（安全区）：
  - 左：App 名称「便签」；
  - 中/右：同步状态徽标（StatusBadge）+ 同步按钮（RefreshCw）+ 更多菜单（LogOut/解除配对）。
- 搜索框：玻璃 `SearchField`，左侧搜索图标、右侧清除。
- 筛选 chips（横向滚动）：全部、标签、置顶、提醒。
- FlatList：
  - 卡片半透明实色 + 圆角 16 + 发丝边 + 阴影；
  - 颜色圆点、标题、摘要 2 行、标签（≤3）、相对时间、置顶/提醒图标；
  - 长按删除（保留 Alert 确认）；
  - 下拉刷新（`tintColor` accent）；
  - 空状态：玻璃圆 + 图标 + 标题 + 说明 + 「新建便签」。
- 底部/右下 FAB：玻璃圆 + Plus，创建新便签。
- 同步：保留进入列表页自动同步、手动同步、下拉刷新；失败用玻璃 Toast。
- 解除配对：Header 的菜单图标触发 Alert 确认。

### 6.4 编辑页

- 顶部玻璃 Header：返回、保存状态（「已保存 / 保存中…」）、同步、删除。
- 颜色行：8 个冷色圆点（横向排列），选中 accent 圆环；背景即时切换。
- 富文本工具栏：半透明工具栏 + 现有 Pell 操作（加粗/斜体/列表/撤销/重做）。
- 编辑区：RichEditor 背景使用当前便签色（亮/暗模式对应），文字色使用色板文字色；WebView 设置透明/背景色。
- 保留自动保存、返回前主动读取 HTML、同步、删除逻辑。
- 深色模式下编辑器背景/文字/工具栏同步。

### 6.5 反馈

- 新增轻量玻璃 Toast（自定义 Animated，或 Android `ToastAndroid` + 玻璃风格胶囊）：
  - 成功：同步完成、删除成功；
  - 失败：同步失败、配对失败。
- 删除/解除配对继续用系统 Alert 确认。
- 同步状态徽标：已连接/同步中/异常/未配对。

---

## 7. 组件与职责边界

| 文件 | 职责 |
|------|------|
| `mobile/src/theme.ts` | 明暗颜色、间距、圆角、阴影、字体 |
| `mobile/src/components/GlassSurface.tsx` | BlurView/渐变/边/阴影容器，`blur` 开关 |
| `mobile/src/components/ScreenBackground.tsx` | 冷色渐变 + 光斑 |
| `mobile/src/components/GlassHeader.tsx` | 安全区标题栏 |
| `mobile/src/components/SearchField.tsx` | 玻璃搜索输入 |
| `mobile/src/components/FilterChips.tsx` | 筛选 chips |
| `mobile/src/components/StickerCard.tsx` | 列表卡片 |
| `mobile/src/components/EmptyState.tsx` | 空状态 |
| `mobile/src/components/StatusBadge.tsx` | 同步状态 |
| `mobile/src/components/GlassToast.tsx` | 反馈 |
| `mobile/src/hooks/useAppTheme.ts` | `useColorScheme` + theme |
| 三个 Screen | 页面组合与业务逻辑 |

不把同步/DB 逻辑放进展示组件；复用现有 `syncClient`、`db`。

---

## 8. 接口与数据

### 8.1 依赖

```bash
cd mobile
npx expo install expo-blur expo-linear-gradient expo-system-ui
npm i lucide-react-native
```

- 使用 `expo install` 选择 SDK 58 兼容版本（`expo-blur 58.x`、`expo-linear-gradient 58.x`）。
- `lucide-react-native` 纯 JS，依赖已存在的 `react-native-svg`。
- 不升级 `expo`/`react-native` 核心；`expo install --check` 提示的 58.0.17→58.0.19 不动。

### 8.2 配置

`mobile/app.json`：

```json
{
  "expo": {
    "userInterfaceStyle": "automatic",
    "version": "1.1.0",
    "android": {
      "versionCode": 2
    }
  }
}
```

- 使用 `expo-system-ui` 让 Android 根视图/背景支持深色。
- `expo-build-properties` 的 `usesCleartextTraffic: true` 保留。

### 8.3 共享颜色与文本

- 移动端从 `@shared/palette` 引入 `STICKER_PALETTE`、`resolveStickerColor`、`normalizeStickerColor`。
- 建议把 `stripHtml`/`extractTitle`/`extractSnippet`/`getChecklistProgress` 移到 `src/shared/note.ts`：
  - 桌面 `src/renderer/utils/{note,position}.ts` 改为 re-export/引用；
  - 移动端 `src/utils/text.ts` 改为引用；
  - 两端标题行为一致（第一个段落/列表项）。
- 无 SQLite 表结构变化；旧 color 值渲染时映射；新便签写入新冷色。

### 8.4 原生构建

- 安装原生模块后需要重新 prebuild/构建：
  ```bash
  cd mobile
  npx expo prebuild --platform android
  ```
- `android/` 是 gitignored 生成目录；本地已有：
  - `android/aliyun-mirrors.gradle`
  - `gradle.properties` 堆 1536m
  预构建前备份，预构建后恢复；构建时继续用：
  ```bash
  cd mobile/android
  JAVA_HOME=... ./gradlew assembleRelease \
    -PreactNativeArchitectures=arm64-v8a \
    -I aliyun-mirrors.gradle
  ```
- 覆盖安装：
  ```bash
  adb install -r app/build/outputs/apk/release/app-release.apk
  ```

### 8.5 版本

- `app.json` version `1.1.0`、android versionCode `2`。
- 同包名 `com.stickernote.mobile`、debug 签名，`adb install -r` 可保留数据与配对。

---

## 9. 边界与异常

| 场景 | 预期 |
|------|------|
| Android 上 BlurView 性能差/不生效 | `GlassSurface` 自动/手动降级为半透明实色 |
| 深色模式系统切换 | 所有页面、状态栏、输入框、编辑器同步 |
| 旧便签色值 | `resolveStickerColor` 映射到冷色；不迁移 DB |
| 桌面新冷色便签 | 手机列表/编辑页正确显示并选中 |
| 网络不可用 | 列表仍显示本地数据；同步失败 Toast；不阻塞 UI |
| 配对服务器不可达 | 配对页内联错误 + Toast，不崩溃 |
| 相机权限拒绝 | Alert 提示去设置；可手输配对码 |
| RichEditor WebView 深色背景 | 设置 `editorStyle`/背景色，避免白底闪烁 |
| 长列表 | 卡片不启用实时模糊；滚动流畅 |
| 覆盖安装 | 保留 SQLite/AsyncStorage；配对状态不丢 |
| 预构建覆盖本地构建配置 | 备份/恢复 aliyun-mirrors.gradle 与堆设置 |
| 构建内存不足 | 使用 arm64 单架构、1536m 堆；必要时关闭 IDE/其他构建 |
| iOS | 本阶段不构建 |

---

## 10. 风险与兼容性

| 风险 | 影响 | 应对 |
|------|------|------|
| expo-blur Android 实现差异 | 模糊效果不一致/卡顿 | 只用于少量区域；列表卡片用实色半透明；保留降级 |
| 新增原生模块 | 必须重新构建 | 预留构建时间；先 prebuild 再 Gradle |
| 预构建覆盖本地镜像/内存配置 | 构建卡住/OOM | 备份恢复 `aliyun-mirrors.gradle` 和 gradle.properties |
| 深色模式配置不生效 | 部分页面仍是白底 | 使用 `useColorScheme` + `expo-system-ui`；在真机验证 |
| WebView 背景 | 编辑区白底/文字对比度 | 显式设置编辑器背景/文字色 |
| 两端颜色不一致 | 取色器选中错位 | 共用 `@shared/palette` 与旧色映射 |
| 版本/签名 | 覆盖安装失败 | 保持包名/debug keystore；versionCode 递增 |
| 构建时间长 | 交付慢 | arm64 单架构；缓存 Gradle/NDK；关闭占内存应用 |

---

## 11. 验证策略

### 11.1 静态

- `cd mobile && npx tsc --noEmit`。
- `npx expo-doctor`（可选，检查依赖兼容）。

### 11.2 真机 UI

- 重新构建 APK，`adb install -r` 覆盖安装，保留数据/配对。
- 列表：
  - 亮/暗模式截图；
  - 搜索、筛选、下拉刷新、同步、长按删除、FAB 新建；
  - 卡片颜色/标题/摘要/标签/时间/置顶/提醒。
- 编辑页：
  - 8 个冷色切换；
  - 富文本加粗/斜体/列表/撤销；
  - 保存状态、返回保存、同步、删除；
  - 暗色模式。
- 配对页：
  - 用 Expo Go/开发模式查看，或临时解除配对后重新配对（测试后恢复）；
  - 输入服务器地址/配对码、扫码入口、错误态。
- 深色模式：系统切换；状态栏/背景/卡片/输入框/编辑器。
- 同步：手动同步、聚焦自动同步、失败 Toast。
- 性能：列表快速滚动，观察是否掉帧；模糊区域数量。

### 11.3 未自动化

- 相机扫码、真实服务器配对、系统深色切换的完全自动化。
- iOS 构建。
- Android 不同厂商/版本的 BlurView 表现。

---

## 12. 关键决策（需确认）

1. **玻璃实现**：`expo-blur` + `expo-linear-gradient`；标题栏/搜索框/按钮/弹层用 BlurView，列表卡片用半透明实色（性能优先），Android 用 `dimezisBlurView` 实验实现并保留降级。
2. **范围**：配对页、列表页、编辑页 + 深色模式 + 冷色板对齐；不做通知/小组件/标签编辑/多选。
3. **依赖**：新增 `expo-blur`、`expo-linear-gradient`、`expo-system-ui`、`lucide-react-native`；不升级 Expo/RN 核心。
4. **原生构建**：安装后 `expo prebuild`，备份/恢复本地 `aliyun-mirrors.gradle` 与 Gradle 堆配置，重新打 arm64 APK。
5. **版本**：移动端 1.1.0 / versionCode 2，覆盖安装保留数据与配对。
6. **共享逻辑**：冷色板与标题/摘要工具上移到 `src/shared`，桌面与移动端共用；不改 server/DB/同步协议。
