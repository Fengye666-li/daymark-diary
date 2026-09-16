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

## 构建

只生成原生可执行文件：

```powershell
pnpm tauri build --no-bundle
```

默认输出：

```text
src-tauri/target/release/daymark.exe
```

生成 Windows 安装包：

```powershell
pnpm tauri build --bundles nsis
```

## 分享

- `日迹.exe`：便携版，复制后即可运行。
- `日迹-安装版.exe`：推荐分享给其他 Windows 用户，安装程序内置 WebView2 引导。

## 自动更新

应用通过 GitHub Releases 检查并安装更新，不需要单独服务器。

发布新版本：

1. 同步修改 `package.json`、`src-tauri/Cargo.toml` 和 `src-tauri/tauri.conf.json` 中的版本号。
2. 提交代码并创建对应标签，例如 `v0.3.1`。
3. 推送标签后，GitHub Actions 会自动构建 NSIS 安装包、签名文件、`latest.json` 并发布 Release。

仓库需要配置以下 Actions Secrets：

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

## 数据位置

桌面版数据库位于 Tauri 应用数据目录：

```text
%APPDATA%\com.daymark.diary\daymark.sqlite3
```

每日备份位于：

```text
%APPDATA%\com.daymark.diary\backups
```

浏览器预览模式使用当前浏览器的本地存储，不会写入桌面数据库。

## 网络说明

`src-tauri/.cargo/config.toml` 默认使用 `rsproxy.cn` 作为 Cargo 镜像，
用于在 crates.io 连接不稳定时完成 Rust 构建。其他网络环境可以删除该文件。
