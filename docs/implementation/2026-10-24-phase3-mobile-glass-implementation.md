# Phase 3 编码实现文档：移动端冷色玻璃 UI

> 对应设计文档：`docs/design/2026-10-24-phase3-mobile-glass-design.md`
> 版本：v1.0 · 日期：2026-10-24 · 状态：待确认

---

## 1. 变更概览

1. 新增移动端主题 token 与玻璃基础组件（BlurView + LinearGradient）。
2. 配对页、列表页、编辑页全部改为冷色极简玻璃。
3. 支持系统深色模式，状态栏/导航/卡片/输入框/编辑器同步。
4. 复用桌面共享冷色板与旧色映射；把标题/摘要工具上移到 `src/shared`。
5. 移动端版本升到 1.1.0 / versionCode 2，重新 prebuild、打 arm64 APK 并覆盖安装。
6. 不改服务端、数据库、同步协议与同步逻辑。

---

## 2. 逐文件清单

### 2.1 新增

| 路径 | 说明 |
|------|------|
| `src/shared/note.ts` | 共享标题/摘要/待办进度工具 |
| `mobile/src/theme.ts` | 明暗颜色、间距、圆角、阴影、字体 + `useAppTheme` |
| `mobile/src/components/ScreenBackground.tsx` | 冷色渐变 + 光斑背景 |
| `mobile/src/components/GlassSurface.tsx` | BlurView/半透明表面容器 |
| `mobile/src/components/GlassHeader.tsx` | 安全区玻璃标题栏 |
| `mobile/src/components/SearchField.tsx` | 玻璃搜索输入 |
| `mobile/src/components/FilterChips.tsx` | 筛选 chips |
| `mobile/src/components/StickerCard.tsx` | 列表卡片 |
| `mobile/src/components/EmptyState.tsx` | 空状态 |
| `mobile/src/components/StatusBadge.tsx` | 同步状态徽标 |
| `mobile/src/components/GlassToast.tsx` | 玻璃 Toast Provider |

### 2.2 修改

| 路径 | 说明 |
|------|------|
| `mobile/package.json` / `package-lock.json` | 新增玻璃/图标依赖 |
| `mobile/app.json` | `userInterfaceStyle: automatic`、版本 1.1.0/2 |
| `mobile/App.tsx` | SafeArea/Toast/Navigation 主题/状态栏/深色 |
| `mobile/src/screens/PairingScreen.tsx` | 冷色玻璃配对页 |
| `mobile/src/screens/StickerListScreen.tsx` | 冷色玻璃列表页 |
| `mobile/src/screens/StickerEditorScreen.tsx` | 玻璃编辑页 + 冷色板 + 深色 |
| `mobile/src/utils/text.ts` | 改为引用 `@shared/note` |
| `src/renderer/utils/note.ts` | 改为 re-export 共享工具 |
| `src/renderer/utils/position.ts` | `extractTitle` 改为 re-export |
| `mobile/android/gradle.properties` | 预构建后恢复 1536m 堆 |
| `mobile/android/aliyun-mirrors.gradle` | 保留构建镜像脚本 |

### 2.3 删除

无文件删除。

---

## 3. 文件职责

| 文件 | 职责 |
|------|------|
| `shared/note.ts` | 纯文本/HTML 解析，无 React/Electron 依赖 |
| `mobile/src/theme.ts` | 颜色与尺寸 token；`useColorScheme` 选择主题 |
| `GlassSurface` | 玻璃/半透明表面视觉；不处理业务 |
| `GlassHeader` | 安全区 + 标题/操作布局 |
| `StickerListScreen` | 列表状态、筛选、同步、删除、创建 |
| `StickerEditorScreen` | 编辑、颜色、自动保存、同步、删除 |
| `PairingScreen` | 配对输入/扫码/错误处理 |
| `GlassToast` | 全局反馈 |

约束：

- 展示组件不直接调用 SQLite/同步；由 Screen 调用。
- `GlassSurface` 不引入业务颜色，颜色全部来自 theme。
- 共享 `note.ts` 不引入 React/RN。
- 列表卡片不使用实时 BlurView（性能）。

---

## 4. 项目风格参考

| 参考 | 采用的写法 |
|------|-----------|
| 现有移动 Screen | 函数组件 + `useState/useCallback/useFocusEffect` |
| `mobile/src/api/syncClient.ts` | 中文错误、async/await |
| 桌面 `src/shared/palette.ts` | 共享色板与解析函数 |
| 桌面 `src/renderer/utils/note.ts` | 文本工具上移共享 |
| 现有 `StyleSheet` | 改为 theme + 内联样式/少量 StyleSheet |

---

## 5. 复用清单

### 5.1 直接复用

- `STICKER_PALETTE`、`resolveStickerColor`、`normalizeStickerColor`。
- `getActiveStickers`、`upsertSticker`、`softDeleteSticker`。
- `syncNow`、`isPaired`、`unpair`。
- `@shared/*` 路径与 Metro watchFolders。
- `react-native-safe-area-context`、`expo-status-bar`、`react-native-svg`。

### 5.2 扩展复用

- `extractTitle`/`stripHtml`/`extractSnippet`/`getChecklistProgress` 上移到 `src/shared/note.ts`。
- 移动端 `src/utils/text.ts` 变为 re-export。
- 桌面 `note.ts`/`position.ts` 变为 re-export，保持调用方不变。
- 移动端编辑页颜色从旧 8 色换成共享冷色板。

### 5.3 不复用

- 不复用桌面 CSS/Tailwind。
- 不引入 NativeBase/Paper。
- 不给列表卡片逐卡实时模糊。
- 不升级 Expo/RN 核心。

---

## 6. 接口与数据变化

### 6.1 依赖

```bash
cd mobile
npx expo install expo-blur expo-linear-gradient expo-system-ui
npm i lucide-react-native
```

- 使用 `expo install` 选择 SDK 58 兼容版本。
- `lucide-react-native` 依赖已有 `react-native-svg`。
- 不升级 `expo`/`react-native` 核心。

### 6.2 app.json

```json
{
  "expo": {
    "version": "1.1.0",
    "userInterfaceStyle": "automatic",
    "android": {
      "versionCode": 2
    }
  }
}
```

- 保留 `expo-build-properties` 的 `usesCleartextTraffic: true`。
- 保留 `expo-camera` 与 `expo-sqlite` 插件。

### 6.3 主题接口

```ts
export interface AppTheme {
  dark: boolean;
  colors: {
    backgroundStart: string;
    backgroundEnd: string;
    text: string;
    textMuted: string;
    textSubtle: string;
    accent: string;
    accentSoft: string;
    success: string;
    warning: string;
    danger: string;
    border: string;
    surface: string;
    surfaceGlass: string;
    glassTint: 'light' | 'dark';
    glassIntensity: number;
  };
  spacing: Record<'xs'|'sm'|'md'|'lg'|'xl'|'xxl', number>;
  radius: Record<'sm'|'md'|'lg'|'xl'|'pill', number>;
  typography: { body: number; title: number; pageTitle: number; caption: number };
}

export function useAppTheme(): AppTheme;
```

### 6.4 共享文本工具

`src/shared/note.ts`：

```ts
export function stripHtml(html: string): string;
export function extractTitle(content: string): string;
export function extractSnippet(html: string, title?: string, maxLength?: number): string;
export function getChecklistProgress(html: string): { done: number; total: number };
export function escapeRegExp(value: string): string;
```

- 桌面 `src/renderer/utils/note.ts` 与 `position.ts` 改为 re-export。
- 移动端 `src/utils/text.ts` 改为 re-export。

### 6.5 数据

- 无 SQLite 表结构变化。
- 旧 `color` 值渲染时通过 `resolveStickerColor` 映射。
- 新建便签使用冷色板默认 `ice` `#DFECFB`。
- 无 server/DB/同步协议改动。

### 6.6 版本与签名

- `versionName 1.1.0`、`versionCode 2`。
- 包名 `com.stickernote.mobile`，debug keystore 不变；覆盖安装保留数据/配对。

---

## 7. 实现步骤

### 步骤 1：依赖与配置

1. `cd mobile && npx expo install expo-blur expo-linear-gradient expo-system-ui`。
2. `npm i lucide-react-native`。
3. 修改 `mobile/app.json`：version 1.1.0、android.versionCode 2、`userInterfaceStyle: "automatic"`。
4. 备份 `mobile/android/aliyun-mirrors.gradle` 与 `gradle.properties`。
5. 后续步骤完成后执行 `npx expo prebuild --platform android`，恢复构建辅助文件与 1536m 堆。

完成条件：`mobile/package.json` 包含新依赖；app.json 配置正确。

### 步骤 2：共享文本工具

1. 新建 `src/shared/note.ts`，实现文本工具；`extractTitle` 取第一个段落/标题/列表项。
2. `src/renderer/utils/note.ts` 改为 re-export。
3. `src/renderer/utils/position.ts` 的 `extractTitle` 改为 re-export。
4. `mobile/src/utils/text.ts` 改为 `export { extractTitle } from '@shared/note';`。
5. 桌面与移动端相关 import 保持路径不变。

完成条件：桌面 `npm run typecheck`、移动端 `npx tsc --noEmit` 均通过。

### 步骤 3：主题与玻璃组件

1. 新建 `mobile/src/theme.ts`：
   - 亮/暗 token；
   - `useAppTheme()`。
2. `ScreenBackground`：
   - `LinearGradient` 全屏；
   - 2–3 个低透明度光斑；
   - `SafeAreaView`/insets 由页面处理。
3. `GlassSurface`：
   - `blur` 默认 true；`blur=false` 使用半透明 `surfaceGlass`；
   - `BlurView` + `LinearGradient` 高光 + 边框 + shadow/elevation；
   - Android `experimentalBlurMethod="dimezisBlurView"`（以安装版本类型为准）；
   - 圆角与 `overflow:'hidden'`。
4. `GlassHeader`：安全区顶部 + 标题/操作。
5. `SearchField`、`FilterChips`、`StatusBadge`、`EmptyState`、`GlassToast`。

完成条件：组件在亮/暗主题下可渲染；Toast 可自动消失。

### 步骤 4：App Shell

1. `App.tsx`：
   - `SafeAreaProvider` + `ToastProvider`；
   - `useAppTheme()`；
   - `StatusBar` 亮/暗；
   - `NavigationContainer` 自定义 theme（背景透明、accent）；
   - `paired === null` 时显示渐变加载页。
2. `expo-system-ui` 设置根背景（try/catch）。

完成条件：首屏/导航/状态栏跟随深色。

### 步骤 5：配对页

1. `ScreenBackground` + 安全区。
2. 玻璃卡片：服务器地址、配对码、确认按钮、扫码按钮。
3. 扫码视图：CameraView + 玻璃取景框/浮层/取消。
4. 错误内联 + Toast；loading；权限 Alert。
5. 保留 `redeemPairingCode` 逻辑与默认服务器地址。

完成条件：配对页在亮/暗模式下正常；扫码/手输流程不变。

### 步骤 6：列表页

1. `ScreenBackground` + `GlassHeader`（标题、StatusBadge、同步/更多）。
2. `SearchField` + `FilterChips`（全部/标签/置顶/提醒）。
3. `FlatList` + `StickerCard`（`blur={false}`）：
   - 颜色圆点、标题、摘要、标签、时间、置顶/提醒；
   - 长按删除（Alert 确认）；
   - 下拉刷新；
   - 空状态。
4. FAB「新建」：玻璃圆 + Plus。
5. 同步：进入页面自动同步、手动同步、下拉刷新；成功/失败 Toast。
6. 解除配对：Header 更多菜单 → Alert 确认。
7. 新建便签颜色使用 `STICKER_PALETTE[0].color`。

完成条件：搜索/筛选/同步/新建/删除/下拉刷新正常；暗色正确。

### 步骤 7：编辑页

1. `ScreenBackground` + `GlassHeader`：返回、保存状态、同步、删除。
2. 颜色行：`STICKER_PALETTE` 8 色，选中 accent 环；点击持久化。
3. 富文本工具栏：现有 Pell 操作，使用主题色。
4. RichEditor：
   - 背景 = `theme.dark ? palette.darkColor : palette.color`；
   - 文字 = `theme.dark ? darkTextColor : textColor`；
   - 透明/背景色显式设置，避免白底。
5. 保存：
   - 保留 `onChange`/`onBlur`/返回前主动读取 HTML；
   - 增加 400ms 防抖保存，减少 SQLite 写入；
   - Header 显示「保存中… / 已保存」。
6. 删除/同步保留现有逻辑；Toast 反馈。

完成条件：冷色切换即时生效；富文本/保存/返回/同步/删除正常；暗色编辑器无白底。

### 步骤 8：清理旧样式

- 移除三个 Screen 中旧 `StyleSheet` 颜色/固定 paddingTop 56（改用安全区）。
- 移除编辑页旧 `COLOR_OPTIONS`。
- 搜索/列表/配对中的文字符号替换为 Lucide 图标。
- 保留业务逻辑与同步调用。

### 步骤 9：prebuild、打包、安装

1. 恢复/确认 `mobile/android/aliyun-mirrors.gradle` 与 `gradle.properties`（1536m）。
2. `npx expo prebuild --platform android`（不加 `--clean`，避免删掉本地辅助；如被覆盖则从备份恢复）。
3. 检查 `AndroidManifest.xml` 仍有 `usesCleartextTraffic="true"` 与 CAMERA/INTERNET。
4. 构建：
   ```bash
   cd mobile/android
   JAVA_HOME="C:/Users/DSL/.jdks/ms-17.0.16" \
   ANDROID_HOME="C:/Users/DSL/AppData/Local/AndroidToolchain/sdk" \
   ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a \
     -I aliyun-mirrors.gradle --no-daemon --console=plain
   ```
5. 安装：
   ```bash
   adb install -r app/build/outputs/apk/release/app-release.apk
   ```
6. 启动并截图验证。

完成条件：versionName 1.1.0 / versionCode 2；覆盖安装成功；数据/配对保留。

---

## 8. 测试用例

| # | 类型 | 输入/动作 | 预期 |
|---|------|-----------|------|
| 1 | 正常 | 打开 App（已配对） | 进入玻璃列表页 |
| 2 | 正常 | 列表亮/暗模式 | 渐变背景、玻璃 Header、卡片正确 |
| 3 | 正常 | 搜索关键词 | 列表过滤 |
| 4 | 正常 | 筛选标签/置顶/提醒 | 结果正确 |
| 5 | 正常 | 下拉刷新 | 触发同步，结束刷新 |
| 6 | 正常 | 手动同步 | 成功 Toast；失败 Toast；列表更新 |
| 7 | 正常 | FAB 新建 | 创建便签并进入编辑页 |
| 8 | 正常 | 长按卡片删除 | Alert 确认；删除并刷新 |
| 9 | 正常 | 点击卡片 | 进入编辑页 |
| 10 | 正常 | 编辑页切换 8 个冷色 | 背景/文字即时变化 |
| 11 | 正常 | 加粗/斜体/列表/撤销/重做 | 富文本生效 |
| 12 | 正常 | 输入后等待/返回/失焦 | 保存状态正确，数据落库 |
| 13 | 正常 | 编辑页同步 | 成功/失败 Toast |
| 14 | 正常 | 编辑页删除 | Alert 确认；返回列表 |
| 15 | 正常 | 系统切换深色 | 所有页面/状态栏/编辑器同步 |
| 16 | 正常 | 旧色值便签 | 显示为映射后的冷色 |
| 17 | 正常 | 桌面新建冷色便签同步到手机 | 列表/取色器正确显示 |
| 18 | 正常 | 解除配对 | Alert 确认；回到配对页 |
| 19 | 正常 | 配对页手输代码 | 配对成功/错误提示 |
| 20 | 正常 | 扫码 | 相机权限/扫码/配对 |
| 21 | 边界 | 服务器不可达 | 错误 Toast，不崩溃 |
| 22 | 边界 | 相机权限拒绝 | 提示去设置，仍可手输 |
| 23 | 边界 | 列表大量便签滚动 | 无明显掉帧（卡片无 BlurView） |
| 24 | 正常 | 覆盖安装 | 便签/配对保留 |

---

## 9. 验证命令

```bash
cd mobile
npx tsc --noEmit

cd android
JAVA_HOME="C:/Users/DSL/.jdks/ms-17.0.16" \
ANDROID_HOME="C:/Users/DSL/AppData/Local/AndroidToolchain/sdk" \
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a \
  -I aliyun-mirrors.gradle --no-daemon --console=plain

adb install -r app/build/outputs/apk/release/app-release.apk
```

真机验证：

- 系统深色切换：`adb shell cmd uimode night yes` / `no`，截图列表/编辑页。
- 列表/编辑页截图；必要时用 `adb shell input tap` 进行颜色切换。
- 配对页视觉可通过 Expo Go/开发模式查看，避免解除现有配对；如临时解除，测试后重新配对。
- 同步依赖真实服务端；失败时记录网络/服务器原因。

项目无移动端测试框架；不新增。

---

## 10. 文档一致性与偏差

| 设计 | 实现 | 说明 |
|------|------|------|
| 真玻璃 | BlurView + LinearGradient | 列表卡片用半透明实色，已确认 |
| 冷色板 | 共享 `@shared/palette` | 旧色映射，不迁移数据 |
| 深色模式 | `useColorScheme` + `expo-system-ui` + app.json automatic | 需 prebuild |
| 版本 | 1.1.0 / versionCode 2 | 覆盖安装保留数据 |
| 编辑自动保存 | 增加 400ms 防抖 | 性能优化，不改变保存结果 |
| 标题/摘要 | 上移 `src/shared/note.ts` | 桌面/移动端共用 |
| 配对页默认地址 | 保持不变 | 用户可手输/扫码 |
| 通知/小组件/标签编辑 | 不做 | 非目标 |

确认后我将按步骤 1–9 实施：先加依赖、共享工具和玻璃组件，再改三页，最后 prebuild、打 APK、覆盖安装并截图验证。

---

## 11. 真机问题修复（2026-10-26）

真机（Android 15，arm64）验证后修正三处：

1. **卡片内出现亮色内层矩形**
   - 现象：`GlassSurface` 使用半透明底色（`surfaceGlass`）+ `elevation` 时，Android 会在内容区渲染出一块方形亮块，四周偏暗。
   - 定位：临时把非模糊分支底色改为不透明洋红后瑕疵消失，确认是「半透明底色 + elevation」的合成问题。
   - 修复：主题新增 `surfaceCard`（`surfaceGlass` 与页面背景的预合成不透明色：亮 `#F8FAFC`、暗 `#111B2C`），列表卡片等非模糊表面改用它；视觉仍是设计中的「半透明实色」，但避免了渲染瑕疵。

2. **列表卡片过高**
   - 时间戳移入标题行右侧，标签行仅在存在标签时渲染，单行便签卡片由约 91dp 收到约 57dp。

3. **打开便签自动弹出键盘**
   - `RichEditor` 设为 `initialFocus={false}`；点击编辑区仍可正常唤起键盘（真机验证 `mInputShown=true`），未聚焦时单击返回键直接回列表。

真机复核：亮/暗两套列表页与编辑页截图正常，`adb install -r` 覆盖安装保留数据。
