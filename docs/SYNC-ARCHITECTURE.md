# StickerNote 云同步 & 移动端架构设计

> 版本：v1.1 · 日期：2026-10-22
> 目标：电脑 exe 与手机 App 之间互通便签数据（个人单用户，无账号体系）
> 部署形态：轻量后端常驻阿里云 ECS，桌面与手机均为客户端

---

## 1. 背景与目标

原 StickerNote 为纯本地单机 Electron 应用，数据存于 `electron-store`（JSON），无网络层。本方案新增：

1. **后端同步服务**（Node.js + Express + MySQL）：部署在 ECS（your-server.com），常驻运行。
2. **桌面端同步模块**：作为客户端，定时与后端增量双向同步。
3. **手机 App**（React Native + Expo）：随时随地查看/编辑/同步便签。

设计原则：

- **个人单用户、无登录态**：不做账号密码，用「配对码」把多台设备关联到同一个「同步空间」。
- **增量同步 + 最后写入优先**：不做复杂 CRDT，冲突时以 `updatedAt` 较新者为准。
- **软删除**：删除以 tombstone（`deletedAt`）同步，而不是直接物理删除。
- **桌面端本地优先**：桌面数据仍在本地 electron-store，离线可用；联网时与云端同步。

---

## 2. 总体架构

```
┌────────────────────┐          HTTP      ┌─────────────────────────────┐
│  电脑端 exe (Electron)│ ───────────────► │  阿里云 ECS your-server.com   │
│  StickerStore(本地)  │  :4000            │  Node + Express 同步服务      │
│  SyncManager(客户端) │                   │        │                     │
└────────────────────┘                    │        ▼                     │
                                          │  MySQL (本机 127.0.0.1)      │
┌────────────────────┐          HTTP      │  sticker_note_sync 库        │
│  手机 App (Expo RN)  │ ───────────────► └─────────────────────────────┘
│  SQLite + AsyncStorage│
│  syncClient(客户端)  │
└────────────────────┘
```

- **后端是权威副本**；桌面与手机都是「本地缓存 + 本地编辑 + 同步」。
- 两端复用同一份数据类型定义（`src/shared/types.ts`），避免字段漂移。
- 手机可以在任意网络（移动流量/异地 WiFi）访问后端，不要求与电脑同网。

---

## 3. 数据模型

### 3.1 后端 MySQL 表（库名 `sticker_note_sync`）

| 表 | 作用 | 关键字段 |
|----|------|---------|
| `sync_spaces` | 同步空间（轻量「用户」） | `id` (UUID) |
| `devices` | 已配对设备 | `sync_space_id`, `token_hash`(SHA-256), `device_name`, `platform` |
| `pairing_codes` | 短期配对码 | `code`(6位), `expires_at`, `redeemed_at` |
| `stickers` | 服务端权威便签副本 | **主键 `(sync_space_id, id)`**, 全字段, `deleted_at`(软删除) |

要点：

- **token 只存 SHA-256 哈希**，明文 token 仅在注册/兑换时返回一次。
- 便签表按 `sync_space_id` 隔离，`(sync_space_id, updated_at)` 建索引支持增量拉取。
- **主键必须是 `(sync_space_id, id)` 而非 `id`**：同一张本地便签可能被同步到不同同步空间
  （例如设备重新注册/重新配对后），仅用 `id` 做主键会触发跨空间主键冲突。
  已有库执行 `node dist/db/migrate.js` 迁移。
- 删除为软删除：`deleted_at` 置位，记录保留以同步 tombstone。

### 3.2 便签数据结构

`src/shared/types.ts` 的 `Sticker` 在原有字段基础上新增 `deletedAt: string | null`：

```
id, content, color, tags, isPinned, isVisible, opacity, reminder,
reminderTriggered, createdAt, updatedAt, deletedAt, windowState
```

---

## 4. 配对流程（无账号）

```
桌面端（首次启动自动注册）                 手机端（首次打开 App）
      │                                      │
      │ POST /devices/register               │
      │ ◄── token（存本地 electron-store）    │
      │                                      │
      │ POST /pairing/create (Bearer)        │
      │ ◄── 6 位配对码                        │
      │                                      │
      │   设置页展示配对码 + 二维码            │
      │   （二维码内容：{"serverUrl","code"}） │
      │                                      │
      │           用户扫码 / 手输配对码 ────────►│ POST /pairing/redeem
      │                                      │ ◄── 同 sync_space 的 token
      │                                      │ token 存 AsyncStorage
      └────────── 两端共享同一 sync_space_id ──────────┘
```

- 配对码有效期 5 分钟、**单次有效**，兑换后即失效。
- 扫码会同时自动填入「服务器地址」与「配对码」。
- 桌面设置页可查看已配对手机列表并解绑。

### 4.1 接口清单

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/devices/register` | 无 | 创建 sync_space + 首台设备，返回 token |
| POST | `/pairing/create` | Bearer | 生成配对码 |
| POST | `/pairing/redeem` | 无 | 用配对码兑换 token |
| GET | `/devices` | Bearer | 列出本空间所有设备 |
| DELETE | `/devices/:id` | Bearer | 解绑设备 |
| POST | `/sync` | Bearer | 增量双向同步 |
| GET | `/health` | 无 | 健康检查 |

---

## 5. 同步协议（`POST /sync`）

请求：

```json
{ "since": "2026-10-22T03:00:00.000Z", "changes": [ { "…Sticker…" } ] }
```

响应：

```json
{ "serverTime": "2026-10-22T03:05:00.000Z", "changes": [ { "…Sticker…" } ] }
```

同步步骤（两端相同）：

1. 收集本地 `updatedAt > lastSyncedAt - 10 分钟` 的变更（含删除 tombstone），POST 到后端。
2. 后端逐条合并：**服务端 `updatedAt` ≥ 传入值则跳过（最后写入优先）**，否则 upsert。
3. 后端返回 `updatedAt > since - 10 分钟` 的全部记录。
4. 客户端逐条合并：本地不存在或远程较新则覆盖；更新本地 `lastSyncedAt = serverTime`。

**为什么要有 10 分钟重叠窗口**：游标 `lastSyncedAt` 用的是服务器时间，而记录时间来自各设备
本地时钟。设备时钟比服务器慢时，新记录的时间戳可能早于游标，严格 `>` 比较会**永久漏同步**。
重叠窗口让最近 10 分钟的记录重复下发，客户端按 `updatedAt` 去重即可，重复无害。

服务端 upsert 使用 `INSERT ... ON DUPLICATE KEY UPDATE`，并发下不会因主键冲突失败；
所有异步路由用 `asyncHandler` 包装，单个请求异常不会导致进程退出。

触发时机：

- 桌面端：启动时 + 每 30 秒定时 + 设置页「立即同步」。
- 手机端：列表页获得焦点时（含从编辑页返回）+ 顶部「⟳ 同步」按钮 + 下拉刷新 + 编辑页「同步」。

---

## 6. 桌面端改造

| 文件 | 改动 |
|------|------|
| `src/shared/types.ts` | `Sticker` 加 `deletedAt`；新增 `SyncStatus`/`SyncDevice`/`PairingCodeResult`/`SyncAPI` |
| `src/shared/ipc-channels.ts` | 新增 `SYNC_*` 通道 |
| `src/main/store.ts` | 软删除、`getAllStickersRaw()`（含 tombstone）、`upsertFromSync()` |
| `src/main/sync.ts` | 新增 `SyncManager`：设备注册、配对码、定时同步、改服务器地址 |
| `src/main/ipc-handlers.ts` / `src/preload/index.ts` | 注册同步 IPC + 暴露 `sync` API |
| `src/main/index.ts` | 装配 `SyncManager`，数据变化广播刷新列表 |
| `src/renderer/components/Settings.tsx` | 「手机同步」区块：服务器地址、同步状态、立即同步、配对码/二维码、设备解绑 |

- 桌面端默认服务器地址为空，在设置页填写（也可用 `STICKERNOTE_SERVER_URL` 预设）。
- 同步凭证存于 `electron-store` 的 `stickernote-sync.json`。
- 桌面端仍是**单个 exe**，不需要在本机启动任何服务。

---

## 7. 手机端（Expo RN）

| 模块 | 文件 | 说明 |
|------|------|------|
| 配对 | `src/screens/PairingScreen.tsx` | 输入配对码 / 扫码（`expo-camera`，解析二维码 JSON） |
| 列表 | `src/screens/StickerListScreen.tsx` | 本地列表 + 搜索 + 同步按钮 + 下拉刷新 + 新建/删除 |
| 编辑 | `src/screens/StickerEditorScreen.tsx` | `react-native-pell-rich-editor`（HTML 与桌面 Tiptap 兼容） |
| 存储 | `src/storage/db.ts` | `expo-sqlite` 本地缓存便签 |
| 凭证 | `src/storage/credentials.ts` | `AsyncStorage` 存服务器地址与 token |
| 同步 | `src/api/syncClient.ts` | 配对兑换 + 增量同步 |

类型复用：tsconfig `paths` 将 `@shared/*` 映射到 `../src/shared/*`（均为 `import type`，编译期擦除，无运行时依赖）。

---

## 8. 安全说明

个人单用户场景下的最小可用方案，**长期使用建议按优先级加固**：

| 项 | 现状 | 风险 | 建议 |
|----|------|------|------|
| 传输 | 明文 HTTP | 公网可嗅探 token/内容 | 加 Nginx + 免费 SSL，客户端改 https |
| 配对码枚举 | 已限流：每 IP 每分钟 5 次，成功兑换后重置 | 已大幅降低 | 保持；反向代理后设 `TRUST_PROXY=1` |
| 令牌 | Bearer token，服务端存哈希 | token 泄露可读写全部数据 | HTTPS + 解绑/重配对 |
| 数据库 | root 账号，且 3306 可能对公网开放 | 权限过大、被扫描撞库 | 建专用最小权限账号；安全组仅放行必要来源 |
| 端口 | 4000 对公网开放 | 扫描风险 | 可改为仅放行常用 IP 或走 443 |

> 限流实现为进程内内存计数（`server/src/middleware/rateLimit.ts`），单实例部署足够；
> 若未来多实例部署，需换成 Redis 等共享存储。

---

## 9. 部署与运行

### 9.1 后端（ECS）

详见 `server/deploy/README.md`，要点：

1. 安全组放行 4000（或 443）。
2. 安装 Node 20，上传 `server/`，`npm install && npm run build`。
3. `.env` 中 `DB_HOST=127.0.0.1`（MySQL 与后端同机）。
4. 首次执行数据库初始化（`npm run db:init`）。
5. 注册 systemd 服务：`deploy/stickernote-sync.service`。

### 9.2 桌面端

```bash
npm install
npm run dev        # 开发
npm run build      # 打包 exe（NSIS）
```

### 9.3 手机端

```bash
cd mobile
npm install
npx expo start     # 用 Expo Go 扫码运行
```

配对页服务器地址默认留空，可手动填写或扫码自动带入（也可用 `EXPO_PUBLIC_SERVER_URL` 预设）。

### 9.4 本地调试（不依赖 WiFi / 防火墙）

**USB 调试（推荐，无需扫码）**

1. 手机开启「开发者选项 → USB 调试」，连接数据线并授权。
2. `adb reverse tcp:8081 tcp:8081 && adb reverse tcp:4000 tcp:4000`
3. `npx expo start`（不要加 `--localhost`，否则只监听 IPv6，adb 反向映射连不上）
4. `adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081"`
5. 在 `mobile/.env` 中设置 `EXPO_PUBLIC_SERVER_URL=http://localhost:4000`，
   配对页的服务器地址即为 `http://localhost:4000`（经 USB 映射到电脑后端）。

> Expo Go 版本必须与项目 SDK 匹配：SDK 58 需要 Expo Go 58.x。
> 桌面端本地调试可用 `STICKERNOTE_SERVER_URL=http://localhost:4000 npm run dev`。

**同一局域网调试**：手机与电脑连同一 WiFi，配对页填电脑局域网 IP（如 `http://192.168.1.5:4000`），
并确保 Windows 防火墙已放行 4000 端口。桌面端设置页会自动显示转换后的局域网配对地址。

---

## 10. 待办 / 后续

- [ ] ECS 上实际部署后端（放行端口、上传、systemd、验证公网 /health）
- [ ] 配置 HTTPS（Nginx + 证书），客户端切到 https
- [ ] 配对码兑换失败次数限制（防暴力枚举）
- [ ] MySQL 专用最小权限账号（替代 root）
- [ ] 手机端本地提醒通知（`expo-notifications` 已装，逻辑待接入）
- [ ] 富文本 HTML 与桌面 Tiptap 的兼容性验证（列表/待办/字号）
- [ ] exe 打包与自动更新

---

*文档结束*
