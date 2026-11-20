# 桌面端工具栏、贴记品牌与托盘修复：编码实现文档

## 变更概览

修复便签顶栏控件与“更多”菜单到弹层的点击链路；将桌面安装产物、运行窗口、托盘、关于页和移动端显示名统一为“贴记（Pinote）”；从现有移动端笔记本图标生成 Windows 多尺寸图标；使快捷方式启动后的托盘创建可恢复、可诊断，同时保留既有 `sticker-note` 数据和应用标识。

对应已确认设计：`docs/design/2026-11-19-desktop-toolbar-identity-tray-design.md`。当前工作区已有大量未提交修改；以下所有编辑都以当前工作树为起点，逐段保留已有改动。

## 逐文件清单与职责

| 路径 | 主要职责、接口与直接依赖 |
| --- | --- |
| `src/renderer/components/StickerEditor.tsx` | 调整顶栏 `Popover` 状态、菜单选择后开启弹层的时序与触发锚点，确保编辑器选区可用于字号和颜色命令；依赖既有 Radix 包装组件和 Tiptap 编辑器，不新增对外接口。 |
| `src/renderer/styles/sticker.css` | 明确可拖动空白区与 `no-drag` 交互区的 CSS 边界，不承载业务状态。 |
| `src/main/tray.ts` | 创建和复用单个 `Tray`，先加载打包资源图标，失败时尝试 exe 图标；记录失败原因并返回创建结果，沿用现有菜单行为。 |
| `src/main/index.ts` | 在就绪时建立托盘；第二实例触发时检查托盘并打开列表，不创建第二进程。 |
| `src/main/windows.ts` | 给便签窗口及列表/设置窗口设置统一图标与新标题，沿用打包和开发路径判断。 |
| `src/main/ipc-handlers.ts` | 新的开机启动注册表项使用 `Pinote`，关闭开机启动时同时移除旧的 `StickerNote` 项；当前启用状态的旧项在启动时迁移。不得改变 `AppSettings` 结构。 |
| `resources/icon.png`、`resources/icon.ico` | 存放从现有移动端视觉生成的桌面高分辨率预览与多帧 Windows 图标，供 exe、安装器、窗口和托盘使用。 |
| `scripts/generate-desktop-icon.py` | 使用 Pillow 从 `mobile/assets/icon.png` 生成上述图标；输入、输出路径固定，重复运行结果一致。 |
| `electron-builder.yml` | 设置 `productName: Pinote`、安装包名 `贴记-Setup-*`、快捷方式与菜单分类为“贴记”，继续使用原 `appId` 和同一 `icon.ico`。 |
| `package.json` | 更新用户可见 `description`、`author`；保留 `name: sticker-note`，避免用户数据路径变化。 |
| `src/renderer/App.tsx`、`src/renderer/index.html`、`index.html` | 浏览器文档和页面标题使用“贴记”。 |
| `src/renderer/components/settings/AboutSettings.tsx`、`src/renderer/components/settings/GeneralSettings.tsx`、`src/renderer/components/settings/DataSettings.tsx` | 更新关于页、开机启动说明及新备份文件默认名；旧备份导入逻辑保持不变。 |
| `src/main/reminders.ts` | 系统提醒标题使用“贴记”。 |
| `mobile/app.json` | 仅把 Expo 显示名称改为“贴记”，不改 slug、bundle identifier、Android package。 |
| `README.md` | 将项目品牌、安装包示例与相关说明改为“贴记（Pinote）”，保留原有工作树中的功能说明与字体许可。 |

不删除文件。若具体复现表明工具栏故障只涉及其中一个文件，仅修改实际需要的相关代码，不作无关重构。

## 项目风格参考与复用

- **直接复用**：`src/renderer/components/ui/Popover.tsx`、`DropdownMenu.tsx` 的 Radix 包装；`src/renderer/extensions/index.ts` 已有 `setFontSize`/`setFontColor` 命令；`src/main/tray.ts` 已有菜单与点击行为；`mobile/assets/icon.png` 的笔记本视觉。
- **扩展复用**：`src/main/windows.ts` 的 `getPanelWindowOptions()` 图标路径逻辑扩展到便签窗口；`src/main/index.ts` 已有单实例锁及第二实例处理；`src/main/ipc-handlers.ts` 既有 Windows Run 项处理。
- **不复用**：现有 `resources/icon.ico` 的纸团图形与品牌不符；零宽 `PopoverAnchor` 和定时器切换若实机证实导致问题，将替换为与真实按钮绑定的交互路径，不复制其他页面的菜单结构。

## 接口与数据变化

- 不新增 IPC 通道、同步字段、数据库变更或用户配置字段。
- `TrayManager.createTray()` 调整为可重复调用且返回创建是否成功；若采用异步 exe 图标兜底，返回 `Promise<boolean>`，调用方在初始化和第二实例事件中处理 Promise。`destroy()` 保持原行为。
- Windows Run 的旧键 `StickerNote` 迁移到新键 `Pinote` 时保留当前 exe 路径与 `--autostart` 参数；迁移只在当前设置 `autoStart === true` 且已打包时执行。禁用时移除两键，避免旧版本残留再次启动。该操作不修改便签 JSON。
- `package.json` 的内部包名、`electron-builder.yml` 的 `appId`、`mobile/app.json` 的系统包标识、`src/main/store.ts` 的存储文件名保持原值。旧备份文件依旧可导入。

## 实现步骤与完成条件

1. **交互复现**：在开发版用鼠标操作常驻加粗/斜体/待办和更多菜单内的字号/字体颜色，检查 CSS 命中区及 Radix 事件顺序。记录失败动作；完成条件是确定实际故障点。
2. **工具栏修复**：在 `StickerEditor.tsx`、`sticker.css` 仅调整故障点；保持空白处拖动和双击收起。完成条件是有选区时菜单项和浮层按钮可点、格式立即生效；无选区和窄窗口行为正常。
3. **图标资源**：在 `scripts/generate-desktop-icon.py` 从移动端源图生成 `resources/icon.png` 和含 16、24、32、48、64、128、256 像素帧的 `.ico`，检查各尺寸中心图形可辨认。完成条件是图标检查脚本能读到每一帧且新图与移动端一致。
4. **品牌配置**：依逐文件清单调整 Windows 打包配置、桌面运行时文案、移动端显示名和 README。完成条件是用户可见入口不再出现“电脑便签”“电脑标签”“霜笺”，内部历史标识保留。
5. **托盘与启动**：在 `tray.ts` 加入重复调用保护和资源加载失败兜底；`index.ts` 冷启动及第二实例均确保托盘存在；旧开机启动项按上述规则迁移。完成条件是快捷方式冷启动与二次启动均只有一个可用托盘图标。
6. **打包检查**：构建 Windows 解包版和安装包，检查 exe 元数据、快捷方式、窗口/任务管理器图标、托盘菜单及旧版升级。完成条件是所有可核对项目与设计一致，且未覆盖用户当前未提交改动。

## 测试用例

| 场景 | 输入与动作 | 预期 |
| --- | --- | --- |
| 格式按钮 | 选中文字，单击加粗、斜体、待办 | 点击被接收，格式和保存内容更新。 |
| 字号与颜色 | 选中文字，更多菜单选择字号/颜色，再点浮层选项 | 浮层打开且不会立即关闭，选区应用对应样式。 |
| 无选区 | 光标定位后选择字号，再输入 | 新输入按 Tiptap 当前格式行为呈现；编辑器未就绪时入口禁用。 |
| 窄窗口与收起 | 缩小宽度、收起和展开后使用更多菜单 | 必要菜单入口可操作；空白处仍可拖动。 |
| 图标缺失 | 临时让开发图标路径无效后启动 | 有明确错误记录；exe 图标兜底成功时仍创建托盘，失败时报告失败而不假称成功。 |
| 单实例 | 安装快捷方式冷启动，再次双击同一快捷方式 | 只有一个进程实例和一个托盘图标，列表被打开。 |
| 安装品牌 | 从新安装包安装并看桌面、开始菜单、任务栏、任务管理器 | 名称显示贴记，图标为笔记本；旧数据仍可读取。 |
| 开机启动迁移 | 旧键存在且 `autoStart` 为真时启动；随后关闭设置 | 新键指向现 exe，旧键被移除；关闭后两键均不存在。 |

## 验证命令

- `npm run typecheck`：退出码 0，无 TypeScript 错误。
- `npm run build:unpack`：Electron/Vite 与 Windows 解包成功；检查 `release/win-unpacked/Pinote.exe` 与 `release/win-unpacked/resources/icon.ico`。
- `npm run build`：NSIS 产出 `release/贴记-Setup-1.2.0.exe`（若版本在实施前变化，以实际版本为准）。
- `node -e "const a=require('./mobile/app.json'); if(a.expo.name!=='贴记') process.exit(1)"`：移动端显示名正确。
- `git -c safe.directory=D:/personal/HandsomeLittleXing/frostnote diff --check`：无空白错误；再逐文件查看差异，确认工作区先前改动仍在。
- Windows 手动验收：按测试用例点击开发版/安装版，并在任务管理器和通知区域查看实际显示。构建或手动检查无法执行时，逐项记录未验证内容与原因。

## 文档一致性

本实现对应设计中的交互修复、同源图标、统一名称、托盘稳健启动和内部标识兼容。没有设计偏差。若复现结果要求新增格式功能、变更移动端包标识或改变用户数据目录，先回到功能设计文档重新确认，不在本轮实施中扩大范围。
