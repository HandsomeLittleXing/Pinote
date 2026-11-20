# 第一套「贴纸」皮肤冰箱贴布局与插画编码实现文档

> 日期：2026-11-19
> 状态：用户已确认，已实现；类型检查与构建通过，Android 实机待验证
> 对应设计：[2026-11-19-sticker-fridge-layout-design.md](../design/2026-11-19-sticker-fridge-layout-design.md)
> 范围：Windows 桌面端与 Android App 同步修改

## 1. 变更概览

在现有 `glass`／「贴纸」皮肤分支内，用便签 ID 稳定选择错落布局模板和 16 款原创线稿。桌面默认列表、手机默认列表呈现有节奏的轻微错位；筛选结果维持整齐列表。桌面独立便签和手机 WebView 编辑区将相同的便签线稿放在文字下层。便签数据和同步协议不变。

## 2. 逐文件清单与职责

| 操作 | 文件 | 唯一主要职责及接口／直接依赖 |
| --- | --- | --- |
| 修改 | `src/shared/stickerDoodles.ts` | 增加 8 组原创 SVG 路径；保留 `getStickerDoodleForId(id)`；新增 `getStickerScatterVariant(id)` 返回 0–5 的稳定模板编号，及 `getStickerDoodleDataUri(name, ink, opacity)` 供 WebView 使用。只依赖标准 JS 字符串与数字能力 |
| 修改 | `src/shared/palette.ts` | 将第一套皮肤的浅色纸张映射调到预览图的柔黄、浅粉、薄荷绿和淡蓝；桌面与手机共用颜色语义 |
| 修改 | `src/renderer/components/StickerListItem.tsx` | 用模板编号标记第一套皮肤卡片，并调整线稿的角落位置；继续依赖共享线稿、现有 `Sticker` 与菜单组件 |
| 修改 | `src/renderer/styles/globals.css` | 定义桌面列表 6 个轻微错位样式、容器留白和窄窗口单列规则；继续由 `data-skin='glass'` 限定作用域 |
| 修改 | `src/renderer/components/StickerEditor.tsx` | 在第一套皮肤的独立便签编辑区加入同款 SVG 装饰层；继续依赖共享线稿与既有 Tiptap 编辑器 |
| 修改 | `src/renderer/styles/sticker.css` | 定义独立便签装饰层与正文的层级、裁切及深浅色透明度；不改工具栏与窗口拖动规则 |
| 修改 | `mobile/src/screens/StickerListScreen.tsx` | 默认第一套皮肤的 `FlatList` 不再受 6 张上限约束；根据屏幕宽度与字体缩放选择双列或单列；筛选仍走标准列表 |
| 修改 | `mobile/src/theme.tsx` | 第一套浅色皮肤使用预览图的暖灰页面、近白表面与深绿墨色 |
| 修改 | `mobile/src/components/SearchField.tsx` | 第一套皮肤搜索框使用较页面表面稍深的暖灰底色 |
| 修改 | `mobile/src/components/StickerCard.tsx` | 将模板编号映射为手机卡片的倾角、错位、最小高度和线稿尺寸；保留 `onPress`、`onLongPress` 和信息内容 |
| 修改 | `mobile/src/screens/StickerEditorScreen.tsx` | 由便签 ID 获取同款 SVG 数据 URI，在 `RichEditor` 初始化 CSS 与运行时 `commandDOM` 中设置／清除 WebView 背景图；继续保留实色背景与现有保存逻辑 |

本次不计划新增或删除业务文件，不修改 `mobile/src/components/StickerDoodles.tsx` 的页面背景线稿。以上文件已有未提交修改；实施时在当前内容上做最小增量，不覆盖现有字体、提醒、AI 和列表管理变更。

## 3. 项目风格参考与复用

| 类型 | 现有实现 | 采用方式 |
| --- | --- | --- |
| 直接复用 | `getStickerDoodleForId`、`STICKER_DOODLES` | 列表与编辑页共用便签 ID 选图，保持桌面／手机一致 |
| 直接复用 | `StickerList.tsx` 的 `showGlassComposition` | 桌面默认列表仍采用首卡 + 双列；现有搜索／筛选分支不变，因此不需改此文件 |
| 扩展复用 | `StickerCard.tsx` 的 `featured`／`compact` 变体 | 手机继续使用既有卡片信息层级，增加稳定模板，而非新造列表组件 |
| 扩展复用 | `StickerEditorScreen.tsx` 的颜色变更 `commandDOM` | 同一次同步更新正文颜色、纸面颜色与 SVG 背景；复用 WebView 就绪前失败时的安全回退 |
| 不复用 | `mobile/src/components/StickerDoodles.tsx` | 该组件是页面级散点背景，不能保证每张便签与编辑页是同一幅图 |
| 不复用 | 可拖拽坐标或瀑布流库 | 用户确认自动错落；引入拖拽／新依赖会改变数据与交互，`FlatList` 已满足虚拟化需求 |

桌面样式继续沿用项目的 `data-skin` 作用域和 CSS class；手机继续沿用 React Native `View`、`FlatList`、`react-native-svg`。图案路径保存在共享 TypeScript 中，不增加图片下载、字体或原生依赖。

## 4. 接口、数据与兼容

### 4.1 共享展示接口

```ts
type StickerScatterVariant = 0 | 1 | 2 | 3 | 4 | 5;

function getStickerScatterVariant(id: string): StickerScatterVariant;
function getStickerDoodleDataUri(
  name: StickerDoodleName,
  ink: string,
  opacity: number,
): string;
```

`getStickerScatterVariant` 从 ID 计算固定模板编号，不读取列表序号、随机数或时间。`getStickerDoodleDataUri` 仅序列化静态路径，颜色来自主题 token，返回 `data:image/svg+xml,` 加 URL 编码的 SVG；输出只作为 CSS 背景。其透明度在调用处限制到 0–1。`StickerDoodleName` 随 8 个新键扩展，现有函数签名不变。

增加图案数量会使部分现有便签的自动选图在升级时变化一次；之后桌面、手机和重启后的结果稳定。没有用户自选图案字段，故不进行迁移。

### 4.2 数据与外部边界

不新增或修改 `Sticker` 字段、设置键、SQLite 表、服务端 DDL、HTTP/IPC、同步消息或原生权限。没有数据库迁移与回滚步骤。应用主题 ID 仍为 `glass`；其他皮肤只沿用旧渲染分支。

## 5. 实现顺序与完成条件

1. **共享线稿与模板**：在 `stickerDoodles.ts` 增加兔子、鸭子、小象、鱼、蘑菇、云、铅笔、气球 8 款；提取稳定 ID 哈希并新增模板与 SVG URI 函数。完成条件：空 ID、普通 UUID 均返回合法图案和模板；生成的 SVG 字符串可被 WebView CSS 作为背景使用。
2. **桌面列表**：`StickerListItem.tsx` 为第一套皮肤卡片设置模板标记；`globals.css` 将模板映射为不超过约 2° 的旋转、约 12px 内错位与高度节奏，增加足够行间距；低于现有 399px 断点转单列。完成条件：首卡、长列表、悬停、菜单和键盘焦点不被裁切；筛选布局不改变。
3. **桌面独立便签**：`StickerEditor.tsx` 在未收起的编辑区插入 `aria-hidden` SVG，`sticker.css` 让它绝对定位于正文下层且 `pointer-events: none`。完成条件：同 ID 与列表同图，160px 窄窗口仍能输入、拖动和打开工具栏。
4. **手机列表**：`StickerListScreen.tsx` 用 `useWindowDimensions()` 判断有效宽度不低于约 340dp 且 `fontScale` 不高于约 1.15 时使用双列；右列额外下错开 12dp，其他情况单列。默认第一套皮肤不再按便签数量退回标准列表，维持 `FlatList`；模式变化时更新列表 key。`StickerCard.tsx` 对 compact 卡片按模板施加轻微旋转、边距和高度差，线稿限制在卡片内部，同时保持外层 Pressable 的可触区域。完成条件：0、1、2、6、20 张时均可滚动且卡片不重叠；筛选／回收站仍为标准列表。
5. **参考图配色校正**：`src/shared/palette.ts` 调整第一套皮肤的浅色纸张与色点；`mobile/src/theme.tsx` 和 `SearchField.tsx` 调整页面、表面、搜索框和墨色。完成条件：浅色卡片包含柔黄、粉、绿、蓝，八种纸色的正文对比度都达到 4.5:1 以上。
6. **手机编辑页**：`StickerEditorScreen.tsx` 仅在第一套皮肤构造与 ID 对应的低对比 SVG URI，写入 `contentCSSText` 的 `.pell-content` 背景；现有 `commandDOM` 更新颜色时也设置或清除 `backgroundImage`、`backgroundPosition`、`backgroundSize` 与重复方式。命令字符串用 JSON 字面量编码 URI，不能拼入正文。完成条件：进入编辑页、换便签颜色、换明暗模式后同图仍在；其他皮肤背景为空；WebView 未 ready 或执行失败时仍可编辑。
7. **验证与构建**：先运行桌面与手机类型检查、桌面构建、Android JS 导出，再尝试本地 release APK 构建。实机连接可用时检查截图、键盘、长正文和安装；若 ADB 仍未连接，明确标注实机未验证。

## 6. 测试用例

| 条件 | 操作 | 预期 |
| --- | --- | --- |
| 0／1／2 张便签 | 打开桌面和手机默认列表 | 空状态正常；单张为完整首卡；双张没有空白占位或遮挡 |
| 6／20 张便签 | 滚动默认列表，打开任意卡片 | 第一套皮肤持续错落排布；手机 `FlatList` 可顺畅滚动；点击进入正确便签 |
| 同一 ID、重启／跨端 | 对比列表与编辑页 | 图案一致；模板不随重新渲染随机变化 |
| 搜索、标签、置顶、提醒、回收站 | 切换筛选并返回默认列表 | 结果卡整齐可读；排序和数据不变；返回后错落模板稳定 |
| 低宽度／大字体 | 缩窄桌面窗或增大手机系统字体 | 单列回退，卡片内容和菜单完整可点击 |
| 长正文、待办、AI 标注、自定义文字色 | 编辑并滚动 | 图案位于文字下方；光标、选择、工具栏、键盘和保存正常 |
| 深浅色／换便签颜色 | 在手机编辑页切换 | 线稿、文字、纸面颜色同步更新；不出现上一便签的残留图案 |
| 其他两套皮肤 | 打开列表与编辑页 | 保持现有布局，不显示第一套皮肤专属卡片／编辑线稿 |
| WebView 尚未 ready／CSS 设置失败 | 打开编辑页或快速切换 | 实色编辑背景和内容仍可用，保存逻辑不受影响 |

本次为可逆的展示改动，不新增与实现同构的单元测试，也不引入新测试框架。用类型、构建和真实界面覆盖主要风险；若发现共享 ID 选图边界缺陷，再增加针对性的纯函数验证。

## 7. 验证命令与预期

在仓库根目录执行：

```powershell
npm run typecheck
npx electron-vite build
Set-Location mobile
npx tsc --noEmit
npx expo export --platform android --output-dir ..\.cache\sticker-ui-export
```

四条命令应退出码为 0。APK 构建沿用已配置的本地 SDK、JDK 17 和镜像缓存；从根目录执行以下 PowerShell 命令，预期生成 `mobile/android/app/build/outputs/apk/release/app-release.apk`：

```powershell
$repo = (Resolve-Path .).Path
subst X: $repo
subst H: "$repo\.cache\gradle-ms17"
subst S: "$repo\.cache\android-sdk"
$env:JAVA_HOME = 'C:\Users\11548\.jdks\ms-17.0.21.0.2'
$env:ANDROID_HOME = 'S:\'
$env:ANDROID_SDK_ROOT = 'S:\'
$env:GRADLE_USER_HOME = 'H:\'
Set-Location 'X:\mobile\android'
.\gradlew.bat :app:assembleRelease -x :app:generateAutolinkingNewArchitectureFiles `
  -PreactNativeArchitectures=arm64-v8a --no-daemon --no-watch-fs `
  --max-workers=2 --console=plain `
  --project-cache-dir 'X:\.cache\android-project-gradle-ms17' `
  -I 'X:\.cache\android-setup\mirrors.init.gradle'
```

这条本机构建命令依赖当前忽略的 `mobile/android` 预生成文件和 `.cache` 镜像配置；它用于本机验证，不是仓库的可移植 CI 命令。构建成功后核对 APK 时间戳、版本和签名。视觉检查记录桌面列表／独立便签和 Android 列表／编辑页截图；实机不可连接时不宣称实机通过。

## 8. 验证记录

- `npm run typecheck`、`npx tsc --noEmit`、`npx electron-vite build` 与 `npx expo export --platform android` 均通过。
- 桌面列表用当前构建 CSS 在 520px 双列和 380px 单列宽度下截图并检查元素边界；卡片不重叠，线稿未溢出卡片。WebView 使用的 SVG 数据 URI 在 Chromium 中解码并显示，文字保持可读。
- `:app:assembleRelease` 成功，APK 位于 `mobile/android/app/build/outputs/apk/release/app-release.apk`；签名校验与版本核对通过。
- Windows 安装包已重新生成。当前机器解压 `winCodeSign` 工具时无创建符号链接权限，因此仅对这次本地打包使用 `--config.win.signAndEditExecutable=false`；NSIS 安装包仍按项目配置生成。
- ADB 目前未列出手机，Android 实机列表滚动、WebView 键盘与安装覆盖尚未验证；不得据此宣称实机已通过。
- 用户后续指定的手机双列和参考图配色已实现；八种浅色纸张的正文对比度约为 9.9:1–12.7:1。手机 TypeScript、Android JS 导出与 release APK 已重新构建通过，桌面因共享纸色变化也已重新打包。

## 9. 文档一致性

文件清单覆盖已确认设计中的共享线稿、双端列表和双端编辑页，不引入手动拖动、数据字段或额外皮肤。实现若需要新增依赖、持久化布局或变更富文本内容，属于设计偏差，应先更新设计文档并重新确认。
