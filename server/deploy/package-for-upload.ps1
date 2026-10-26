<#
.SYNOPSIS
  本地打包 StickerNote 同步后端，生成可直接上传到服务器的压缩包。

.DESCRIPTION
  产物：server/deploy/stickernote-sync-deploy.tar.gz
  内含：dist/、package.json、.env

  -Offline：额外把生产依赖 node_modules 一起打包（依赖均为纯 JS，可跨平台），
            服务器无需联网执行 npm install。

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\package-for-upload.ps1

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\package-for-upload.ps1 -Offline
#>
param(
  [string]$NpmRegistry = "https://registry.npmmirror.com",
  [string]$OutFile = "",
  [switch]$Offline
)

$ErrorActionPreference = "Stop"

$ServerDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $OutFile) { $OutFile = Join-Path $PSScriptRoot "stickernote-sync-deploy.tar.gz" }

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

$stage = $null
Push-Location $ServerDir
try {
  Write-Host "==> [1/3] 本地构建" -ForegroundColor Cyan
  Invoke-Checked "npm" @("install", "--no-audit", "--no-fund")
  Invoke-Checked "npm" @("run", "build")

  if (-not (Test-Path ".env")) {
    throw "缺少 server/.env。请先复制 .env.example 为 .env 并填写数据库密码。"
  }

  Write-Host "==> [2/3] 准备打包内容" -ForegroundColor Cyan
  $stage = Join-Path $env:TEMP ("stickernote-pkg-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $stage | Out-Null
  Copy-Item -Path "dist" -Destination $stage -Recurse
  Copy-Item -Path "package.json", ".env" -Destination $stage

  if ($Offline) {
    Write-Host "    离线模式：安装生产依赖并一起打包"
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

  Write-Host "==> [3/3] 生成压缩包" -ForegroundColor Cyan
  if (Test-Path $OutFile) { Remove-Item -Force $OutFile }
  Push-Location $stage
  try {
    Invoke-Checked $tarExe ($tarPrefix + @("-czf", $OutFile, "."))
  } finally {
    Pop-Location
  }

  $sizeMb = [math]::Round((Get-Item $OutFile).Length / 1MB, 1)
  Write-Host ""
  Write-Host "[OK] 打包完成: $OutFile ($sizeMb MB)" -ForegroundColor Green
  Write-Host ""
  Write-Host "接下来（阿里云控制台 -> 远程连接/Workbench）："
  Write-Host "  1. 上传该文件到服务器，例如 /root/"
  Write-Host "  2. 执行部署命令（见 docs/DEPLOYMENT.md 第 5.3 节）"
  if (-not $Offline) {
    Write-Host ""
    Write-Host "  提示：服务器需要能联网安装依赖；若不能联网，请加 -Offline 重新打包。" -ForegroundColor Yellow
  }
} finally {
  Pop-Location
  if ($stage -and (Test-Path $stage)) { Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue }
}
