<#
.SYNOPSIS
  在本地构建 StickerNote 同步后端，并上传到 ECS 部署。

.DESCRIPTION
  默认：本地 npm install + npm run build，上传 dist/package.json/.env，
        在服务器执行 npm install --omit=dev（服务器需能联网）。
  -Offline：额外在本地安装生产依赖并一起上传（依赖均为纯 JS，可跨平台），
        服务器无需联网即可运行。
  -BuildOnly：只做本地构建，不上传（用于自检）。

  过程中会提示两次 SSH 密码（一次上传、一次远程执行）。
  配置 SSH 免密登录后无需输入。

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\deploy-from-local.ps1

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\deploy-from-local.ps1 -Offline

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\deploy-from-local.ps1 -SshTarget root@1.2.3.4
#>
param(
  [string]$SshTarget   = "root@your-server.com",
  [string]$PublicHost  = "",
  [string]$RemoteDir   = "/opt/stickernote-sync",
  [int]   $Port        = 4000,
  [string]$ServiceUser = "stickernote",
  [string]$NpmRegistry = "https://registry.npmmirror.com",
  [switch]$Offline,
  [switch]$BuildOnly
)

$ErrorActionPreference = "Stop"

if (-not $PublicHost) { $PublicHost = ($SshTarget -split '@')[-1] }
$ServerDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Assert-Command([string]$name, [string]$hint) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "找不到命令 '$name'。$hint"
  }
}

function Invoke-Checked([string]$exe, [string[]]$arguments) {
  & $exe @arguments
  if ($LASTEXITCODE -ne 0) { throw "命令执行失败: $exe $($arguments -join ' ')" }
}

# 优先使用 Windows 自带 bsdtar；若落在 Git 的 GNU tar 上，需要 --force-local 才能处理 D:\ 路径
$tarExe = Join-Path $env:SystemRoot "System32\tar.exe"
$tarPrefix = @()
if (-not (Test-Path $tarExe)) {
  $tarExe = "tar"
  $tarPrefix = @("--force-local")
}

$tarball = $null
$stage = $null

Push-Location $ServerDir
try {
  if (-not $BuildOnly) {
    Assert-Command ssh "请安装 Windows OpenSSH 客户端（设置 → 可选功能 → OpenSSH 客户端）。"
    Assert-Command scp "请安装 Windows OpenSSH 客户端（设置 → 可选功能 → OpenSSH 客户端）。"
    Assert-Command tar "Windows 10/11 自带 tar；若缺失请在 Git Bash 中执行 .sh 版本。"
  }

  Write-Host "==> [1/5] 本地构建" -ForegroundColor Cyan
  Invoke-Checked "npm" @("install", "--no-audit", "--no-fund")
  Invoke-Checked "npm" @("run", "build")

  if (-not (Test-Path ".env")) {
    throw "缺少 server/.env。请先复制 .env.example 为 .env 并填写数据库密码。"
  }

  if ($BuildOnly) {
    Write-Host "[OK] 本地构建完成（未上传）。" -ForegroundColor Green
    return
  }

  Write-Host "==> [2/5] 准备部署包" -ForegroundColor Cyan
  $stage = Join-Path $env:TEMP ("stickernote-stage-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $stage | Out-Null
  Copy-Item -Path "dist" -Destination $stage -Recurse
  Copy-Item -Path "package.json", ".env" -Destination $stage

  if ($Offline) {
    Write-Host "    离线模式：在本地安装生产依赖"
    # 用临时目录 + 同一份 package.json 安装，避免把 devDependencies 带上服务器
    $pkgTemp = Join-Path $stage "pkg"
    New-Item -ItemType Directory -Path $pkgTemp | Out-Null
    Copy-Item -Path "package.json" -Destination $pkgTemp
    Push-Location $pkgTemp
    try {
      Invoke-Checked "npm" @("install", "--omit=dev", "--no-audit", "--no-fund", "--registry=$NpmRegistry")
    } finally {
      Pop-Location
    }
    Move-Item -Path (Join-Path $pkgTemp "node_modules") -Destination (Join-Path $stage "node_modules")
    Remove-Item -Recurse -Force $pkgTemp
  }

  $tarball = Join-Path $env:TEMP "stickernote-sync.tar.gz"
  if (Test-Path $tarball) { Remove-Item -Force $tarball }
  Push-Location $stage
  try {
    Invoke-Checked $tarExe ($tarPrefix + @("-czf", $tarball, "."))
  } finally {
    Pop-Location
  }
  $sizeMb = [math]::Round((Get-Item $tarball).Length / 1MB, 1)
  Write-Host "    部署包: $tarball ($sizeMb MB)"

  Write-Host "==> [3/5] 上传到 $SshTarget （如需密码请在此输入）" -ForegroundColor Cyan
  Invoke-Checked "scp" @($tarball, "${SshTarget}:/tmp/stickernote-sync.tar.gz")

  Write-Host "==> [4/5] 服务器安装、初始化数据库并启动服务（如需密码请再输入一次）" -ForegroundColor Cyan
  $installDeps = if ($Offline) { "" } else { "npm install --omit=dev --no-audit --no-fund --registry=$NpmRegistry" }

  # 单引号 here-string：不做 PowerShell 展开，用占位符替换，避免 bash 变量被误解析
  $template = @'
set -e
if ! command -v node >/dev/null 2>&1; then
  echo "服务器未安装 Node.js，请先安装 Node 20：" >&2
  echo "  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - && yum install -y nodejs" >&2
  exit 1
fi
node -v
NODE_BIN=$(command -v node)

mkdir -p __REMOTE_DIR__
rm -rf __REMOTE_DIR__/dist __REMOTE_DIR__/node_modules
tar -xzf /tmp/stickernote-sync.tar.gz -C __REMOTE_DIR__
rm -f /tmp/stickernote-sync.tar.gz
cd __REMOTE_DIR__
sed -i 's/^DB_HOST=.*/DB_HOST=127.0.0.1/' .env
__INSTALL_DEPS__

node dist/db/init.js
node dist/db/migrate.js

id -u __SERVICE_USER__ >/dev/null 2>&1 || useradd -r -s /sbin/nologin __SERVICE_USER__
chown -R __SERVICE_USER__:__SERVICE_USER__ __REMOTE_DIR__
chmod 600 __REMOTE_DIR__/.env

cat > /etc/systemd/system/stickernote-sync.service <<UNIT
[Unit]
Description=StickerNote Sync Server
After=network.target mysql.service

[Service]
Type=simple
WorkingDirectory=__REMOTE_DIR__
EnvironmentFile=__REMOTE_DIR__/.env
Environment=NODE_ENV=production
ExecStart=$NODE_BIN __REMOTE_DIR__/dist/index.js
Restart=always
RestartSec=5
User=__SERVICE_USER__
Group=__SERVICE_USER__
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable stickernote-sync >/dev/null
systemctl restart stickernote-sync
sleep 2
systemctl --no-pager --lines=5 status stickernote-sync || true
'@

  $remote = $template.Replace("__REMOTE_DIR__", $RemoteDir).
                        Replace("__SERVICE_USER__", $ServiceUser).
                        Replace("__INSTALL_DEPS__", $installDeps).
                        Replace("`r`n", "`n")

  $remote | & ssh $SshTarget "bash -s"
  if ($LASTEXITCODE -ne 0) { throw "服务器部署步骤失败，请查看上方输出。" }

  Write-Host "==> [5/5] 健康检查" -ForegroundColor Cyan
  Start-Sleep -Seconds 1
  $health = ""
  if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
    $health = (& curl.exe -s -m 8 "http://${PublicHost}:${Port}/health")
  } else {
    try {
      $health = (Invoke-WebRequest -Uri "http://${PublicHost}:${Port}/health" -UseBasicParsing -TimeoutSec 8).Content
    } catch {
      $health = ""
    }
  }

  if ($health -match '"ok"\s*:\s*true') {
    Write-Host "[OK] 部署成功：http://${PublicHost}:${Port}" -ForegroundColor Green
    Write-Host ""
    Write-Host "客户端配置："
    Write-Host "  桌面端：设置 → 手机同步 → 服务器地址 http://${PublicHost}:${Port}"
    Write-Host "  手机端：配对页填入同一地址，或用桌面端生成的配对码/二维码"
    Write-Host "  多部手机：每部手机各生成一个配对码（每个只能用一次）"
  } else {
    Write-Warning "健康检查失败。请确认："
    Write-Host "  1. 阿里云安全组已放行 $Port 端口"
    Write-Host "  2. 服务器执行 journalctl -u stickernote-sync -n 50 查看日志"
    exit 1
  }
} finally {
  Pop-Location
  if ($stage -and (Test-Path $stage)) { Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue }
  if ($tarball -and (Test-Path $tarball)) { Remove-Item -Force $tarball -ErrorAction SilentlyContinue }
}
