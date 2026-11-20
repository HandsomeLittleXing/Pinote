# 桌面便签滚动、AI 浮层、字体与图标：编码实现文档

## 变更概览

按已确认的[功能设计](../design/2026-11-20-desktop-sticker-overflow-ai-font-design.md)，仅调整桌面端便签与 AI 浮层的溢出布局、按主题切换字体，并以 `resources/icon-source.jpg` 重新生成 Windows 图标。保留便签数据、手机端资源、应用 ID 和现有未提交改动。

## 逐文件清单与职责

| 路径 | 修改与唯一职责 | 接口及依赖 |
| --- | --- | --- |
| `src/renderer/styles/sticker.css` | 约束正文和贴纸插画的横向溢出，保留仅在需要时出现的纵向滚动和右下角缩放角标。 | 依赖现有 `.sticker-editor`、`.sticker-editor-doodle`、`.tiptap` 类；不改组件属性。 |
| `src/renderer/components/AiResultPanel.tsx` | 去掉与浮层内边距叠加的固定宽度和独立纵向滚动，让长摘要、标签、提醒及待办换行。 | 保留 `AiResultPanelProps`、采纳/提醒/重跑回调；依赖外层 Popover 的宽高与滚动。 |
| `src/renderer/styles/globals.css` | 把手写体限定到 `data-skin='glass'`，硫酸纸和小墨使用系统 UI 字体栈；通过继承覆盖便签、列表、设置和 Portal 浮层。 | 复用 `useTheme.ts` 设置的 `<html data-skin>`；不改字体文件。 |
| `scripts/generate-desktop-icon.py` | 将输入固定为 `resources/icon-source.jpg`，沿用图形边界裁切、留白和多尺寸输出；源图不存在或全白时明确报错。 | 依赖 Pillow；输出 `resources/icon.png` 与 `resources/icon.ico`。 |
| `resources/icon.png`、`resources/icon.ico` | 更新为指定 JPG 的桌面图标产物。 | `electron-builder.yml`、`src/main/windows.ts`、`src/main/tray.ts` 继续引用同一 ICO 路径。 |

不计划修改 `ui/Popover.tsx` 或 `StickerEditor.tsx`。若运行时复现表明必须改变通用浮层或组件结构，先核对设计边界；涉及新的交互方案时更新设计并重新确认。

## 项目风格参考与复用

- **直接复用**：`useTheme.ts` 已设置的 `data-skin`；`Popover.tsx` 的 Radix Portal、碰撞边界和外层纵向滚动；`electron-builder.yml` 中 exe、安装器、卸载器共用的 `resources/icon.ico` 路径。
- **扩展复用**：`sticker.css` 中现有正文与 SVG 类；`generate-desktop-icon.py` 的 Pillow 边界检测、裁切和七帧 ICO 保存逻辑。
- **不复用**：`mobile/assets/icon.png` 作为桌面图标源已与用户指定 JPG 冲突；`AiResultPanel` 自身的固定 260px 宽和 420px 内层滚动与外层浮层重复，应移除。手机图标和字体规则不参与本次变更。

## 接口与数据变化

React 属性、函数签名、IPC、配置字段、数据库和同步消息均不变。`package.json` 内部名称、`electron-builder.yml` 的 `appId`、用户数据路径与手机资源不变。构建时静态输出从新 JPG 派生；现有安装不会自动换图，需要新包安装并重新启动，Windows 图标缓存可能延迟刷新。

## 实现步骤与完成条件

1. **确认溢出来源**：以当前便签结构检查 `.sticker-editor` 的 `clientWidth` / `scrollWidth` 与背景插画或长文本的溢出；若无法在安全的演示数据环境运行实测，则以截图及定位样式为依据实施，并在验收中明确未实测项。完成条件是记录导致横向滚动的元素或可复查的 CSS 原因。
2. **正文布局**：在 `sticker.css` 让正文滚动容器只垂直滚动，插画绘制范围不扩大横向滚动宽度，并使超长词句在正文内换行。保持原生窗口缩放能力和角标。完成条件是短内容没有底部滚动条，长内容纵向可达。
3. **AI 面板**：在 `AiResultPanel.tsx` 用 `w-full min-w-0` 等随父容器收缩的约束替换内部固定宽度，移除其 `max-h` 与 `overflow-y-auto`；为可变文本与标签提供换行。完成条件是外层 `PopoverContent` 成为唯一纵向滚动区域，底部重跑按钮可达，原有回调可用。
4. **主题字体**：在 `globals.css` 定义系统常规字体栈为基础，并对贴纸主题覆盖莲生灵光体。检查选择器对 `html/body/#root` 及 Portal 子树的继承。完成条件是三主题明暗模式下字体按设计切换，未改富文本自定义字号/颜色。
5. **图标**：修改 `generate-desktop-icon.py` 的源路径与错误提示，生成 PNG/ICO；检查 16、24、32、48、64、128、256 像素帧，尤其 16px 笑脸可辨认。完成条件是生成产物与指定 JPG 同视觉，手机资源哈希不变。
6. **构建核验**：运行类型检查与桌面构建；检查解包版 `Pinote.exe`、复制到 `resources` 的 ICO 与安装包图标链路。若本机 `winCodeSign` 权限或下载导致常规打包失败，按 `docs/PACKAGING.md` 的本机回退流程写入 exe 图标并重打安装包，不把未经写入图标的 exe 当作完成产物。

## 测试用例

| 场景 | 输入与动作 | 预期 |
| --- | --- | --- |
| 短便签 | 240×200、660×390 窗口，短正文、贴纸插画 | 不显示底部横向滚动条；插画不挡正文，缩放角标仍在。 |
| 长便签 | 多行中文、连续英文/链接、大字号 | 正文在可视宽度内换行，仅内容超高时纵向滚动，末尾可达。 |
| 完整 AI 结果 | 摘要、标注、多个标签、提醒、多个待办 | 面板宽度不越过浮层；单层纵向滚动可达重跑按钮，采纳与提醒按钮仍可点击。 |
| AI 空结果 | 无 `annotation` | 原有「立即整理」展示且可用，无多余滚动。 |
| 其他浮层 | 打开颜色、字号、提醒等 | 未受 AI 面板局部改动影响。 |
| 主题字体 | 贴纸、硫酸纸、小墨，各切明暗 | 贴纸使用手写体，另两套使用常规字体；便签、列表、设置和浮层一致。 |
| 图标源异常 | 临时缺失或全白源图的独立测试输入 | 生成脚本明确失败，不静默复用旧 ICO。正式源图生成全部七帧。 |
| 打包图标 | 从新安装包启动并检查 exe、窗口、托盘和快捷方式 | 使用纸团笑脸图；已有便签仍可读取。 |

## 验证命令

- `py -3 scripts/generate-desktop-icon.py`：退出码 0，更新 `resources/icon.png`、`resources/icon.ico`。
- `npm run typecheck`：退出码 0。
- `npm run build:unpack`：桌面代码构建与解包成功；确认 `release/win-unpacked/Pinote.exe` 和 `release/win-unpacked/resources/icon.ico`。如遇已知打包权限问题，使用 `docs/PACKAGING.md` 的回退命令并单独核对 exe 图标。
- `npm run build`：生成 `release/贴记-Setup-1.2.0.exe`；如常规构建不可行，按上述回退流程生成安装包并报告实际执行命令。
- `git -c safe.directory=D:/personal/HandsomeLittleXing/frostnote diff --check`：没有空白错误；逐文件确认本次变更未覆盖其他未提交改动。
- 图标帧、界面溢出与字体需进行针对性图像或桌面检查，不能只凭类型检查宣称通过。

## 文档一致性

对应已确认设计的四项要求：滚动条、AI 完整显示、主题字体、指定桌面图标。当前没有接口和数据偏差；若实测要求改动通用浮层行为、手机端样式或应用 ID，回到设计文档重新确认。
