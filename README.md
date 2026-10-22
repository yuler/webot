# WeChat ClawBot + DeepSeek 本地极简服务 (Bun & TypeScript)

免去庞大的 OpenClaw Gateway 与桌面客户端依赖，直接基于腾讯官方 **iLink 原生 HTTP 协议**，使用 **Bun + TypeScript** 在本地长轮询微信个人号私聊消息，并直连 **DeepSeek API** 给出智能回复。

## 适用前提

- 手机微信已开通腾讯官方内测插件：**`微信 -> 我 -> 设置 -> 插件 -> ClawBot`**

## 核心特性

- ⚡ **Bun 原生驱动**：纯 TypeScript 编写，基于 Bun 高性能运行时，启动毫秒级。
- 🛠️ **Mise 环境管理**：通过 [`.mise.toml`](file:///home/yule/Projects/webot/.mise.toml) 统一锁定 `bun` 和 `gum` 开发工具。
- 💅 **炫彩 CLI 体验**：整合 `gum` 终端渲染工具，打印高颜值终端横幅与状态。
- 📱 **终端扫码登录**：终端直接渲染二维码，并同步保存 `qrcode.png`，手机微信扫码即连。
- 🔄 **自动会话恢复**：扫码凭证本地持久化（`.wechat_session.json`），重启免重复扫码；凭证过期自动再调起扫码。
- 🧠 **DeepSeek 智能对话**：支持多轮对话上下文（默认最近 6 轮滑动窗口），发送 `/reset` 或 `/clear` 即可快速重置。
- 🛡️ **优雅降级**：非文本消息自动友好回复；微信长轮询超时与消息排重防重试保护。

## 快速开始

### 1. 工具环境准备

本项目使用 `mise` 统一管理运行时：

```bash
mise install
```

这将自动安装并配置项目所需的 `bun` 与 `gum`。

### 2. 安装依赖并配置 API Key

```bash
bun install

cp .env.example .env
# 编辑 .env 填入你的 DEEPSEEK_API_KEY
```

或者直接导出环境变量：

```bash
export DEEPSEEK_API_KEY="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
```

### 3. 一键启动

```bash
bun run start
# 或直接执行脚本
bun run_bot.ts
```

### 4. 扫码与使用

1. 终端打印二维码后，使用手机微信扫描屏幕上的二维码并点击确认。
2. 在微信中给 ClawBot 发送消息，即可体验 DeepSeek 的实时智能回复！
3. 发送 `/reset` 或 `/clear` 可以随时清空历史上下文。
