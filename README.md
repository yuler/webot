# WeChat ClawBot + DeepSeek 本地极简服务 (MVP)

免去庞大的 OpenClaw Gateway 与桌面客户端依赖，直接基于腾讯官方 **iLink 原生 HTTP 协议**，在本地单脚本长轮询微信个人号私聊消息，并直连 **DeepSeek API** 给出智能回复。

## 适用前提

- 手机微信已开通腾讯官方内测插件：**`微信 -> 我 -> 设置 -> 插件 -> ClawBot`**

## 核心特性

- ⚡ **零网关架构**：单文件 `run_bot.py`，无需庞大的 OpenClaw 运行时或桌面 Companion。
- 📱 **终端扫码登录**：终端直接以 ASCII 字符渲染二维码，并同步保存 `qrcode.png`，手机微信扫码即连。
- 🔄 **自动会话恢复**：扫码凭证本地持久化（`.wechat_session.json`），重启免重复扫码；凭证过期自动再调起扫码。
- 🧠 **DeepSeek 智能对话**：支持多轮对话上下文（默认最近 6 轮滑动窗口），发送 `/reset` 或 `/clear` 即可快速重置。
- 🛡️ **优雅降级**：非文本消息自动友好回复；微信长轮询超时与消息排重防重试保护。

## 快速开始

### 1. 配置 API Key

复制模板并填入你的 DeepSeek API Key：

```bash
cp .env.example .env
# 编辑 .env 填入你的 DEEPSEEK_API_KEY
```

或者直接导出环境变量：

```bash
export DEEPSEEK_API_KEY="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
```

### 2. 一键启动

推荐使用 `uv` 运行（免手动安装依赖）：

```bash
uv run run_bot.py
```

或者使用系统 Python：

```bash
pip install httpx qrcode pillow
python run_bot.py
```

### 3. 扫码与使用

1. 终端打印二维码后，使用手机微信扫描屏幕上的二维码并点击确认。
2. 在微信中给 ClawBot 发送消息，即可体验 DeepSeek 的实时智能回复！
3. 发送 `/reset` 或 `/clear` 可以随时清空历史上下文。
