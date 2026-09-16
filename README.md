# 日迹

一款本地优先的 Windows 日记应用，使用 Tauri 2、React 19 和 SQLite 构建。
正文和设置都保存在本机，不需要登录，也不依赖云服务。

## 功能

- 日历日期浏览与按日期写日记
- 收藏和回收站
- 所见即所得富文本编辑、格式工具栏、快捷键和实时自动保存
- 三栏独立收缩、拖拽调宽和布局重置
- SQLite FTS5 全文搜索
- 浅色/深色主题
- 浏览器预览与本机桌面数据仓库自动切换
- 可构建为原生 Windows `.exe`
- SQLite WAL 强同步和每日本地备份

## 开发

前置环境：

- Node.js 20+
- pnpm 11+
- Rust stable MSVC
- Visual Studio C++ Build Tools
- Microsoft Edge WebView2

安装依赖：

```powershell
pnpm install
```

浏览器预览：

```powershell
pnpm dev
```

桌面应用开发模式：

```powershell
pnpm tauri:dev
```
