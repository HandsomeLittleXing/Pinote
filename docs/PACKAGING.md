# 打包指南（Windows 与 Android）

本文只说明桌面安装包和 Android APK 的构建。同步服务器的部署见 [DEPLOYMENT.md](./DEPLOYMENT.md)。以下命令在仓库根目录的 PowerShell 中执行，除非小节另有说明。

## 1. 打包前检查

- Windows 10/11 x64、Node.js、npm。首次拉取代码后，在根目录和 `mobile` 目录分别运行一次 `npm ci`。
- Android 本地构建需要完整的 JDK 17（含 `jlink.exe`）及 Android SDK。当前工程使用 Android platform 37.0、build-tools 37.0.0、NDK 27.1.12297006、CMake 3.22.1。
- 检查 `mobile/.env`：正式 APK 不能带 `localhost` 调试服务器地址。本机当前没有该文件；如需预设服务器，应使用手机能访问的地址。
- 桌面安装包版本来自根目录 `package.json`；Android 的 `version` 与 `android.versionCode` 来自 `mobile/app.json`。发布更新前核对版本号，Android 更新需递增 `versionCode`。

当前版本为桌面 `1.2.0`、Android `1.2.2`（`versionCode=5`）。`mobile/android` 是 Expo 生成且被 Git 忽略的原生工程；改动 `app.json` 的原生配置或升级原生依赖后，应重新运行 `expo prebuild`，并重新检查本地原生构建补丁。普通 JS/样式改动不需要重新生成原生工程。

## 2. Windows 安装包

常规构建：

```powershell
npm ci                 # 已安装依赖且 lockfile 未变时可跳过
npm run typecheck
npm run build
```

`npm run build` 依次执行 `electron-vite build` 和 `electron-builder`。产物在 `release/`；按当前 `electron-builder.yml`，新生成的 NSIS 文件名为 `贴记-Setup-1.2.0.exe`。目录中可能还留有旧名称的安装包，应以修改时间和当前配置核对。

若此机打包时遇到 GitHub 下载失败或 `winCodeSign` 解压符号链接权限错误，可使用项目内已有缓存：

```powershell
$repo = (Resolve-Path .).Path
$env:ELECTRON_CACHE = "$repo\.cache\electron"
$env:ELECTRON_BUILDER_CACHE = "$repo\.cache\electron-builder"
npx electron-vite build
npx electron-builder --dir --config.win.signAndEditExecutable=false
$rcedit = Get-ChildItem "$env:ELECTRON_BUILDER_CACHE\winCodeSign" -Filter rcedit-x64.exe -Recurse -File | Select-Object -First 1 -ExpandProperty FullName
if (-not $rcedit) { throw '本地缓存中缺少 rcedit-x64.exe，无法写入应用图标' }
& $rcedit 'release\win-unpacked\Pinote.exe' --set-icon 'resources\icon.ico' --set-version-string ProductName Pinote --set-version-string CompanyName handsomelittlexing
if ($LASTEXITCODE -ne 0) { throw '写入应用图标失败' }
npx electron-builder --prepackaged 'release\win-unpacked' --config.win.signAndEditExecutable=false
```

这段是**本机回退命令**，要求两个 `.cache` 目录已存在，且 `winCodeSign` 缓存中含 `rcedit-x64.exe`。先离线生成未压缩应用，再补写 exe 图标和产品信息，最后从已处理的应用目录生成 NSIS 安装包。不能直接运行 `npx electron-builder --config.win.signAndEditExecutable=false` 作为最终安装包，否则 exe 保留 Electron 默认图标，桌面快捷方式和任务栏也会显示旧图标。正式分发应在具备正常打包权限和代码签名证书的环境中重新构建。当前配置 `forceCodeSigning: false`，安装包不是代码签名发行版。

## 3. Android APK

### 本机已验证命令

此仓库当前已有 `mobile/android`、项目内 SDK、Gradle 缓存和镜像配置。Windows 原生 C++ 构建对路径长度敏感，因此本机采用 `subst` 短盘符。确认 `X:`、`H:`、`S:` 没有映射到别的目录后执行：

```powershell
$repo = (Resolve-Path .).Path
subst X: $repo
subst H: "$repo\.cache\gradle-ms17"
subst S: "$repo\.cache\android-sdk"

$env:JAVA_HOME = 'C:\Users\11548\.jdks\ms-17.0.21.0.2'
$env:ANDROID_HOME = 'S:\'
$env:ANDROID_SDK_ROOT = 'S:\'
$env:GRADLE_USER_HOME = 'H:\'

Set-Location 'X:\mobile\android'
.\gradlew.bat :app:assembleRelease `
  -x :app:generateAutolinkingNewArchitectureFiles `
  -PreactNativeArchitectures=arm64-v8a `
  --no-daemon --no-watch-fs --max-workers=2 --console=plain `
  --project-cache-dir 'X:\.cache\android-project-gradle-ms17' `
  -I 'X:\.cache\android-setup\mirrors.init.gradle'
```

成功标志为 `BUILD SUCCESSFUL`；产物是 `mobile/android/app/build/outputs/apk/release/app-release.apk`。`arm64-v8a` 适用于当前常见的 64 位 Android 手机。需要其他架构时，调整 `-PreactNativeArchitectures` 并重新构建。

`-x :app:generateAutolinkingNewArchitectureFiles` 只适用于**当前已生成并校正短路径的原生工程**。若重新执行 `expo prebuild`、重装/升级原生依赖，或更换项目目录，不能照搬此参数；应重新生成自动链接文件，并在短路径下检查 CMake 输出路径。当前 `mobile/android/app/build.gradle` 还将 CMake 暂存目录设为 `X:/.cache/native`，所以构建时必须保持 `X:` 映射。新的电脑上先按 [DEPLOYMENT.md 的本地 Gradle 部分](./DEPLOYMENT.md#103-本地-gradle-打包windows无需-android-studio)准备 SDK 和原生工程，再处理路径与镜像。

### 新电脑的常规起点

```powershell
npm ci
Set-Location mobile
npm ci
npx expo prebuild --platform android --no-install
Set-Location android
.\gradlew.bat :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
```

此路径要求 Android SDK、JDK 17、网络依赖仓库均可用，且项目位于足够短的真实目录。它不会自动复现本机 `.cache` 镜像、短盘符和 CMake 补丁；Windows 出现 260 字符限制或镜像下载失败时，先按上述本机方案的原理配置，再重新打包。不要从旧机器直接复制 `.cache` 当作可移植 SDK 安装方案。

### EAS 云构建

不具备本地 Android 工具链时，可使用仓库现有的 `mobile/eas.json`：

```powershell
Set-Location mobile
npx eas-cli login
npx eas-cli init                     # 首次关联 Expo 项目时运行
npx eas-cli build -p android --profile preview
```

`preview` 输出 APK；`production` 输出适合应用商店上传的 AAB。EAS 管理的签名与本地 `debug.keystore` 签名不同，不能假定两者可直接覆盖安装。

## 4. 校验与安装

下面的校验在 APK 构建成功后执行；使用英文路径可避免部分 Android SDK 工具读取中文路径失败：

```powershell
$repo = (Resolve-Path 'X:\').Path
$apk = "$repo\mobile\android\app\build\outputs\apk\release\app-release.apk"
& 'S:\build-tools\37.0.0\apksigner.bat' verify $apk
& 'S:\build-tools\37.0.0\aapt.exe' dump badging $apk | Select-String 'package:'
Get-FileHash $apk -Algorithm SHA256
```

若此时已离开 `X:` 目录，也可直接把 `$repo` 指向仓库真实路径。校验应显示包名 `com.stickernote.mobile` 和预期版本。复制到 `release/` 时建议使用英文 APK 文件名，例如 `Android-1.2.2.apk`。

手机已授权 USB 调试且 `adb devices` 显示 `device` 时，可以选择安装：

```powershell
& 'S:\platform-tools\adb.exe' devices -l
& 'S:\platform-tools\adb.exe' install -r $apk
```

不要为了处理签名冲突直接卸载旧 App：卸载可能清除手机里的本地便签。当前生成的本地 release APK 使用 `mobile/android/app/debug.keystore` 签名，适合本机测试；它与 EAS 或正式证书签出的包通常不能互相覆盖。正式发布需要单独配置、备份发行签名，并在更新时沿用同一证书。EAS 的 `preview` 配置输出 APK，`production` 配置输出 AAB，详见 `mobile/eas.json`。

## 5. 常见失败

| 现象 | 检查点 |
| --- | --- |
| `jlink.exe does not exist` | `JAVA_HOME` 指向完整 JDK 17，不是精简 JBR/JRE |
| Ninja 路径超过 260 字符 | 确认 `X:`、`H:`、`S:` 映射及当前原生工程的 CMake 暂存目录；新工程应放到短真实路径 |
| 自动链接报 `different roots` | Gradle、Node 自动链接路径混用了真实盘符和 `X:`；当前工程的短路径修正失效，需重新生成并校正原生文件 |
| Gradle 缓存锁超时 | 先确认没有仍在运行的 Gradle 构建；不要在运行中删除锁文件。必要时换独立缓存目录 |
| 安装时报签名不兼容 | 核对旧 App 与新 APK 的签名；先备份数据，不直接卸载 |
| `adb devices` 为空 | 检查数据线、手机解锁、USB 调试授权及驱动；不影响 APK 本身的构建 |
