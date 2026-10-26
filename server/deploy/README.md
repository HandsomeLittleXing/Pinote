# 部署到阿里云 ECS（your-server.com）

> 完整的部署说明（含安全加固、HTTPS、升级回滚、常见问题）见 **[docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md)**。
> 本文件是简版操作记录。

目标：在 ECS 上常驻一个轻量 Node 服务（约 60–100MB 内存），桌面 exe 与手机 App 作为客户端访问它。

- 操作系统：Alibaba Cloud Linux 3（CentOS 系）
- 规格：2 核 / 2 GiB（足够，无需 Docker 也能跑）
- MySQL 已在本机（`127.0.0.1:3306`），库 `sticker_note_sync`

---

## 一、放行端口

阿里云控制台 → 该实例 → **网络与安全组** → 安全组 → 入方向 → 手动添加：

| 端口范围 | 授权对象 | 用途 |
|---------|---------|------|
| 4000/4000 | 0.0.0.0/0 | 同步服务 |

> 想更安全可以只放行你的常用 IP；但手机用移动网络时 IP 会变，个人使用放行 0.0.0.0/0 更省事（接口本身有 Bearer token 保护）。

---

## 二、安装 Node.js 20

SSH 登录 ECS 后：

```bash
# 安装 NodeSource 源（国内可用 npmmirror 的二进制）
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
node -v   # 应输出 v20.x
```

如果 NodeSource 拉取慢，改用：

```bash
curl -fsSL https://npmmirror.com/mirrors/node/v20.18.0/node-v20.18.0-linux-x64.tar.xz -o node.tar.xz
sudo mkdir -p /usr/local/node && sudo tar -xJf node.tar.xz -C /usr/local/node --strip-components=1
sudo ln -sf /usr/local/node/bin/node /usr/bin/node
sudo ln -sf /usr/local/node/bin/npm /usr/bin/npm
```

---

## 三、上传并安装

**方式 A：本地打包后 scp 上传（推荐，ECS 无需装编译工具）**

```bash
# 在你本机执行
cd server
npm install
npm run build            # 生成 dist/
scp -r dist package.json .env ubuntu@your-server.com:/tmp/stickernote-sync/
```

> 注：`.env` 里 `DB_HOST=127.0.0.1`（MySQL 与后端同机）。若 MySQL 实际不在本机，改为对应地址。

ECS 上：

```bash
sudo mkdir -p /opt/stickernote-sync
sudo mv /tmp/stickernote-sync/* /opt/stickernote-sync/
cd /opt/stickernote-sync
sudo npm install --omit=dev
# 建一个专用低权限账号运行服务
sudo useradd -r -s /sbin/nologin stickernote || true
sudo chown -R stickernote:stickernote /opt/stickernote-sync
```

**方式 B：在 ECS 上直接构建**

```bash
sudo mkdir -p /opt/stickernote-sync && cd /opt/stickernote-sync
# 上传整个 server 目录（排除 node_modules）
npm install --registry=https://registry.npmmirror.com
npm run build
npm install --omit=dev
```

---

## 四、初始化数据库

首次部署时执行一次（幂等，可重复跑）：

```bash
cd /opt/stickernote-sync
npx tsx src/db/init.ts    # 需要 devDependencies 里的 tsx
# 或本地已导出 dist 时：
node -e "require('./dist/db/init.js')"
```

> 若 `sticker_note_sync` 库已存在，此步可跳过。

---

## 五、注册为系统服务

```bash
sudo cp deploy/stickernote-sync.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now stickernote-sync
sudo systemctl status stickernote-sync
```

验证：

```bash
curl http://127.0.0.1:4000/health
# 外网（在你本机）
curl http://your-server.com:4000/health
```

---

## 六、可选：加 HTTPS（强烈建议）

目前是明文 HTTP，token 与便签内容在公网可被中间人嗅探。个人使用可选做：

```bash
sudo yum install -y nginx
# 申请免费证书（如 acme.sh / 阿里云免费 SSL）
# nginx 反代到 127.0.0.1:4000
```

nginx 配置示例：

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
    }
}
```

配好后把桌面端与手机端的服务器地址改为 `https://your.domain.com`。

---

## 七、客户端配置

| 客户端 | 配置方式 |
|--------|---------|
| 桌面端 | 设置 → 手机同步 → 服务器地址填 `http://your-server.com:4000`（或 `STICKERNOTE_SERVER_URL`） |
| 手机端 | 配对页「同步服务器地址」填 `http://your-server.com:4000` |

---

## 八、日常运维

```bash
sudo systemctl restart stickernote-sync   # 重启
sudo journalctl -u stickernote-sync -f    # 看日志
```

更新版本：重新上传 `dist/` → `sudo systemctl restart stickernote-sync`。
