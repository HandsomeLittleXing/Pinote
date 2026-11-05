# Phase 4 编码实现文档：三皮肤 + AI 语义标注 + 语音整理

> 版本：v1.0 · 日期：2026-10-26
> 目标版本：桌面 / 手机 1.2.0

---

## 1. 变更概览

1. 三套皮肤 × 明暗：Cursor（光标）、Vellum（硫酸纸）、Mote（小墨），桌面与手机都可在设置中切换。
2. 非破坏性 AI 语义标注：时间 / 地点 / 人物 / 事项 / 重点句，只影响视图，不写入正文 HTML。
3. DeepSeek 服务端代理：`LLM_API_KEY` 只存在服务器；客户端手动触发。
4. AI 产出：一句话摘要、AI 标签（可采纳）、语义标注、待办、提醒建议（需确认）。
5. 手机端系统语音输入：长按麦克风、上滑「取消 / AI 分析」两个泡泡、松手插入或直接分析。
6. AI 结果随 `Sticker.ai` 字段同步；MySQL / SQLite / electron-store 均做增量迁移。
7. 移动端版本升到 1.2.0 / versionCode 3，已构建 arm64 APK。

---

## 2. 新增文件

### 共享

| 路径 | 说明 |
|------|------|
| `src/shared/skins.ts` | 皮肤元数据、原生标题栏色、圆角节奏 |
| `src/shared/ai.ts` | 纯文本归一化、FNV 哈希、标注解析、AI 结果防御性归一化 |

### 桌面

| 路径 | 说明 |
|------|------|
| `src/renderer/extensions/annotations.ts` | Tiptap Decoration 扩展，视图层标注 |
| `src/renderer/components/AnnotatedText.tsx` | 列表卡片标注渲染（可叠加搜索高亮） |
| `src/renderer/components/AiResultPanel.tsx` | 便签窗口 AI 结果面板 |
| `src/renderer/components/SkinBackdrop.tsx` | 列表/设置窗口皮肤氛围层 |
| `src/renderer/components/Mascot.tsx` | 桌面小墨，眼睛跟随鼠标 |
| `src/renderer/components/settings/AiSettings.tsx` | AI 开关、隐私确认、状态与展示选项 |

### 手机

| 路径 | 说明 |
|------|------|
| `mobile/src/api/aiClient.ts` | `/ai/status`、`/ai/annotate` 客户端 |
| `mobile/src/hooks/useVoiceInput.ts` | 系统语音识别封装与错误映射 |
| `mobile/src/components/VoiceInputOverlay.tsx` | 麦克风、长按手势、上滑气泡 |
| `mobile/src/components/AnnotatedText.tsx` | 嵌套 Text 标注渲染 |
| `mobile/src/components/AiResultSheet.tsx` | AI 结果底部弹层 |
| `mobile/src/components/AnnotationPreview.tsx` | 只读注解预览 |
| `mobile/src/components/Mascot.tsx` | 手机小墨（眨眼/呼吸/看方向） |
| `mobile/src/components/PaperStack.tsx` | Vellum 叠纸容器 |
| `mobile/src/components/BlinkingCaret.tsx` | Cursor 闪烁光标条 |
| `mobile/src/components/GrainOverlay.tsx` | Vellum 静态噪点 |
| `mobile/src/screens/SettingsScreen.tsx` | 外观 / AI / 语音 / 同步设置 |
| `mobile/src/storage/preferences.ts` | 外观与 AI 偏好的 AsyncStorage 持久化 |

### 服务端

| 路径 | 说明 |
|------|------|
| `server/src/routes/ai.ts` | AI 状态与整理接口、缓存、限流 |
| `server/src/services/llm.ts` | DeepSeek 调用、Prompt、Mock、超时 |
| `server/src/utils/ai.ts` | 服务端类型、哈希、模型输出校验 |
| `server/src/env.ts` | 确保 `.env` 在路由模块之前加载 |

---

## 3. 主要修改

| 路径 | 改动 |
|------|------|
| `src/shared/types.ts` | `SkinId`、`AnnotationKind`、`AIAnnotation`、`Sticker.ai`、`AppSettings` 新字段、`AIAPI` |
| `src/shared/ipc-channels.ts` | `SETTINGS_CHANGED`、`AI_GET_STATUS`、`AI_ANNOTATE` |
| `src/main/store.ts` | AI 归一化、默认设置合并、同步时保留旧客户端 AI |
| `src/main/sync.ts` | `getAiStatus` / `annotate` |
| `src/main/ipc-handlers.ts` | AI IPC、设置广播、皮肤变化更新原生标题栏 |
| `src/main/windows.ts` | 原生标题栏/底色按皮肤 × 明暗取值 |
| `src/preload/index.ts` | `settings.onChanged`、`ai` API |
| `src/renderer/styles/tokens.css` | 6 套 token + 标注色 |
| `src/renderer/styles/globals.css` | 皮肤氛围层、小墨、标注样式 |
| `src/renderer/styles/sticker.css` | 便签窗口皮肤质感 |
| `src/renderer/hooks/useTheme.ts` | 读取皮肤、订阅设置变更、写入 `data-skin` |
| `src/renderer/components/StickerEditor.tsx` | AI 按钮/菜单、标注装饰、AI 面板、标签采纳、提醒建议 |
| `src/renderer/components/StickerListItem.tsx` | 标注标题/摘要、AI 摘要与标签、叠纸卡 |
| `src/renderer/components/StickerList.tsx` | 皮肤背景、小墨、AI 展示设置 |
| `src/renderer/components/Settings.tsx` | 新增 AI 设置分区 |
| `src/renderer/components/settings/AppearanceSettings.tsx` | 三皮肤选择卡 |
| `mobile/src/theme.tsx` | ThemeProvider + 6 套 token + 标注色 + 偏好持久化 |
| `mobile/src/App.tsx` | ThemeProvider、Settings 路由 |
| `mobile/src/screens/StickerListScreen.tsx` | 设置入口、小墨、AI 卡片 |
| `mobile/src/screens/StickerEditorScreen.tsx` | AI 按钮、注解预览、语音覆盖层、AI 结果弹层 |
| `mobile/src/components/StickerCard.tsx` | 标注、摘要、AI 标签、叠纸/光标 |
| `mobile/src/storage/db.ts` | `ai` 列迁移、读写、旧服务端保留 |
| `mobile/app.json` | 语音 config plugin、版本 1.2.0 / versionCode 3 |
| `mobile/android/.../AndroidManifest.xml` | 语音服务 `<queries>` |
| `server/src/db/schema.sql` | `ai JSON NULL` |
| `server/src/db/migrate.ts` | 幂等补 `ai` 列 |
| `server/src/routes/sync.ts` | 同步 `ai`，旧客户端缺省时保留 |
| `server/src/index.ts` | 挂载 `/ai`，优先加载 `.env` |
| `server/package.json` | `db:migrate` |
| `server/.env.example` | AI 配置项 |

---

## 4. 数据与同步约定

- `Sticker.ai` 与正文分离；`contentHash` 是归一化纯文本的 FNV 哈希。
- 正文改动后 `contentHash` 不匹配：摘要/标签隐藏，标注按精确子串匹配，匹配不到的自动忽略。
- AI 标签与用户 `tags` 分开；点击标签或「全部采纳」才合并。
- 提醒建议只在用户点击后写入 `reminder`，不覆盖已有提醒。
- 同步请求中**没有 `ai` 字段**的旧客户端：服务端保留库中已有 AI；显式 `null` 才清空。
- AI 写入前客户端先 `syncNow()` 拉取并校验哈希，降低覆盖另一台设备正文的风险；LWW 冲突时以较新正文为准，AI 可重新生成。

---

## 5. 验证状态

| 项 | 结果 |
|----|------|
| 桌面 `npm run typecheck` | ✅ 通过 |
| 桌面 `npx electron-vite build` + `electron-builder` | ✅ 通过，产物 `release-next/电脑便签-Setup-1.2.0.exe` |
| 桌面三皮肤 × 明暗视觉检查 | ✅ 通过 CDP 截图验证列表/设置/便签窗口 |
| 桌面 AI 面板（含 240px 窄便签窗口） | ✅ 面板自适应窗口，标签/摘要/采纳按钮不被裁切 |
| 桌面 Tiptap 标注 | ✅ 便签窗口内联显示，正文 HTML 未写入标记 |
| 服务端 `npm run build` | ✅ 通过 |
| 服务端 Mock 标注（`AI_MOCK=1`） | ✅ 时间/地点/人物/事项提取正确；`/health` 正常、`/ai/status` 未带 token 返回 401 |
| DeepSeek 真实 Key 调用 | ✅ 示例句返回摘要、4 类标注和建议提醒（`2026-11-03T15:00:00+08:00`），耗时约 1.8s |
| 手机 `npx tsc --noEmit` | ✅ 通过 |
| 手机 arm64 release APK | ✅ 已构建（约 37 MB）并安装到 vivo V2283A / Android 15 |
| APK Manifest 语音 `<queries>` | ✅ 已包含 |
| APK 包内 expo-speech-recognition | ✅ Gradle 已编译该模块 |
| 手机主题视觉回归 | ✅ Cursor / Vellum / Mote × 明暗均已截图核对 |
| 长按语音遮罩 / 上滑两个泡泡 | ✅ 真机验证（取消 / AI 分析） |
| 系统语音转写 | ⚠️ vivo Jovi 服务对第三方 App 返回 `ERROR_CLIENT` / `service-not-allowed`；已改为友好提示并引导使用输入法键盘语音 |
| 生产数据库 `ai` 列迁移 | ⏳ 部署时执行 `npm run db:migrate` |

---

## 6. 已知限制

- 系统语音识别依赖手机自带服务；没有中文语音服务的 ROM 会提示不可用，本轮不自动切云端 ASR。
- **实测 vivo V2283A（Android 15）**：系统里只有 Jovi 的 `com.vivo.ai.copilot` 唤醒服务，第三方 `SpeechRecognizer` 会先返回 `ERROR_CLIENT`，随后 `service-not-allowed`（Insufficient permissions）。已确认遮罩/气泡手势正常，但无法取得转写；现在会提示「请点一下正文，使用键盘上的语音输入」，不再停留在“正在听…”。
- 语音长按手势使用麦克风按钮的 PanResponder + 同层遮罩；若个别 ROM 的 WebView 层级覆盖遮罩，需要改为 Modal 方案并重新调手势。
- AI 标注在一个文本节点内精确匹配；用户手动加粗把短语拆成多个文本节点时，该短语可能不再标注。
- AI 与正文共用 `updatedAt` 做 LWW；极端并发下仍可能互相覆盖，需重新整理。
