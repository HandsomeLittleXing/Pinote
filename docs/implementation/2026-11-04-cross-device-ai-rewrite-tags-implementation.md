# 跨端 AI 配置、便签整理补充与精简标签编码实现文档

> 对应设计：`docs/design/2026-11-03-cross-device-ai-rewrite-tags-design.md`（用户已确认）
> 日期：2026-11-04
> 状态：已实施
> 范围：同步服务端、Windows Electron、Android Expo

## 1. 变更概览

为每个同步空间保存一份 AES-256-GCM 加密的 AI Key，使桌面或手机任一端可配置并供已配对设备使用。沿用现有 AI 标注入口，新增“AI 整理并补充”：服务端返回整理原文的结构化块及最多 3 条分离的补充建议；两端预览、勾选后才把安全 HTML 写入便签，正文改变时拒绝旧提案。AI 每次最多建议 2 个标签，采纳后单便签最多 3 个标签；筛选栏收起低频标签并支持搜索。旧便签、旧标注和现有同步字段保持兼容。

## 2. 逐文件清单与职责

### 2.1 服务端

| 操作 | 路径 | 唯一主要职责、接口与直接依赖 |
| --- | --- | --- |
| 修改 | `server/src/db/schema.sql` | 定义 `ai_credentials` 新表；依赖现有 `sync_spaces` 外键 |
| 修改 | `server/src/db/migrate.ts` | 幂等执行新表迁移；复用 `pool` |
| 新增 | `server/src/services/aiCredentials.ts` | 按同步空间保存、读取、清除加密 Key；导出凭据状态及纯加解密函数，依赖 `pool`、Node `crypto` |
| 新增 | `server/src/services/tagVocabulary.ts` | 从当前同步空间未删除便签的 `tags` 计算高频既有标签，限制传给模型的词表规模；依赖 `pool` |
| 修改 | `server/src/services/llm.ts` | 通过解析出的空间 Key 调用模型，分别生成标注与整理补充；统一超时、错误映射和 Mock；依赖 AI 校验函数 |
| 修改 | `server/src/utils/ai.ts` | 将新生成的标签强制收敛到最多 2 个；保留对旧结果的兼容解析 |
| 新增 | `server/src/utils/aiRewrite.ts` | 验证模型返回的原文整理块与补充项，拒绝非法类型、空块、超限内容；不生成或信任模型 HTML |
| 修改 | `server/src/routes/ai.ts` | 提供 Key 状态/保存/测试/移除与 `/rewrite`，维持 `/annotate`；负责认证、HTTPS 门槛、限流和错误码 |
| 修改 | `server/.env.example` | 说明 `AI_CREDENTIALS_MASTER_KEY`、HTTPS 与旧 `LLM_API_KEY` 后备策略 |
| 修改 | `server/package.json` | 增加 `tsx --test` 测试脚本，显式列出 3 个测试文件，不新增依赖 |
| 新增 | `server/test/aiCredentials.test.ts` | 加解密、篡改、空间隔离及删除后来源回退测试 |
| 新增 | `server/test/aiRewrite.test.ts` | 模型结构校验、补充上限、HTML 转义与标签上限测试 |
| 新增 | `server/test/aiRoutes.test.ts` | 使用注入的凭据/模型测试替身检查认证、HTTPS、状态与写入接口，不连接真实模型 |

### 2.2 共享层与桌面

| 操作 | 路径 | 唯一主要职责、接口与直接依赖 |
| --- | --- | --- |
| 修改 | `src/shared/types.ts` | 扩展 `AIStatus`、`AIAPI`，定义 Key 操作及整理补充请求/响应结构 |
| 修改 | `src/shared/ai.ts` | 提供最多 2 个可见 AI 标签、最多补足到 3 个便签标签的纯函数；不截断旧持久化结果 |
| 新增 | `src/shared/aiRewrite.ts` | 对整理块和已选补充项做 HTML 转义、受限标签序列化；供桌面和手机共用 |
| 修改 | `src/shared/ipc-channels.ts` | 增加 Key 保存/测试/移除及整理补充的 IPC 常量 |
| 修改 | `src/main/sync.ts` | 经现有配对 token 请求服务端 AI 接口；Key 请求在主进程发起，不持久化明文 |
| 修改 | `src/main/ipc-handlers.ts` | 校验 `aiEnabled` 与调用边界后注册新增 IPC |
| 修改 | `src/preload/index.ts` | 向渲染进程暴露受控 AI 方法，不暴露同步 token |
| 修改 | `src/renderer/components/settings/AiSettings.tsx` | Key 输入、遮罩状态、测试、保存、移除及错误反馈 |
| 新增 | `src/renderer/components/AiRewritePanel.tsx` | 桌面原文/整理稿对照、补充项勾选及应用/撤销命令 UI |
| 修改 | `src/renderer/components/StickerEditor.tsx` | 读取当前 HTML、生成与校验提案、应用和会话内撤销，清空过期标注并触发同步 |
| 修改 | `src/renderer/components/AiResultPanel.tsx` | 旧标注最多显示 2 个 AI 建议标签，采纳按钮按剩余名额禁用 |
| 修改 | `src/renderer/components/StickerList.tsx` | 计算高频标签和选中项，向筛选栏传入可见及折叠标签 |
| 修改 | `src/renderer/components/FilterBar.tsx` | 固定少量标签，其余放入可搜索的“更多标签”弹出菜单 |

### 2.3 Android 与说明文档

| 操作 | 路径 | 唯一主要职责、接口与直接依赖 |
| --- | --- | --- |
| 修改 | `mobile/src/api/aiClient.ts` | 添加 Key 状态/保存/测试/移除及整理补充的认证请求，按错误码提示 |
| 修改 | `mobile/src/screens/SettingsScreen.tsx` | 与桌面一致的 Key 表单、状态和操作反馈 |
| 新增 | `mobile/src/components/AiRewriteSheet.tsx` | 手机原文/整理稿切换、逐条补充选择、应用与撤销入口 |
| 修改 | `mobile/src/screens/StickerEditorScreen.tsx` | 读取 RichEditor HTML、校验哈希、应用安全 HTML、清空旧标注并同步；保存原文快照供会话内撤销 |
| 修改 | `mobile/src/components/AiResultSheet.tsx` | 最多展示 2 个建议标签，按剩余名额采纳 |
| 修改 | `mobile/src/screens/StickerListScreen.tsx` | 计算高频标签并保留当前筛选项 |
| 修改 | `mobile/src/components/FilterChips.tsx` | 常用标签留在横向筛选栏，其余通过可搜索菜单访问 |
| 修改 | `README.md` | 区分旧“标注不改正文”与新“整理补充经确认后改正文”；更新 Key 配置入口 |
| 修改 | `docs/DEPLOYMENT.md` | 主密钥、HTTPS 代理、迁移、备份、回退及 Key 配置说明 |
| 修改 | `docs/SYNC-ARCHITECTURE.md` | AI Key 独立于便签同步、整理补充只在应用后进入 `content` 的数据流 |

不修改 `Sticker` 持久化字段、`mobile/src/storage/db.ts`、同步协议或现有皮肤。上表涉及的多个未跟踪文件已在当前工作树中，实施时只在已有内容上增量编辑，不覆盖其他改动。

## 3. 项目风格参考与复用

| 类别 | 参考与决定 |
| --- | --- |
| 直接复用 | `server/src/middleware/auth.ts` 的 `syncSpaceId`、`server/src/middleware/rateLimit.ts`、`server/src/db/pool.ts`、现有 `/ai/annotate` 错误响应；两端原有 AI 开关、便签保存/同步流程 |
| 扩展复用 | `src/shared/ai.ts` 的内容哈希与旧标注兼容解析；`server/src/services/llm.ts` 的 DeepSeek/OpenAI 兼容请求、超时与 Mock；桌面 `ConfirmDialog`、手机 `AiResultSheet` 的弹层和状态写法 |
| 不直接复用 | 服务端 `server/src/utils/ai.ts` 无法直接导入 `src/shared/aiRewrite.ts`：服务端 `tsconfig.json` 的 `rootDir` 限定为 `server/src`；因此服务端校验模型数据，两端共享纯 HTML 渲染器 |
| 低频标签 UI | 桌面沿用已安装的 Radix Popover；手机沿用 React Native `Modal`/`TextInput`，不引入新的 UI 依赖 |

## 4. 接口、数据与兼容策略

### 4.1 AI 接口

```ts
type AIKeySource = 'space' | 'server' | 'none';
type AIStatus = { configured: boolean; model: string; source?: AIKeySource; keyHint?: string };
type AIRewriteRequest = { plainText: string; contentHash: string };
type AIRewriteResponse = {
  sourceHash: string;
  organizedBlocks: Array<{ type: 'heading' | 'paragraph' | 'bullet'; text: string }>;
  supplements: Array<{ id: string; kind: 'suggestion' | 'example' | 'question'; text: string }>;
};
```

`source` 可选仅用于兼容旧服务端状态响应；新服务端始终返回。`GET /ai/status` 不含 Key 明文。`PUT /ai/key` 接受 `{ apiKey: string }` 并返回遮罩状态；`POST /ai/key/test` 只测试已保存的有效 Key，不记录测试文本；`DELETE /ai/key` 清空空间 Key，随后按服务器默认 Key 重新计算状态。新增 `POST /ai/rewrite` 返回纯结构化数据。所有写入及改写接口继续使用配对 Bearer token；Key 写入在生产环境要求 `req.secure`，开发期仅允许直接本机 loopback 明文 HTTP。若由 Nginx 终止 TLS，部署需设置可信代理及 `X-Forwarded-Proto`，不能仅凭客户端自报的头判断安全连接。

桌面 `AIAPI` 增加 `saveKey(apiKey)`, `testKey()`, `deleteKey()`, `rewrite(request)`；移动端导出同义请求函数。旧 `/ai/annotate` 和旧客户端继续可用；旧客户端看不到新功能。服务端 401、413、429、502、503、504 分别对应认证、长度、限流、模型输出、未配置、超时。输入长度继续使用 `AI_MAX_INPUT_CHARS`，补充内容在服务端强制最多 3 条、建议标签最多 2 条。

### 4.2 数据库与迁移

与已确认设计一致，新增独立表；`stickers`、`sync_spaces`、`devices` 不改字段。`ai_credentials` 含标准逻辑删除与时间字段，所有列提供中文注释。

```sql
CREATE TABLE IF NOT EXISTS `ai_credentials` (
  `sync_space_id` CHAR(36) NOT NULL COMMENT '所属同步空间，唯一配置一份 AI 凭据',
  `encrypted_key` VARBINARY(1024) NULL COMMENT 'AES-256-GCM 加密的 API Key；移除时清空',
  `iv` BINARY(12) NULL COMMENT 'GCM 随机初始化向量；移除时清空',
  `auth_tag` BINARY(16) NULL COMMENT 'GCM 认证标签；移除时清空',
  `key_hint` CHAR(4) NULL COMMENT '仅用于界面遮罩显示的末尾四位；移除时清空',
  `is_deleted` TINYINT(1) UNSIGNED DEFAULT 0 NOT NULL COMMENT '是否删除 0-否 1-是',
  `create_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time` DATETIME(3) NULL COMMENT '最近一次更新或移除时间',
  PRIMARY KEY (`sync_space_id`),
  CONSTRAINT `fk_ai_credentials_sync_space` FOREIGN KEY (`sync_space_id`)
    REFERENCES `sync_spaces` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

`server/src/db/migrate.ts` 用 `INFORMATION_SCHEMA` 检查后建表，可重复运行。服务端读取优先级为未删除的空间 Key、旧 `LLM_API_KEY`、未配置；`AI_MOCK=1` 仅供本地联调。`AI_CREDENTIALS_MASTER_KEY` 为 32 字节随机值的 Base64；缺失或格式非法时拒绝保存/解密空间 Key，并返回明确错误，不把密文当明文回退。空间 Key 写入与逻辑删除使用参数化 SQL，删除时同时清空密文、IV、认证标签和提示末尾四位。主密钥轮换需要旧密钥解密并重新加密所有有效行；不可解密时用户重新输入 Key。回滚应用版本时先备份表，旧服务端仍可使用 `LLM_API_KEY`；确认不再使用新凭据后才可删除新表，绝不自动删除用户配置。

### 4.3 内容与标签

服务端把便签纯文本当不可信输入，要求模型返回 JSON；`server/src/utils/aiRewrite.ts` 验证整理块仅含 `heading | paragraph | bullet`，补充项仅含 `suggestion | example | question`，无价值时允许 0 条。桌面/手机只用 `src/shared/aiRewrite.ts` 生成 `<h2>`、`<p>`、`<ul>/<li>` 等受限 HTML，逐项转义 `& < > " '`；选中建议统一追加在“补充建议”小节。模型原始 HTML 不写入编辑器。

生成前保存当前 HTML；应用前重新读取编辑器并比较 `computeContentHash(noteToPlainText(html))` 与 `sourceHash`。若变化则拒绝应用。应用成功后把 `Sticker.ai` 置为 `null`，保留 `tags`、颜色和其他属性；会话内快照可撤销一次，退出后清除。桌面使用 Tiptap `setContent`，手机使用 RichEditor `setContentHTML`，完成写库后调用原有同步。含图片/嵌入节点的 HTML 禁用替换；普通富文本格式损失在预览前明确提示。

新 AI 标注提示词和服务端结果最多给 2 个标签，并优先使用同一同步空间未删除便签的高频标签。旧 `AIAnnotation.tags` 的兼容解析仍允许旧数据最多 6 个，不在读取时裁剪；两端展示最多 2 个，采纳函数去重并在便签已有 3 个标签时返回空集。人工标签超过 3 个的旧便签保持原状。桌面与手机筛选栏展示高频标签和当前选中标签，其余放可搜索菜单，不改变过滤规则。

## 5. 实现步骤与完成条件

1. 在 `server/test` 中先写凭据加解密、整理结构及安全 HTML 的失败用例；实现 `src/shared/aiRewrite.ts`、`server/src/utils/aiRewrite.ts` 和新共享类型，直到纯函数测试通过。
2. 增加表定义及幂等迁移；实现 `aiCredentials.ts` 和 `tagVocabulary.ts`，验证跨空间隔离、删除后后备来源和主密钥异常。
3. 扩展 `llm.ts` 与 `/ai` 路由；先用 Mock 和测试替身覆盖新旧接口、限流与错误码，再接真实模型调用。保留原标注响应结构。
4. 扩展桌面 IPC、主进程请求、preload 与设置页；确认明文 Key 只存在于输入值和请求生命周期，状态响应只含来源与末尾四位。
5. 接入桌面整理预览、选中补充、应用与撤销，并压缩 AI 标签展示和筛选栏；验证应用后 `ai=null`、旧提案拒绝及保存同步。
6. 接入手机设置、整理弹层、编辑器应用/撤销及标签筛选；在已连接 Android 上检查浅/深色、键盘、返回与保存，不改变皮肤样式。
7. 更新 README、部署和同步架构说明；完成全部静态检查、测试与构建，核对工作树，仅报告本次相关文件。

## 6. 测试用例

| 场景 | 输入与动作 | 预期 |
| --- | --- | --- |
| Key 保存与覆盖 | 已配对桌面保存 Key，手机刷新状态并覆盖 | 同空间状态及末尾四位一致；接口、日志、便签同步均不返回明文 |
| 隔离与回退 | 两个空间配置不同 Key；删除其中一个 | 互不影响；有 `LLM_API_KEY` 时显示服务器默认，否则未配置 |
| 凭据异常 | 空 Key、过长 Key、错误主密钥、篡改密文、非 TLS、无 token | 拒绝请求，原有效 Key 不被覆盖，不泄漏明文 |
| 整理补充 | 普通文本含错字、待办与段落，模型返回 2 条补充 | 原文整理成受限块，补充独立展示；可只应用整理或选择部分补充 |
| 零补充与过量 | 无合理补充或模型返回 4 条/非法块 | 零补充可应用整理；超量或非法输出返回 `invalid_ai_output`，不能混入正文 |
| 并发与富文本 | 生成后编辑正文；输入含 `<script>`；含嵌入媒体 | 旧提案不可应用；HTML 转义后作为文字；媒体便签禁用一键替换 |
| 应用与撤销 | 勾选补充后应用，随后撤销并同步 | 正文含“补充建议”小节；应用使 `ai=null`，撤销恢复原 HTML；两端同步一致 |
| 标签上限 | 既有标签数为 0、1、2、3、4；旧 AI 结果含 6 个建议 | 每次只显示/建议最多 2 个；采纳最多补到 3；旧标签不删除 |
| 标签查找 | 标签总数较多，输入菜单搜索词并选中低频标签 | 菜单可检索并应用过滤；当前选中标签始终可见 |

## 7. 验证命令与环境

```powershell
# 项目根目录
npm run typecheck
npm run build:unpack

# server 目录
npm test
npm run build
npm run db:migrate

# mobile 目录
npx tsc --noEmit

# mobile/android 目录，需 JDK 17 与 Android SDK
.\gradlew.bat -I .\aliyun-mirrors.gradle :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon

# 项目根目录
git diff --check
```

`npm test` 由本次在 `server/package.json` 增加，脚本为 `tsx --test test/aiCredentials.test.ts test/aiRewrite.test.ts test/aiRoutes.test.ts`。`db:migrate` 只对已备份的测试或目标数据库执行；前提是 `server/.env` 的 MySQL 连接可用。接口集成与两端跨设备验证需要本地/测试服务、HTTPS、测试 Key 和配对设备。Android 离线构建可使用本机缓存的 Gradle 9.4.1；若 Foojay 插件无法下载，仅临时调整 `node_modules` 中的构建辅助配置并在结束后恢复，不纳入提交。预期全部命令退出码为 0；任何环境缺失或失败均记录命令、原因和未验证风险，不宣称完成。

## 8. 与设计文档的一致性

实现遵循已确认的共享空间 Key、整理原文与最多 3 条独立补充、逐条选择后应用、最多 2 个 AI 标签与单便签最多 3 个标签。保留 `Sticker` 结构和旧标注能力；新正文修改仅在用户明确应用后发生。没有计划中的设计偏差；若实施时需要修改同步协议、支持媒体替换或改变 Key 存储方式，先更新功能设计并重新确认。
