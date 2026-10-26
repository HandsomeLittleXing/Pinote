#!/usr/bin/env bash
# ============================================================
# 从本机一键部署 StickerNote 同步后端到 ECS
#
# 使用前提：
#   1. 本机已安装 ssh / scp（Windows 可用 Git Bash）
#   2. 阿里云安全组已放行 4000 端口
#   3. 首次执行前，server/.env 已填好数据库密码
#
# 执行：
#   cd server/deploy
#   bash deploy-from-local.sh
#
# 脚本会提示输入 SSH 密码（如已配置免密登录则不会提示）。
# ============================================================
set -euo pipefail

# ---------- 可修改参数 ----------
SSH_TARGET="${SSH_TARGET:-root@your-server.com}"
PUBLIC_HOST="${PUBLIC_HOST:-${SSH_TARGET#*@}}"
REMOTE_DIR="${REMOTE_DIR:-/opt/stickernote-sync}"
REMOTE_STAGE="/tmp/stickernote-sync-stage"
SERVICE_USER="${SERVICE_USER:-stickernote}"
PORT="${PORT:-4000}"
# 国内服务器可加速依赖安装；留空则用默认源
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"
# -------------------------------

SERVER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SERVER_DIR"

echo "==> [1/6] 构建后端"
npm install --no-audit --no-fund
npm run build

if [ ! -f .env ]; then
  echo "!! 缺少 server/.env，请先复制 .env.example 并填写数据库密码" >&2
  exit 1
fi

echo "==> [2/6] 上传构建产物到 $SSH_TARGET:$REMOTE_STAGE"
tar -czf - dist package.json .env | ssh "$SSH_TARGET" "rm -rf $REMOTE_STAGE && mkdir -p $REMOTE_STAGE && tar -xzf - -C $REMOTE_STAGE"

echo "==> [3/6] 安装依赖并安装到 $REMOTE_DIR"
ssh "$SSH_TARGET" "bash -s" <<REMOTE
set -e
# 校验 Node 版本
if ! command -v node >/dev/null 2>&1; then
  echo "远程服务器未安装 Node.js，请先安装 Node 20：" >&2
  echo "  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - && yum install -y nodejs" >&2
  exit 1
fi
node -v

mkdir -p $REMOTE_DIR
rm -rf $REMOTE_DIR/dist
mv $REMOTE_STAGE/dist $REMOTE_DIR/dist
mv $REMOTE_STAGE/package.json $REMOTE_DIR/package.json
mv $REMOTE_STAGE/.env $REMOTE_DIR/.env
rm -rf $REMOTE_STAGE

cd $REMOTE_DIR
# 生产部署时 MySQL 与后端同机
sed -i 's/^DB_HOST=.*/DB_HOST=127.0.0.1/' .env
npm install --omit=dev --no-audit --no-fund --registry=$NPM_REGISTRY

# 初始化数据库（幂等）并执行结构迁移（幂等）
node dist/db/init.js
node dist/db/migrate.js

id -u $SERVICE_USER >/dev/null 2>&1 || useradd -r -s /sbin/nologin $SERVICE_USER
chown -R $SERVICE_USER:$SERVICE_USER $REMOTE_DIR
chmod 600 $REMOTE_DIR/.env
REMOTE

echo "==> [4/6] 安装 systemd 服务"
NODE_BIN=$(ssh "$SSH_TARGET" "command -v node") || true
if [ -z "$NODE_BIN" ]; then
  echo "!! 未能探测到远程 node 路径" >&2
  exit 1
fi
echo "    使用 node: $NODE_BIN"
ssh "$SSH_TARGET" "bash -s" <<REMOTE
set -e
cat > /etc/systemd/system/stickernote-sync.service <<'UNIT'
[Unit]
Description=StickerNote Sync Server
After=network.target mysql.service

[Service]
Type=simple
WorkingDirectory=$REMOTE_DIR
EnvironmentFile=$REMOTE_DIR/.env
Environment=NODE_ENV=production
ExecStart=$NODE_BIN $REMOTE_DIR/dist/index.js
Restart=always
RestartSec=5
User=$SERVICE_USER
Group=$SERVICE_USER
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
sed -i "s|\$REMOTE_DIR|$REMOTE_DIR|g" /etc/systemd/system/stickernote-sync.service
systemctl daemon-reload
systemctl enable stickernote-sync >/dev/null
systemctl restart stickernote-sync
sleep 2
systemctl --no-pager --lines=5 status stickernote-sync || true
REMOTE

echo "==> [5/6] 本地健康检查"
sleep 1
if curl -s -m 8 "http://${PUBLIC_HOST}:${PORT}/health" | grep -q '"ok":true'; then
  echo "✅ 部署成功：http://${PUBLIC_HOST}:${PORT}"
else
  echo "⚠️  健康检查失败。请确认：" >&2
  echo "   1. 阿里云安全组已放行 ${PORT} 端口" >&2
  echo "   2. 远程执行 journalctl -u stickernote-sync -n 50 查看日志" >&2
  exit 1
fi

echo "==> [6/6] 完成"
echo
echo "客户端配置："
echo "  桌面端：设置 → 手机同步 → 服务器地址 http://${PUBLIC_HOST}:${PORT}"
echo "  手机端：配对页填入同一地址，或用桌面设置页的配对码/二维码"
echo
echo "多部手机：在桌面端每部手机各生成一个配对码（每个码只能用一次）。"
