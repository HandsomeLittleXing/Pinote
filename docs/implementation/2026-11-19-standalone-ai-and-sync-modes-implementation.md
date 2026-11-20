# 单端 AI 与三种使用模式：编码实现文档

## 变更概览

在现有手机、桌面客户端中增加“设备直连”AI 来源。手机单端和桌面单端使用用户各自的 DeepSeek Key 直接请求云模型；互通模式保持现有同步服务器代理与空间 Key。AI 结果、便签正文和同步协议维持原形状。实现以当前工作树为起点，保留已有未提交改动。

对应已确认设计：`docs/design/2026-11-19-standalone-ai-and-sync-modes-design.md`。

## 逐文件清单与职责

| 路径 | 变更与职责 | 公开接口 / 直接依赖 |
| --- | --- | --- |
| `src/shared/types.ts` | 增加 `AISource`、`AppSettings.aiSource`，扩展 `AIStatus.source` | 供桌面和手机设置、AI API 使用；不包含 Key |
| `src/shared/aiDirect.ts`（新增） | 持有 DeepSeek 请求常量、标注/改写/搜索提示词、纯输入与模型输出校验；不发网络请求 | 导出构造请求和解析结果的纯函数；依赖 `src/shared/ai.ts`、`types.ts` |
| `src/shared/aiSource.ts`（新增） | 根据旧设置和配对状态解析来源，校验 `device`/`sync` 选择 | 导出 `resolveAiSource`；无平台依赖 |
| `src/main/device-ai-key.ts`（新增） | 用 Electron `safeStorage` 加解密本机 Key；加密字节存独立 electron-store 文件 | `getKey/saveKey/deleteKey/getStatus`；只在主进程加载 |
| `src/main/device-ai.ts`（新增） | 通过主进程 `fetch` 直连 DeepSeek，统一超时与上游错误映射 | `annotate/rewrite/testKey`；依赖本机 Key 仓库和共享提示词/校验 |
| `src/types/electron.d.ts` | 为项目现有 Electron 28 本地类型声明补充 `safeStorage` 方法 | 只服务主进程编译，不改变运行时 API |
| `src/main/store.ts` | `AppSettings` 默认值归一化及旧设置来源检测；导出时保留非密钥设置 | 扩展现有 `StickerStore`；不读取 Key |
| `src/main/index.ts` | 初始化时根据旧设置和 `SyncManager.getStatus().linked` 一次性迁移 `aiSource` | 沿用启动编排，不发 AI 请求 |
| `src/main/ipc-handlers.ts` | 现有 AI IPC 按来源路由到 `DeviceAI` 或 `SyncManager`；校验请求、禁用无配对的 `sync` 来源 | 保留现有 IPC 名称和返回形状 |
| `src/renderer/components/settings/AiSettings.tsx` | 展示来源选择、当前来源 Key 状态和准确的隐私同意文案 | 继续调用 `getApi().ai`、`settings:set` |
| `mobile/package.json`、`mobile/package-lock.json`、`mobile/app.json` | 增加 Expo SDK 58 对应的 `expo-secure-store` 与配置插件 | 只增加本机安全存储依赖，不更改应用包标识 |
| `mobile/src/storage/deviceAiKey.ts`（新增） | 用 `expo-secure-store` 保存、读取、删除本机 Key | `getKey/saveKey/deleteKey/getStatus`；不使用 AsyncStorage |
| `mobile/src/storage/preferences.ts` | 增加 `aiSource` 与旧偏好迁移，默认新用户为 `device` | `getPreferences/savePreferences` 签名保持 |
| `mobile/src/api/deviceAi.ts`（新增） | 手机直连 DeepSeek；提供超时、状态码映射、共享结果校验 | `annotate/rewrite/search/testKey`；依赖本机 Key 仓库与 `@shared/aiDirect` |
| `mobile/src/api/aiClient.ts` | 保留现有服务器请求，按 `aiSource` 分流全部 AI 方法 | 对屏幕层的导出签名不变 |
| `mobile/App.tsx` | 未配对时也进入本机便签列表；配对页改为从设置主动进入 | 继续使用现有导航栈和配对回调 |
| `mobile/src/screens/PairingScreen.tsx` | 为可选配对页提供返回本机便签入口并更新名称 | 不改配对 API |
| `mobile/src/screens/SettingsScreen.tsx` | 展示 AI 来源、本机 Key 管理和同步空间 Key 管理，按来源更新隐私说明 | 依赖现有偏好 hook 与 `aiClient` |
| `mobile/src/screens/StickerListScreen.tsx` | 语义搜索隐私文案随 AI 来源变化；候选构造与结果展示不变 | 继续调用 `semanticSearch` |
| `mobile/src/screens/StickerEditorScreen.tsx` | 单端时隐藏同步按钮，AI 未开启时按来源显示正确说明；本机操作不调用同步接口 | 继续调用 `aiClient` 与本地 SQLite |
| `server/test/aiStandalone.test.ts`（新增） | 验证共享直连解析规则、来源迁移和服务端结果约束一致性 | 仅测纯逻辑，不访问真实 DeepSeek |
| `server/package.json` | 把新增测试文件加入现有 `npm test` 脚本 | 不改变服务端运行依赖 |
| `README.md` | 说明三种安装组合、各自 Key 所在位置、联网要求和开源构建无内置 Key | 面向使用者；不改变运行代码 |

不删除文件。`src/main/sync.ts` 和服务端 AI 路由保持原行为；若实现时发现必须改动其请求契约，先回到设计阶段确认。

## 项目风格参考与复用

- **直接复用**：`src/shared/ai.ts` 的 `computeContentHash`、`getLocalTimeZone`、`isAIUsable`；`src/shared/aiRewrite.ts` 的 HTML 转义；`server/src/services/llm.ts` 已验证的提示词及请求参数；现有 `AIAPI` 与手机 `aiClient` 导出方法。
- **扩展复用**：`src/main/ipc-handlers.ts` 的输入检查与现有 IPC；`src/main/store.ts` 的设置合并；`mobile/src/storage/preferences.ts` 的旧字段归一化；两个设置页的 Key 操作 UI。
- **不直接复用**：服务端 `llm.ts` 使用 Node 环境变量、服务器鉴权和数据库标签词表，不能直接导入手机 Metro 包或桌面渲染进程。设备直连只共享纯提示词/解析规则，由各平台分别处理网络与 Key。现有服务器 Key 保存逻辑不能用于本机 Key，因为它要求同步空间和服务端主密钥。

## 接口、配置与数据变化

- `type AISource = 'device' | 'sync'`。桌面 `AppSettings.aiSource`、手机 `MobilePreferences.aiSource` 新增该枚举。新安装默认 `device`；读取旧设置时，若 `aiEnabled` 为真且已有同步 token，迁移为 `sync`，其他旧设置迁移为 `device`。不凭 `syncEnabled` 单独推断配对成功。
- `AIStatus.source` 增加 `'device'`。同步来源继续返回服务端原有 `'space' | 'server' | 'none'`；设备来源返回 `configured/model/keyHint/source`，不返回 Key。`AIAPI` 和手机 `aiClient` 的方法名及请求、响应数据形状保持不变。
- 桌面凭据独立文件 `device-ai-credential` 仅存格式版本和 `safeStorage.encryptString` 输出的 base64。`safeStorage.isEncryptionAvailable()` 为假或解密失败时拒绝本机 AI 并提示重新配置；不写明文。Electron 28 现有 API 为同步方法，之后升级 Electron 再改异步 API。
- 手机 Key 使用 SecureStore 的固定 key `pinote.device-ai-key`。Android 自动备份排除安全存储项；卸载或换设备后需重新输入。Key 不写 `AsyncStorage`、SQLite、服务端、便签或日志。
- DeepSeek 地址和模型沿用当前默认值 `https://api.deepseek.com/v1/chat/completions`、`deepseek-chat`。保留现有 `8000` 字符输入上限、内容哈希检查、超时及错误分类；搜索沿用最多 80 条、每条最多 300 字的候选与最多 20 个白名单 ID。
- `Sticker.ai`、同步 payload、服务器数据库 DDL/索引/约束均不变。桌面备份 JSON 中可以有 `aiSource`，但没有 Key；旧备份缺少 `aiSource` 时按无凭据的默认设备来源处理，若当前设备已有配对 token 且旧备份启用 AI，则按旧用户规则迁移。

## 依赖顺序与完成条件

1. 在 `src/shared/types.ts`、`aiSource.ts`、`aiDirect.ts` 建立来源枚举、迁移函数及纯提示词/结果校验。先写 `server/test/aiStandalone.test.ts` 的来源迁移、无效 JSON、非原文标注、搜索越界 ID 用例，确认缺失实现时测试失败；完成条件是纯逻辑测试通过。
2. 在桌面 `device-ai-key.ts`、`device-ai.ts` 实现安全存储和 DeepSeek 请求；将 `ipc-handlers.ts` 的现有六个 AI IPC 按来源路由，在 `index.ts` 初始化旧设置迁移。完成条件是无同步 token 可在设备来源保存/测试 Key 并进行标注和改写；同步来源仍走原 `SyncManager`。
3. 在手机安装 `expo-secure-store`、更新 `app.json` 插件，在 `deviceAiKey.ts`、`deviceAi.ts` 实现本机 Key 与直连请求；在 `preferences.ts`、`aiClient.ts` 实现来源迁移与分流。完成条件是无配对可标注、改写和语义搜索；服务器来源请求头和现有认证不变。
4. 修改两个设置页和手机搜索提示，明确区分设备 Key 与同步空间 Key；只在当前来源显示相应 Key 操作，切换来源时不复制或删除 Key；按来源更新隐私同意文案与版本。完成条件是用户能看清每种来源会把文本送往哪里及 Key 存在哪里。
5. 更新 README 的三种使用方式；运行全部验证命令并做桌面、Android、服务器手动回归。完成条件是单端无服务器可用、互通旧行为可用、备份和同步均不含本机 Key。

## 测试用例

| 场景 | 输入与动作 | 预期 |
| --- | --- | --- |
| 新手机/新桌面 | 无配对、无 Key，进入 AI 设置 | 来源为设备；提示输入 Key；便签编辑可用，AI 请求不发出。 |
| 旧互通用户 | 已有 token、`aiEnabled=true`、旧设置无 `aiSource`，升级 | 来源迁移为同步；AI 继续请求原服务器。 |
| 设备 Key | 输入有效 Key、测试、重启、移除 | 测试成功；重启后状态仍已配置；移除后请求拒绝且任何备份不含 Key。 |
| 标注与改写 | 设备来源手动触发；编辑期间再改正文 | 返回与现有 UI 兼容的结果；过期结果不写入正文。 |
| 手机语义搜索 | 提交最多 80 条候选；模型返回未知/重复 ID | 只显示候选内且去重的前 20 个 ID。 |
| 上游失败 | 错误 Key、429、超时、无效 JSON、断网 | 显示对应错误；不写坏结果、不静默改走服务器。 |
| 密钥存储异常 | 桌面系统加密不可用或手机 SecureStore 失败 | 保存失败且不回退明文；已有便签可继续编辑。 |
| 来源切换 | 设备↔同步，含无配对尝试 | 无配对时拒绝同步来源；切换不复制/删除任一 Key；同步失败不回退设备来源。 |
| 互通回归 | 两端已有配对、服务端 Key，运行 AI 并同步 | 服务端请求与 AI 结果同步保持原行为。 |

## 验证命令

- 根目录 `npm run typecheck`：桌面与共享 TypeScript 无错误。
- 根目录 `npm run build:unpack`：Windows 解包构建成功；检查 `release/win-unpacked/Pinote.exe`。若环境缺少构建下载，记录阻塞而不声称打包完成。
- `cd mobile && npx tsc --noEmit`：手机与共享 TypeScript 无错误。
- `cd mobile && npx expo run:android --variant release`：生成 Android 发行 APK；需要 Android SDK、设备或模拟器可用。
- `cd server && npm test`：现有 AI/同步测试及新增纯逻辑测试全部通过。新增测试须加入 `server/package.json` 的测试脚本。
- `cd server && npm run build`：现有服务端编译成功。
- 根目录 `git -c safe.directory=D:/personal/HandsomeLittleXing/frostnote diff --check`：无空白错误；逐段核对当前工作树原有改动仍在。
- 手动检查：无同步配置的桌面和 Android 真机分别测试标注/改写；手机额外测试语义搜索；互通模式使用现有测试空间回归；导出桌面备份并全文搜索 Key；检查日志不含 Key。

项目无统一格式化脚本，本次沿用原文件风格并用 `diff --check` 检查。无法进行的真机或服务端验证必须逐项说明原因和风险。

## 文档一致性

本实现对应设计中的三种使用组合、设备直连 DeepSeek、系统安全存储、旧互通用户兼容与无密钥同步。桌面现有列表没有语义搜索入口，因此本轮仅保持手机已有语义搜索；不新增桌面搜索 UI。没有数据库变更或设计偏差。若需要离线模型、多供应商选择、桌面语义搜索或同步协议变化，应先更新功能设计并重新确认。
