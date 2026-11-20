# StickerNote 部署文档

> 版本：v1.0 · 日期：2026-10-22
> 适用：把同步后端部署到阿里云 ECS，桌面端与手机端作为客户端连接

---

## 1. 部署架构

```
┌──────────────────────┐         HTTP/HTTPS        ┌─────────────────────────────┐
│ 桌面 exe（Electron）   │ ───────────────────────► │ 阿里云 ECS your-server.com    │
│ 本地 electron-store   │        :4000 / :443      │ Node + Express 同步服务       │
└──────────────────────┘                           │        │                     │
                                                   │        ▼                     │
┌──────────────────────┐         HTTP/HTTPS        │ MySQL 127.0.0.1:3306         │
│ 手机 App（Expo/APK）   │ ───────────────────────► │ 库：sticker_note_sync        │
│ SQLite + AsyncStorage │                           └─────────────────────────────┘
└──────────────────────┘
```

- 服务器是**唯一权威副本**；桌面与手机各自保留本地数据，联网时增量双向同步。
- 支持**多部手机**同时配对（每部手机一个独立 token）。
- 无账号体系：用「配对码」把设备加入同一个同步空间。

---

## 2. 前置条件

| 项 | 要求 |
|----|------|
| 服务器 | 阿里云 ECS，已安装 MySQL（本机 3306） |
| 网络 | 安全组放行 TCP **4000**（用 HTTPS 则放行 **443**） |
| 本地环境 | Node.js 18+、npm；Git Bash（Windows）或 bash |
| 服务器环境 | Node.js 20（部署脚本会检查） |
| 配置 | `server/.env` 已填写数据库连接信息 |

---

## 3. 阿里云控制台准备

1. 实例 → **网络与安全组** → 安全组 → 入方向 → 添加：

   | 端口 | 来源 | 用途 |
   |------|------|------|
   | 4000/4000 | 0.0.0.0/0 | 同步服务（个人使用；接口有 token 保护） |
   | 443/443 | 0.0.0.0/0 | HTTPS（可选，推荐） |

2. **安全建议：关闭 MySQL 3306 的公网访问**（当前 3306 可从公网直连 root，风险很高）。
   - 安全组删除 3306 入方向规则（后端与 MySQL 同机，走 127.0.0.1 不受影响）
   - 或至少限制为你的常用 IP

---

## 4. 安装 Node.js 20（服务器）

SSH 登录 ECS 后任选一种：

**方式 A：NodeSource（简单）**

```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
node -v
```

**方式 B：直接下载二进制（国外源慢时使用）**

```bash
curl -fsSL https://npmmirror.com/mirrors/node/v20.18.0/node-v20.18.0-linux-x64.tar.xz -o /tmp/node.tar.xz
sudo mkdir -p /usr/local/node
sudo tar -xJf /tmp/node.tar.xz -C /usr/local/node --strip-components=1
sudo ln -sf /usr/local/node/bin/node /usr/bin/node
sudo ln -sf /usr/local/node/bin/npm /usr/bin/npm
node -v
```

---

## 5. 一键部署（推荐）

在**本地**项目目录执行：

```bash
cd server/deploy
bash deploy-from-local.sh
```

脚本会提示输入 SSH 密码，依次完成：

1. 本地构建后端（`npm install && npm run build`）
2. 上传 `dist / package.json / .env` 到服务器
3. 服务器安装生产依赖（默认使用 npmmirror 镜像）
4. **初始化数据库并执行结构迁移**（幂等，可重复执行）
5. 创建低权限运行用户 `stickernote`
6. 注册并启动 systemd 服务
7. 从公网做健康检查

### 可配置参数

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `SSH_TARGET` | `root@your-server.com` | SSH 登录目标 |
| `PUBLIC_HOST` | 从 `SSH_TARGET` 推导 | 健康检查用的公网地址 |
| `REMOTE_DIR` | `/opt/stickernote-sync` | 服务器安装目录 |
| `SERVICE_USER` | `stickernote` | 运行服务的系统用户 |
| `PORT` | `4000` | 服务端口 |
| `NPM_REGISTRY` | `https://registry.npmmirror.com` | npm 镜像源，可留空用默认 |

示例：

```bash
SSH_TARGET=root@1.2.3.4 PUBLIC_HOST=1.2.3.4 bash deploy-from-local.sh
```

### 通过阿里云控制台上传（本地打包，不使用 SSH）

适合本机没有 bash/SSH、或想用阿里云 Workbench 上传的场景。

**本地打包（PowerShell）**

```powershell
cd server\deploy
# 默认：服务器需要联网安装依赖
powershell -ExecutionPolicy Bypass -File .\package-for-upload.ps1

# 离线包：把 node_modules 一起打包，服务器无需联网
powershell -ExecutionPolicy Bypass -File .\package-for-upload.ps1 -Offline
```

产物：`server/deploy/stickernote-sync-deploy.tar.gz`（含 `dist/`、`package.json`、`.env`）。

> ⚠️ 压缩包内包含 `.env`（数据库密码），不要发送给他人、不要提交到仓库。

**上传**：阿里云控制台 → 实例 → 远程连接 / Workbench → 文件上传，把压缩包传到 `/root/`。

**服务器部署命令**（在 Workbench 终端中粘贴执行）：

```bash
sudo mkdir -p /opt/stickernote-sync
sudo tar -xzf /root/stickernote-sync-deploy.tar.gz -C /opt/stickernote-sync
cd /opt/stickernote-sync

# 生产环境 MySQL 与后端同机
sudo sed -i 's/^DB_HOST=.*/DB_HOST=127.0.0.1/' .env

# 安装生产依赖（使用 -Offline 打包时跳过此步）
sudo npm install --omit=dev --registry=https://registry.npmmirror.com

# 建库/迁移（幂等）
sudo node dist/db/init.js
sudo node dist/db/migrate.js

# 低权限运行用户与权限
sudo useradd -r -s /sbin/nologin stickernote || true
sudo chown -R stickernote:stickernote /opt/stickernote-sync
sudo chmod 600 /opt/stickernote-sync/.env

# systemd 服务
NODE_BIN=$(command -v node)
sudo tee /etc/systemd/system/stickernote-sync.service > /dev/null <<UNIT
[Unit]
Description=StickerNote Sync Server
After=network.target mysql.service

[Service]
Type=simple
WorkingDirectory=/opt/stickernote-sync
EnvironmentFile=/opt/stickernote-sync/.env
Environment=NODE_ENV=production
ExecStart=$NODE_BIN /opt/stickernote-sync/dist/index.js
Restart=always
RestartSec=5
User=stickernote
Group=stickernote
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now stickernote-sync
sudo systemctl status stickernote-sync --no-pager

# 验证并清理上传包
curl http://127.0.0.1:4000/health
sudo rm -f /root/stickernote-sync-deploy.tar.gz
```

> 服务器需安装 Node.js 20（见第 4 节），否则 `node` 命令不存在。

---

## 6. 手动部署（不使用脚本）

```bash
# 本地构建
cd server
npm install
npm run build

# 上传（本地执行）
scp -r dist package.json .env root@your-server.com:/tmp/stickernote-sync/

# 服务器上
sudo mkdir -p /opt/stickernote-sync
sudo mv /tmp/stickernote-sync/* /opt/stickernote-sync/
cd /opt/stickernote-sync
npm install --omit=dev --registry=https://registry.npmmirror.com

# 数据库初始化 + 迁移
node dist/db/init.js
node dist/db/migrate.js

# 低权限用户与权限
sudo useradd -r -s /sbin/nologin stickernote || true
sudo chown -R stickernote:stickernote /opt/stickernote-sync
sudo chmod 600 /opt/stickernote-sync/.env

# systemd
sudo cp deploy/stickernote-sync.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now stickernote-sync
```

> 手动部署时请确认 systemd 文件里的 `ExecStart` 指向真实的 node 路径
> （`command -v node` 查看），`WorkingDirectory` 为实际安装目录。

---

## 7. 环境变量说明（`server/.env`）

```ini
DB_HOST=127.0.0.1          # 生产环境 MySQL 与后端同机
DB_PORT=3306
DB_USER=stickernote        # 建议使用专用账号，见第 11 节
DB_PASSWORD=你的数据库密码
DB_NAME=sticker_note_sync

PORT=4000                  # 服务监听端口
PAIRING_CODE_TTL_SECONDS=300
TRUST_PROXY=0              # 部署在 Nginx 后面时设为 1

# AI 整理（DeepSeek / 任意 OpenAI 兼容接口）
LLM_BASE_URL=https://api.deepseek.com/v1
AI_CREDENTIALS_MASTER_KEY=填写32字节随机值的Base64编码
LLM_API_KEY=你的 DeepSeek API Key
LLM_MODEL=deepseek-chat
LLM_TIMEOUT_MS=25000
AI_MAX_INPUT_CHARS=8000
AI_RATE_LIMIT_SPACE_PER_MIN=8
AI_RATE_LIMIT_IP_PER_MIN=20
AI_MOCK=0                  # 仅本地联调设为 1，生产不要开启
```

> `.env` 已被 `.gitignore` 忽略，**不要提交到仓库**。
> 桌面和手机任一端可在已配对的同步空间设置 AI Key。服务端用 `AI_CREDENTIALS_MASTER_KEY` 通过 AES-256-GCM 加密保存；客户端不持久化明文。`LLM_API_KEY` 作为未配置空间 Key 时的后备。配置 Key 的请求必须经 HTTPS，直连 localhost 开发环境例外。反向代理终止 TLS 时设置 `TRUST_PROXY=1`，并确保代理是唯一可信入口。主密钥需独立备份；丢失后原空间 Key 无法解密，需用户重新输入。运行 `npm run db:migrate` 前先备份目标库，新表迁移幂等；回退旧服务端前保留 `ai_credentials` 表和服务器默认 Key，勿自动删除用户凭据。
> 已有数据库升级到本版本后，需先执行一次 `npm run db:migrate`（或服务器上的 `node dist/db/migrate.js`），为 `stickers` 表补 `ai` 和 `tasks` JSON 列，再使用新版手机端同步。

---

## 8. 服务管理

```bash
sudo systemctl status stickernote-sync     # 状态
sudo systemctl restart stickernote-sync    # 重启
sudo systemctl stop stickernote-sync       # 停止
sudo journalctl -u stickernote-sync -f     # 实时日志
```

---

## 9. 验证清单

按顺序检查：

1. **服务器本地**

   ```bash
   curl http://127.0.0.1:4000/health
   # {"ok":true}
   ```

2. **公网（本地电脑）**

   ```bash
   curl http://your-server.com:4000/health
   ```

3. **手机公网**（关闭 WiFi、使用移动数据，手机浏览器打开）：
   `http://your-server.com:4000/health`

4. **桌面端**：设置 → 手机同步 → 服务器地址填 `http://your-server.com:4000` → 应用 → 立即同步
   → 显示「● 已连接同步服务」

5. **手机端**：桌面端生成配对码 → 手机配对 → 列表出现电脑端便签

> 第 2/3 步失败而第 1 步成功，基本就是安全组没放行端口。

---

## 10. 客户端配置

### 10.1 桌面端

- 开发运行：`npm run dev`
- 打包 exe：`npm run build`（产物在 `release/`）
- 桌面端默认服务器地址为空，在设置页填写；也可通过 `STICKERNOTE_SERVER_URL` 环境变量预设
- 本地调试可用环境变量覆盖：`STICKERNOTE_SERVER_URL=http://localhost:4000 npm run dev`

### 10.2 手机端打包

打包前**删除 `mobile/.env`**（其中是本地调试地址），否则 APK 默认连 localhost。

**EAS 云打包（推荐）**

```bash
cd mobile
npx eas-cli login
npx eas-cli init
npx eas-cli build -p android --profile preview
```

**安装到手机（数据线）**

```bash
adb install -r path/to/app.apk
```

说明：

- 应用名称「便签」，包名 `com.stickernote.mobile`
- `app.json` 已开启 `usesCleartextTraffic`（因为当前是 HTTP）；改用 HTTPS 后可关闭
- 独立 App 与 Expo Go 数据不共享，首次打开需要重新配对（数据在服务器，不会丢）
- 首次打包会生成签名证书，**请妥善保存 Expo 账号/证书**，后续更新必须使用同一签名

### 10.3 本地 Gradle 打包（Windows，无需 Android Studio）

适用于无法使用 EAS 云打包的情况。整体约需 2GB 磁盘、首次构建 15~20 分钟。

**1）安装工具链（国内镜像）**

```powershell
# JDK 17（清华 Adoptium 镜像）
# https://mirrors.tuna.tsinghua.edu.cn/Adoptium/17/jdk/x64/windows/
# 解压后把目录记为 $JDK

# Android 命令行工具（腾讯镜像）
# https://mirrors.cloud.tencent.com/AndroidSDK/commandlinetools-win-11076708_latest.zip
# 解压到 <SDK>\cmdline-tools\latest

# 用镜像安装 SDK 组件（SDK_TEST_BASE_URL 让 sdkmanager 走腾讯镜像）
$env:SDK_TEST_BASE_URL = 'https://mirrors.cloud.tencent.com/AndroidSDK/'
& "<SDK>\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root="<SDK>" `
  "platforms;android-37.0" "build-tools;37.0.0" "platform-tools" `
  "cmake;3.22.1" "cmake;4.1.2" "ndk;27.1.12297006"
# 接受许可
1..50 | % { 'y' } | & "<SDK>\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root="<SDK>" --licenses
```

**2）替换 Ninja（关键）**

SDK 自带 Ninja 1.10 不支持超过 260 字符的路径，用 CMake 4.1.2 里的新版替换：

```powershell
Copy-Item "<SDK>\cmake\3.22.1\bin\ninja.exe" "<SDK>\cmake\3.22.1\bin\ninja.exe.bak"
Copy-Item "<SDK>\cmake\4.1.2\bin\ninja.exe"    "<SDK>\cmake\3.22.1\bin\ninja.exe"
# 验证应为 1.12+
& "<SDK>\cmake\3.22.1\bin\ninja.exe" --version
```

**3）生成原生工程并打补丁**

```powershell
cd mobile
Remove-Item .env -ErrorAction SilentlyContinue   # 不要带上 localhost 调试地址
npx expo prebuild --platform android --no-install
```

需要修改 `mobile/android` 下这些配置（否则国内构建会卡住或失败）：

| 文件 | 修改 |
|------|------|
| `gradle/wrapper/gradle-wrapper.properties` | `distributionUrl` 改为 `https://mirrors.cloud.tencent.com/gradle/gradle-<版本>-bin.zip` |
| `build.gradle`、`settings.gradle` | 在 `google()/mavenCentral()` 前加阿里云镜像 |
| `gradle.properties` | 增加 `android.builder.sdkDownload=false`（禁止访问 Google 的 SDK 清单） |
| `app/build.gradle` | `defaultConfig` 里加 `externalNativeBuild { cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=240" } }` |
| `local.properties` | `sdk.dir=<SDK 路径>`（注意转义 `C\:\\...`） |
| `app.json` | 已通过 `expo-build-properties` 插件设置 `android.usesCleartextTraffic=true`（HTTP 阶段必须；改用 HTTPS 后可移除） |

仓库里的 `mobile/android/gradle/init-mirrors.gradle` 会给所有子构建注入阿里云镜像，构建时用 `-I` 传入。

**4）在短路径下构建（绕过 Windows 260 字符限制）**

即使启用上述配置，C++ 对象路径仍可能超长。请把项目真实复制到短路径（不要用目录联接，Metro 会因路径根不一致报错）：

```powershell
robocopy "D:\personal\sticker\sticker-note-main\mobile" "C:\sn\mobile" /E /XD ".expo" ".cxx" "build"
robocopy "D:\personal\sticker\sticker-note-main\src"    "C:\sn\src" /E
```

然后构建：

```powershell
$env:JAVA_HOME  = "<JDK 路径>"
$env:ANDROID_HOME = "<SDK 路径>"
cd C:\sn\mobile\android
.\gradlew.bat assembleRelease --no-daemon -I gradle/init-mirrors.gradle
```

产物：`C:\sn\mobile\android\app\build\outputs\apk\release\app-release.apk`

**5）签名与更新**

- 模板默认使用 `android/app/debug.keystore` 给 release 包签名，可直接安装
- **务必备份该 keystore**（已备份到 `mobile/release/debug.keystore`）；以后重打安装包必须用同一签名，否则无法覆盖安装
- APK 本身不要提交到仓库（`*.apk` 已在 `.gitignore` 中）

---

## 11. 多设备 / 多部手机

- **支持多部手机**：每部手机在桌面端各生成一个配对码（每个配对码仅能使用一次、5 分钟有效）
- 所有手机共享同一个同步空间，桌面设置页可查看设备列表并逐个解绑
- 手机之间、手机与电脑之间冲突时按 `updatedAt` **最后写入优先**
- 配对码兑换有限流：每 IP 每分钟 5 次（成功后重置）

---

## 12. 安全加固

### 12.1 数据库专用账号（强烈建议）

```sql
CREATE USER 'stickernote'@'localhost' IDENTIFIED BY '强密码';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX
  ON sticker_note_sync.* TO 'stickernote'@'localhost';
FLUSH PRIVILEGES;
```

然后把 `server/.env` 的 `DB_USER/DB_PASSWORD` 改为该账号，重启服务。

### 12.2 关闭 3306 公网访问

阿里云安全组删除 3306 入方向规则（后端与 MySQL 同机）。

### 12.3 配置 HTTPS（推荐）

```bash
sudo yum install -y nginx
```

```nginx
server {
    listen 443 ssl;
    server_name your.domain.com;
    ssl_certificate     /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

配置后：

1. `server/.env` 设置 `TRUST_PROXY=1`，重启服务
2. 桌面端 / 手机端服务器地址改为 `https://your.domain.com`
3. 手机端重新打包时可关闭 `usesCleartextTraffic`

### 12.4 其他

- token 只存 SHA-256 哈希，明文仅在注册/兑换时返回一次
- 配对码限流、设备可随时解绑
- 定期备份 MySQL（见第 14 节）

---

## 13. 升级与回滚

**升级（推荐）**：重新执行一键部署脚本，会自动覆盖 `dist` 并重启服务。

**手动升级**：

```bash
# 本地
npm run build
tar -czf - dist package.json | ssh root@your-server.com \
  "rm -rf /tmp/upd && mkdir -p /tmp/upd && tar -xzf - -C /tmp/upd"
# 服务器
cd /opt/stickernote-sync
sudo rm -rf dist && sudo mv /tmp/upd/dist ./dist
sudo npm install --omit=dev
sudo node dist/db/migrate.js
sudo systemctl restart stickernote-sync
```

**回滚**：保留上一版 `dist` 备份，替换后重启即可；数据库结构迁移均为向后兼容的增量变更。

---

## 14. 备份与恢复

```bash
# 备份（服务器上）
mysqldump -u root -p sticker_note_sync > /opt/backup/stickernote_$(date +%F).sql

# 恢复
mysql -u root -p sticker_note_sync < stickernote_2026-10-22.sql
```

建议用 cron 每天备份一次，并定期把备份下载到本地。

---

## 15. 常见问题

| 现象 | 原因 / 处理 |
|------|------------|
| 本地 `curl 127.0.0.1:4000/health` 正常，公网不通 | 安全组未放行 4000 |
| `EADDRINUSE: :::4000` | 旧进程未退出：`ss -lntp \| grep 4000` 后 kill |
| 服务启动失败，日志见 `journalctl` | 多为数据库连不上/密码错误，检查 `.env` |
| 配对返回 429 | 触发限流（每 IP 每分钟 5 次），等 1 分钟 |
| 配对码无效/过期 | 配对码 5 分钟有效且只能用一次，重新生成 |
| 手机安装 APK 后连不上 | 确认打包前已删除 `mobile/.env`；确认手机能访问公网 `/health` |
| 手机修改内容电脑端没出现 | 电脑端每 30 秒同步一次，或在设置页点「立即同步」 |
| 极少数记录长时间不同步 | 检查两端系统时间是否准确（协议有 10 分钟重叠窗口） |
| Expo Go 提示版本不兼容 | Expo Go 必须与项目 SDK 一致（当前 SDK 58 → Expo Go 58.x） |

---

## 16. 相关文件

| 文件 | 说明 |
|------|------|
| `server/deploy/deploy-from-local.sh` | 一键部署脚本（Git Bash） |
| `server/deploy/deploy-from-local.ps1` | 一键部署脚本（PowerShell，含 SSH 上传） |
| `server/deploy/package-for-upload.ps1` | 仅本地打包，产物用于控制台上传 |
| `server/deploy/stickernote-sync.service` | systemd 服务模板 |
| `server/Dockerfile` | 容器化部署（可选） |
| `server/src/db/schema.sql` | 表结构 |
| `server/src/db/init.ts` | 建库建表 |
| `server/src/db/migrate.ts` | 结构迁移（组合主键） |
| `docs/SYNC-ARCHITECTURE.md` | 同步协议与架构设计 |

---

*文档结束*
