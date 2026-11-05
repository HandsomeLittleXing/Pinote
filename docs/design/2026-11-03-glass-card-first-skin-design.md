# Glass Card 皮肤替换设计文档

> 日期：2026-11-03
> 状态：初版已确认；视觉规范已由 `2026-11-03-glass-saas-refinement-design.md` 修订
> 范围：以 Glass Card 风格替换第一套「光标 / Cursor」皮肤，同时覆盖 Windows 桌面端和 Android 手机端

## 1. 背景与目标

FrostNote 目前有 Cursor、Vellum、Mote 三套皮肤，每套均支持浅色和深色。用户希望参考 `D:\personal\glass-card` 的彩色磨砂卡片，将第一套 Cursor 直接替换为 Glass Card，而不是增加第四套皮肤。

目标：

1. 设置页仍显示三套皮肤，第一套改为「彩玻 / Glass Card」，后两套保持原有外观与行为。
2. 桌面便签窗口、桌面列表与设置、手机列表与编辑、手机设置与共用浮层形成一致的彩色磨砂语言。
3. 保留现有便签内容、颜色、透明度、搜索、编辑、同步和明暗模式；原先选择 Cursor 的用户升级后自动使用 Glass Card。
4. 复用现有 8 种便签色的数据标识，只改变新皮肤中的显示材质，不改变便签数据或同步协议。
5. 文字、图标和可交互控件保持清晰；移动端列表滚动性能不因逐卡实时模糊下降。

### 成功标准

| 维度 | 验收标准 |
| --- | --- |
| 皮肤数量 | 桌面和手机设置页均只有 Glass Card、Vellum、Mote 三套；切换即时生效 |
| 兼容 | 旧设置或备份中的 `skin: "cursor"` 映射为 `glass`；其他设置和便签数据不变 |
| 桌面 | 独立便签、列表卡片、设置页和弹层的材质一致；160px 宽便签的工具栏、折叠态和拖动正常 |
| 手机 | 列表、编辑器外壳、标题栏、设置和浮层风格一致；列表滚动无明显掉帧 |
| 明暗与可读性 | 两种模式下正文、图标、聚焦态和 AI 标注清晰；常规表面文字对比度达到 WCAG AA |
| 回归 | 原有颜色选择、20%–100% 透明度、富文本输入、键盘、搜索和同步正常 |

## 2. 非目标

- 不移植 SwiftUI 包，也不加入 Windows 原生 Acrylic/Mica 或屏幕抓取方案。
- 不照搬演示中的 Ring/Layered 排布、拖拽展开和九色材质调节器；便签列表维持现有信息密度和操作方式。
- 不新增第九种便签颜色，不改变 `Sticker.color`、服务端数据库、SQLite 表或同步消息。
- 不做 iOS 专项适配或重构现有富文本编辑器。

## 3. 现状与参考

### 3.1 当前调用链

| 领域 | 当前实现 | 位置 |
| --- | --- | --- |
| 皮肤标识与默认值 | `SkinId = cursor | vellum | mote`，默认 Cursor | `src/shared/types.ts`、`src/shared/skins.ts` |
| 桌面设置 | electron-store 保存 `AppSettings.skin`，列表和便签窗口订阅设置变化 | `src/main/store.ts`、`src/renderer/hooks/useTheme.ts` |
| 桌面原生窗口 | 独立便签为透明 `BrowserWindow`；面板标题栏颜色从皮肤表读取 | `src/main/windows.ts` |
| 桌面材质 | CSS token、便签容器与工具栏、列表卡片、皮肤背景 | `src/renderer/styles/{tokens,sticker,globals}.css`、`src/renderer/components/{StickerEditor,StickerListItem,SkinBackdrop}.tsx` |
| 手机设置 | AsyncStorage 保存 `MobilePreferences.skin`，`ThemeProvider` 生成主题 token | `mobile/src/storage/preferences.ts`、`mobile/src/theme.tsx` |
| 手机材质 | `GlassSurface` 可选 BlurView；列表 `StickerCard` 关闭逐卡模糊；页面背景为 BlurTargetView | `mobile/src/components/{GlassSurface,StickerCard,ScreenBackground}.tsx` |
| 手机编辑 | RichEditor 是 WebView，编辑区有独立的不透明背景 | `mobile/src/screens/StickerEditorScreen.tsx` |

皮肤是两端各自保存的本地偏好，目前不会通过同步协议在设备之间传播。便签色是数据字段，会跨设备同步。

### 3.2 Glass Card 参考

参考项目的公开组件是 macOS 14+ SwiftUI 材质：将提供的背景提高饱和度并模糊，叠加约 58% 的色彩、白色边框和圆角；浅色 `pearl` 约 45%。演示里的错位叠放与环形排布是单独的交互层。参考项目明确指出它不会自动采样身后的真实视图，重叠卡片也是近似合成。源码使用 MIT 许可。

本设计借用其**高辨识度彩色半透明卡片、柔和白边、中性网格背景、清晰前景**四个特征。CSS 和 React Native 材质由本项目独立实现；如复用其源码或图片，需保留 MIT 版权声明。

### 3.3 与现有 Vellum 的区别

Glass Card 以鲜明的便签色作为整张卡的主要视觉信号，背景中性、边缘高光明显；Vellum 继续使用雾白/近黑底、玫红与薄荷墨色、叠纸和细颗粒。两套皮肤保持可辨识。

## 4. 视觉与交互方案

### 4.1 共同规则

- **背景**：浅色使用近白中性底和低对比度稀疏网格；深色使用中性炭灰底与更弱的网格。背景不放大面积彩色光斑，以便彩色卡片成为重点。
- **卡片**：按便签现有颜色映射成高饱和色彩层，叠加轻微高光、1–2px 浅色描边和柔和阴影。卡片外形采用约 16–20px 圆角，具体随容器尺寸收敛；交互目标和布局尺寸不因悬停或选中变化。
- **前景**：文本和图标不参与模糊或整体透明度；每个色板提供单独的前景色。未选中的卡片、输入框和菜单同样需要稳定可读。
- **深色**：保持彩色卡片的辨识度，但降低色层亮度和高光强度；使用深色模式专用文字、边框、阴影和输入背景，不直接反转浅色样式。
- **动效**：只保留短暂的悬停、按压和切换反馈；遵守系统减少动态效果偏好。

### 4.2 便签色与视觉色映射

`Sticker.color` 继续存现有 8 个冷色值，Glass Card 皮肤只在渲染时取对应材质色。初版映射如下，深色模式另配更低亮度的材质与前景色：

| 现有色板 | Glass Card 材质方向 |
| --- | --- |
| 冰川 `#DFECFB` | 蓝 `#3769F5` |
| 湖蓝 `#DCEDF3` | 青绿 `#2EC2C4` |
| 薄荷 `#DFF2EC` | 绿 `#68BD81` |
| 冷粉 `#F5E6ED` | 玫红 `#EE556D` |
| 鼠尾草 `#E6EEE3` | 柠黄 `#F2F766` |
| 雾紫 `#EAE5F8` | 紫 `#9B38EC` |
| 霜白 `#FFFFFF` | 珍珠白 `#FFFFFF` |
| 云灰 `#ECEFF4` | 石墨 `#3A3F4A` |

这保留原数据和旧色值映射。参考项目的橙色不进入初版，因为新增便签色会扩展数据与跨端协议的兼容范围。具体色层透明度按文字对比度和实机截图校准，不机械套用参考项目的 58%。

### 4.3 桌面端

- 列表/设置窗口：`SkinBackdrop` 改为中性网格；通用表面、列表卡片、设置控件和弹层使用新皮肤 token。列表仍在 520px 断点切换单双列。
- 独立便签：`StickerEditor` 继续用现有 `Sticker.opacity` 调整背景透明度，文本保持不透明；便签外壳、工具栏和调色入口展示对应材质色。折叠态仍以可读工具栏为主。
- 真模糊范围：列表/设置窗口内的 CSS `backdrop-filter` 可模糊同一网页的背景。独立透明便签窗口不能依靠 CSS 模糊窗口外的 Windows 桌面；这里使用彩色半透明底和高光模拟磨砂感，不承诺桌面壁纸实时模糊。
- 原生标题栏覆盖层和窗口底色随浅色/深色新皮肤一起更新，避免 Web 内容与 Windows 窗口外壳断层。

### 4.4 手机端

- `ScreenBackground` 在新皮肤下使用中性网格/底色；`GlassHeader`、设置和少量浮层复用 `GlassSurface` 的模糊能力。
- `StickerCard` 仍使用预合成的有色表面，不在 `FlatList` 每一项放 `BlurView`。标题、摘要、标签和操作反馈沿用现有布局。
- 编辑页的彩玻效果放在编辑器外壳、颜色选择和工具栏。`RichEditor` 的 WebView 保持可读的实色背景，避免透明 WebView、键盘和滚动带来的兼容问题；编辑内容本身仍按所选便签色呈现。
- Android 31+ 的模糊可用于少量稳定表面；不支持或模糊不可用时回退到预合成表面，保证功能与文字可读。

## 5. 模块职责与数据

### 5.1 皮肤标识与兼容

将规范皮肤标识改为 `glass | vellum | mote`，第一项和默认项为 `glass`。共享层提供唯一的 `normalizeSkinId(value)`：`cursor` 映射为 `glass`；三个规范值原样返回；缺失或非法值回退 `glass`。桌面读取设置、覆盖导入旧备份、运行时设置写入、手机读取旧偏好和窗口主题回退均使用这条规则。合并导入保持当前设置语义，不额外修改皮肤。

这样升级后，原来选 Cursor 的用户自动看到 Glass Card；选 Vellum 或 Mote 的用户不受影响。旧版本程序不保证识别新 `glass` 设置，回退旧版本前需要恢复旧版设置备份。

### 5.2 文件职责

| 文件/模块 | 设计职责 |
| --- | --- |
| `src/shared/types.ts`、`src/shared/skins.ts` | 规范 ID、名称、预览色、圆角、原生标题栏颜色、旧值归一化 |
| `src/shared/palette.ts` | 保持便签数据色板；增加只供 Glass Card 渲染的材质色/前景色映射 |
| `src/main/store.ts`、`src/main/windows.ts` | 桌面旧设置/备份兼容和窗口原生外观 |
| `src/renderer/hooks/useTheme.ts`、`src/renderer/styles/*.css` | 切换 `data-skin`，定义新皮肤 token 与材质层 |
| `src/renderer/components/{SkinBackdrop,StickerEditor,StickerListItem}.tsx` | 桌面背景、便签和列表卡片的皮肤展示 |
| `src/renderer/components/settings/AppearanceSettings.tsx` | 三套皮肤的选择卡与预览文案 |
| `mobile/src/storage/preferences.ts`、`mobile/src/theme.tsx` | 旧偏好兼容、明暗 token 和效果开关 |
| `mobile/src/components/{ScreenBackground,GlassSurface,StickerCard,GlassHeader}.tsx` | 手机背景与表面材质；列表性能策略 |
| `mobile/src/screens/{StickerEditorScreen,SettingsScreen}.tsx` | 编辑器外壳、色板与皮肤选择 |

仅增加客户端的主题数据和样式；不新增服务端接口、数据库字段、存储键或原生依赖。手机偏好继续存于 `stickernote.preferences.v1`，桌面继续使用原有 `AppSettings.skin`。

## 6. 边界、风险与回退

1. **低透明度**：桌面便签在 20% 透明度、复杂桌面壁纸上无法保证任意背景下的文字对比度。文字本身保持不透明，测试亮/暗高对比壁纸，并为工具栏与聚焦编辑区域保留必要的实色衬底。
2. **长列表性能**：手机列表用预合成卡片；桌面也避免在每张卡上叠加多层昂贵滤镜。测试大量便签的滚动和窗口拖动。
3. **编辑器边界**：富文本内用户自设文字色、AI 标注、搜索高亮可能与强色卡片冲突。保留编辑区域稳定背景，逐项检查颜色对比。
4. **输入与交互**：装饰层必须 `pointer-events: none`，不影响标题栏拖动、按钮点击、手机长按、键盘唤起和 WebView 滚动。
5. **旧数据**：非法皮肤值回退 Glass Card；旧 `cursor` 值在设置、备份导入和手机偏好中统一映射。旧色值仍由现有色板解析。
6. **回退**：Vellum/Mote 继续可选；实现若出现材质性能问题，可降低模糊强度或启用预合成表面，不需要迁移便签数据。

## 7. 验证策略

1. 共享层验证：规范 ID、`cursor` 迁移、非法值回退、8 色映射和浅/深色前景选择。
2. 桌面验证：TypeScript 检查和 Electron 构建；设置切换即时更新所有窗口及原生标题栏；新旧备份导入、160px 便签、折叠/展开、透明度 20% 与 100%、列表单双列、弹层和搜索高亮。
3. 手机验证：TypeScript 检查和 Android 开发构建；旧偏好升级、浅/深色、列表大量卡片滚动、编辑器键盘与滚动、不同系统版本的模糊回退。
4. 视觉核对：桌面列表/独立便签与 Android 列表/编辑/设置分别截取浅色和深色截图；检查文字对比、卡片边界、色彩映射、控件溢出和遮挡。
5. 回归：切换 Vellum/Mote、修改便签颜色、富文本保存、AI 标注、同步后跨端颜色一致；确认皮肤仍是各设备本地偏好。

## 8. 确认点

本设计采用「替换 Cursor、三套皮肤总数不变」；旧 `cursor` 自动映射到新 `glass`；保留 8 个便签数据色和现有列表交互。确认本设计后，再编写编码实现文档并确定逐文件改动与验证命令。
