# 📌 StickerNote — 电脑便签

> 轻量级桌面便签应用，开机自启、贴边吸附、自动保存。

<p align="center">
  <img src="https://img.shields.io/badge/Windows-10%2F11-blue?logo=windows" />
  <img src="https://img.shields.io/badge/Electron-28-47848F?logo=electron" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react" />
  <img src="https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript" />
  <img src="https://img.shields.io/badge/License-MIT-green" />
</p>

---

## ✨ 功能特性

| 功能 | 说明 |
|:---:|------|
| 🚀 开机自启动 | 注册表写入，开机自动显示便签 |
| 📎 贴边吸附 | 拖到屏幕边缘自动吸附，不挡桌面 |
| ✏️ 富文本编辑 | 加粗、斜体、字号、字体颜色、待办清单 |
| 🎨 8 种预设颜色 | 黄 / 绿 / 粉 / 蓝 / 紫 / 橙 / 白 / 灰 |
| 🔍 透明度调节 | 20% ~ 100% 自由调节 |
| 📌 置顶显示 | 便签始终在最上层 |
| ⏰ 定时提醒 | 快捷提醒（30分钟 / 1小时 / 明天） |
| 🏷️ 标签管理 | 自定义标签 + 按标签筛选 |
| ⌨️ 全局快捷键 | `Ctrl+Alt+N` 新建 · `Ctrl+Alt+S` 列表 |
| 💾 数据导入导出 | JSON 格式备份 / 恢复 |
| 🌙 深色模式 | 跟随系统 / 浅色 / 深色 |
| 🔕 系统托盘 | 关闭窗口不退出，双击托盘新建 |

## 📸 截图

<!-- TODO: 添加截图 -->

## 🛠️ 技术栈

- **前端**: React 18 + TypeScript + Tailwind CSS
- **富文本**: Tiptap 编辑器
- **桌面**: Electron 28
- **构建**: Vite + electron-builder
- **数据**: electron-store (JSON)

## 📦 安装

### 下载安装包

👉 [**Releases 页面下载最新版本**](https://github.com/KDY2003/sticker-note/releases)

- 安装路径：`C:\Program Files\StickerNote\`
- 系统要求：Windows 10/11 x64

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/KDY2003/sticker-note.git
cd sticker-note

# 安装依赖
npm install

# 开发模式
npm run dev

# 构建安装包
npm run build
```

## 📂 项目结构

```
sticker-note/
├── src/
│   ├── main/              # Electron 主进程
│   │   ├── index.ts       # 入口
│   │   ├── windows.ts     # 窗口管理 + 贴边吸附
│   │   ├── store.ts       # 数据存储
│   │   ├── tray.ts        # 系统托盘
│   │   ├── shortcuts.ts   # 全局快捷键
│   │   ├── reminders.ts   # 提醒调度
│   │   └── ipc-handlers.ts # IPC 通信
│   ├── preload/           # 预加载脚本
│   ├── renderer/          # React 渲染进程
│   │   ├── components/    # UI 组件
│   │   ├── hooks/         # 自定义 Hooks
│   │   └── utils/         # 工具函数
│   └── shared/            # 共享类型定义
├── resources/             # 图标资源
├── electron-builder.yml   # 打包配置
├── vite.config.ts         # Vite 配置
└── package.json
```

## 📝 开发备忘

- **贴边吸附**: 窗口 move 事件 + 100ms 防抖，松手后检测 25px 阈值
- **开机自启动**: PowerShell 写注册表 `HKCU\...\Run`
- **数据存储**: electron-store，JSON 文件在 `%APPDATA%/sticker-note/`

## 📄 License

[MIT](LICENSE)

---

<p align="center">
  如果觉得有用，点个 ⭐ 支持一下！
</p>
