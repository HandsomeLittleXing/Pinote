# 单端 AI 与三种使用模式设计

## 背景与目标

项目将开源，用户需要三种使用方式：只装手机端、只装桌面端、手机与桌面互通。用户已明确“本地进行”指 **设备直接调用云模型 API，自带 API Key**，并非在设备上离线运行模型。

目标是：手机单端和桌面单端在不部署、不配对同步服务器时，仍能手动使用现有 AI 标注、整理补充及已有的语义查找；互通方式继续使用现有服务器同步及同步空间 AI Key。三种方式使用同一份便签数据结构和同一组客户端代码，不维护三个相互分叉的产品。

| 使用方式 | 所需组件 | 便签存储 | AI 请求与 Key |
| --- | --- | --- | --- |
| 纯手机 | Android 应用 | 本机 SQLite | 手机直连云模型；Key 存手机安全存储 |
| 纯桌面 | Windows 应用 | 本机 electron-store | Electron 主进程直连云模型；Key 用系统加密后存本机 |
| 手机桌面互通 | 两端应用 + 同步服务器 | 两端本地优先，服务器增量同步 | 保留现有服务器代理；Key 存同步空间 |

“本地 AI”仍需要互联网并会把用户手动选择的便签纯文本发送给云模型供应商。应用不内置开发者 Key，不因开源而暴露共享凭据。

## 非目标

- 不在手机或电脑上运行离线大模型，不承诺断网时可 AI 整理。
- 本轮不增加新的云模型供应商选择界面；单端模式沿用当前默认的 DeepSeek OpenAI 兼容接口与 `deepseek-chat` 模型。后续可扩展供应商配置。
- 不取消现有自建同步服务器，不把跨端同步改成局域网直连或第三方云同步。
- 不迁移或下载已存于服务器的同步空间 Key；切换到单端时由用户在该设备另行填写 Key。
- 不修改便签正文格式、AI 结果 JSON 版本或服务器数据库结构。

## 现状分析

- 桌面端 `src/main/ipc-handlers.ts` 的 AI IPC 全部调用 `src/main/sync.ts`，后者要求配对 token 和 serverUrl；`src/renderer/components/settings/AiSettings.tsx` 也以同步状态决定是否能设置 Key。
- 手机端 `mobile/src/api/aiClient.ts` 所有 AI 操作均走 `${serverUrl}/ai/*` 并要求 token；`mobile/src/screens/SettingsScreen.tsx` 未配对时禁用 Key 输入；编辑页和列表页调用该客户端。
- 服务端 `server/src/services/llm.ts` 包含 DeepSeek 兼容请求、标注/改写/查找提示词与超时逻辑；`server/src/utils/ai.ts`、`aiRewrite.ts` 做结果校验。`src/shared/ai.ts` 已有两端共用的内容哈希、AI 结果归一化和展示逻辑。
- 桌面 `src/main/store.ts` 的 `AppSettings`、手机 `mobile/src/storage/preferences.ts` 的 `MobilePreferences` 都保存本机偏好；现有同步只同步便签及其 AI 结果，不同步本地设置。桌面 JSON 导出包含 `settings`，因此 Key 不能放入 `AppSettings`。
- 手机当前依赖中没有 `expo-secure-store`。桌面当前 Electron 28 的 `safeStorage` 提供 `isEncryptionAvailable`、`encryptString`、`decryptString`。手机 Expo SecureStore 可用系统安全存储；其 Android Key Store 项在卸载后不可恢复。参考：[Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)、[Expo SecureStore v58](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/)。
- 工作区已有大量未提交改动，涉及手机 AI、同步、设置页与共享类型。实现时须以当前工作树为准，保留这些改动。

## 参考与复用

- 直接复用 `src/shared/types.ts` 的 `AIAnnotateRequest`、`AIAnnotateResponse`、`AIRewriteRequest`、`AIRewriteResponse` 和 `AIAnnotation`，以及 `src/shared/ai.ts` 的内容哈希、时区和结果过期判断。
- 复用 `server/src/services/llm.ts` 的提示词、输入上限、请求参数与错误语义作为客户端直连实现的行为基准；客户端和服务器的运行环境不同，不直接从 `server/src/` 导入代码。把直连所需的纯逻辑整理为 `src/shared/` 下可被桌面与手机共同使用的模块，并用一致性用例防止服务端与客户端解析规则漂移。
- 保留 `src/main/sync.ts`、`mobile/src/api/aiClient.ts` 的服务器路径，按明确的 AI 来源选择进行分流；不复制整个编辑器或设置页。

## 实现思路

1. **使用方式与路由**：不创建三个独立代码库。默认安装即可本地保存便签、不开启同步；连接同步服务后成为互通方式。AI 设置增加来源 `device`（设备直连）与 `sync`（同步空间）。新用户默认 `device`；已有配对且启用 AI 的用户保留 `sync`，避免升级后暗中改用本机 Key。同步开关与 AI 来源分别可见，互通用户可明确选择使用同步空间 Key；无配对时不能选 `sync`。
2. **设备直连**：桌面只由 Electron 主进程发出 HTTPS 请求，渲染进程只使用既有受控 IPC；手机由原生 React Native `fetch` 发出 HTTPS 请求。两端共享提示词和结果解析/校验模块，沿用服务器现有的输入长度、超时、内容哈希、选区过期检查、标签/提醒约束。默认请求 `https://api.deepseek.com/v1/chat/completions`，模型 `deepseek-chat`。
3. **本机 Key**：桌面主进程用 Electron 28 `safeStorage` 加密后存独立本地凭据文件，系统加密不可用时拒绝保存与调用，不回退明文。手机新增 `expo-secure-store`，Key 存 Android Keystore 支持的安全存储，不放 AsyncStorage、SQLite、日志、备份和同步数据。设置页只展示配置状态和末尾少量字符；测试连接、替换、移除操作各自明确。运行时将 Key 临时放在请求头，不经渲染进程或 WebView 传递。
4. **互通兼容**：`sync` 来源继续使用 `/ai/status`、`/ai/key`、`/ai/annotate`、`/ai/rewrite`、`/ai/search`。便签上的 AI 结果继续作为普通便签字段同步；设备 Key 与 AI 来源选择只属于本机，绝不随便签同步。关闭同步不会删除本机便签或本机 Key，切换来源也不会自动复制/删除另一处 Key。
5. **开源发行**：README 分别说明手机单端 APK、桌面单端安装包/便携版、互通部署组合的安装步骤、网络边界和 Key 归属。构建产物不含 Key、服务端环境文件或用户数据。当前服务器能力保持可选部署。

## 职责边界

- `src/shared/`：定义 AI 来源、请求/响应约定、提示词与纯解析校验，不存 Key、不发网络请求。
- 桌面 `src/main/`：选择设备直连或同步代理、保管本机 Key、执行网络请求；`src/renderer/` 只展示状态并发送用户动作。
- 手机 `mobile/src/api/`：选择设备直连或同步代理、执行请求；`mobile/src/storage/` 只保管本机 Key 与偏好；屏幕组件只展示和触发。
- `server/`：保持互通模式下的鉴权、空间 Key、模型代理和同步，不能读取设备本机 Key。

## 接口与数据

- `AIStatus.source` 扩展为 `'device' | 'space' | 'server' | 'none'`；`model`、`configured`、`keyHint` 继续沿用。桌面 `AppSettings` 和手机 `MobilePreferences` 增加 `aiSource: 'device' | 'sync'`，默认与旧用户迁移按上述规则处理。
- 既有 AI API 方法名称保留，分流后同一方法对 UI 返回同一结果形状。桌面已有 IPC 通道继续使用；设置来源可走现有 `settings:set`。手机原 `aiClient` 方法签名保持，内部按偏好分流。
- 本机 Key 通过独立安全存储，桌面凭据文件只保存加密字节及格式版本，手机 SecureStore 只保存 Key 字符串。Key 不包含在 `ExportData`、`Sticker`、同步 payload 或日志中。导入旧备份时缺少 `aiSource` 按旧用户迁移规则处理，不要求用户数据迁移脚本。
- 服务端数据库表、字段、索引、约束与 DDL 全部不变；本次无数据库迁移。

## 边界与异常

- 无 Key、密钥存储不可用、Key 已失效、上游 429/5xx、超时、断网、无效 JSON：保留原便签，显示可理解错误，不自动切换到另一来源，也不发送到自建同步服务器兜底。
- 本机 Key 重置或卸载后丢失时，要求用户重新输入；不从服务器或备份回填。设置页必须说明设备直连仍会将纯文本发给云模型供应商并可能产生费用。
- 请求正文只发送用户手动触发功能所需的纯文本；图片和 HTML 不发送。语义搜索维持既有候选数量、单条长度和结果 ID 白名单规则。
- AI 返回内容先按既有结构验证；标注必须是原文精确子串，提醒时间必须有效，整理结果转 HTML 时继续转义。编辑期间正文变动时沿用内容哈希拒绝写入过期结果。
- 单端模式打开同步设置不会自动配对或上传。互通模式服务端不可用时，本地便签仍可编辑；`sync` 来源的 AI 报错，不静默改用设备 Key。

## 风险与兼容性

- 直连云模型意味着用户自带 Key 位于设备运行环境，系统安全存储仅保护静态文件，不能防止同一已登录系统中的恶意程序。开源代码和安装包不含共享 Key。
- Electron 28 只提供同步版 `safeStorage` API；官方当前文档已将其标为未来弃用，升级 Electron 时需评估异步 API，不能直接在本次切换到当前版本不存在的方法。[Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)
- 手机增加原生 `expo-secure-store` 依赖需要重建 APK；Expo Go 中的行为不能替代正式 APK 验证。Android 备份恢复后本机 Key 需要重新输入。[Expo SecureStore v58](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/)
- 同步服务器现有 Key 和 API 保持兼容；旧设备升级后默认沿用原 AI 来源。切换到单端不会删除服务器便签或空间 Key。

## 验证策略

- 纯手机：无配对安装，填写本机 Key、测试连接，分别运行标注/整理/语义搜索；断网、错误 Key、无效上游响应时便签不丢失；重启后 Key 可用，卸载重装后需重新输入。
- 纯桌面：无服务器配置，填写本机 Key 并测试；验证 AI 三类功能、主进程请求、Key 未出现在渲染进程/导出 JSON/日志；系统加密不可用时拒绝保存。
- 互通：已有配对与服务端 Key 的用户升级后 AI 路由不变；两端同步 AI 结果；切换来源不复制 Key、不触发意外上传；服务器不可用时不自动改走设备直连。
- 运行桌面、手机、服务端的类型检查和现有相关测试；增加共享结果校验与路由选择的针对性测试，检查正常、错误和迁移路径；构建 Windows 发行物和 Android APK，实机验证两端配置与请求。
