# WeChat ClawBot + DeepSeek 本地极简服务 (Bun & TypeScript)

免去庞大的 OpenClaw Gateway 与桌面客户端依赖，直接基于腾讯官方 **iLink 原生 HTTP 协议**，使用 **Bun + TypeScript** 在本地长轮询微信个人号私聊消息，并直连 **DeepSeek API** 给出智能回复。

本仓库正在演进为多租户 SaaS 骨架：**邮箱魔法验证码登录** + **tenant 工作区**（SQLite + Drizzle）。ClawBot 仍是**进程级单 worker**（会话文件未按 tenant 拆分）。

## 适用前提

- 手机微信已开通腾讯官方内测插件：**`微信 -> 我 -> 设置 -> 插件 -> ClawBot`**（仅跑 ClawBot 时需要）

## 核心特性

- ⚡ **Bun 原生驱动**：纯 TypeScript，启动毫秒级。
- 🗄️ **多租户骨架**：`users` / `tenants` / `memberships`，SQLite + Drizzle ORM。
- ✉️ **邮箱 OTP 登录**：发送 6 位验证码 → 校验 → HttpOnly session cookie；开发环境未配邮件时验证码打印到控制台并写入 `data/otp-dev.log`。
- 🖥️ **最简控制台**：登录后查看账号与工作区，可新建 tenant。
- 📱 **终端 / 网页扫码登录 ClawBot**：终端二维码 + `/clawbot` 页面。
- 🔄 **自动会话恢复**：`.wechat_session.json` 持久化；过期自动再扫码。
- 🧠 **DeepSeek 智能对话**：多轮上下文，`/reset` / `/clear` 重置。

## 快速开始

### 1. 工具环境准备

```bash
mise install
```

### 2. 安装依赖并配置

```bash
bun install
cp .env.example .env
# 编辑 .env：至少可设 SESSION_SECRET；跑 ClawBot 再填 DEEPSEEK_API_KEY
```

### 3. 启动

```bash
# 控制台 + ClawBot 单 worker（默认）
bun run start

# 仅控制台 / 邮箱登录（不启 ClawBot 长轮询）
bun run console
# 等价于 WEBOT_SKIP_BOT=1 bun run start
```

打开：

- 邮箱登录：`http://127.0.0.1:3000/login`
- 控制台：`http://127.0.0.1:3000/console`
- ClawBot 扫码：`http://127.0.0.1:3000/clawbot`

### 4. 开发环境试 OTP

1. 访问 `/login`，输入任意邮箱，点「发送验证码」。
2. 看终端日志：`[mail:dev] OTP for you@example.com: 123456`，或读 `data/otp-dev.log`。
3. 填入验证码登录 → 进入控制台，可见默认「My workspace」。
4. 生产可设 `RESEND_API_KEY` + `MAIL_FROM` 真发信。

### 5. ClawBot 扫码与使用

1. 启动后终端或 `/clawbot` 出码，手机微信 ClawBot 插件扫码确认。
2. 微信给 ClawBot 发消息即可 DeepSeek 回复；`/reset` 清上下文。

## 数据与环境变量

| 变量 | 说明 |
|------|------|
| `SQLITE_PATH` / `DATABASE_URL` | SQLite 文件路径（默认 `./data/webot.sqlite`） |
| `SESSION_SECRET` | OTP/session 哈希胡椒，生产务必更换 |
| `OTP_DEV_SINK` | 开发验证码落盘路径 |
| `RESEND_API_KEY` + `MAIL_FROM` | 可选真发信 |
| `WEBOT_SKIP_BOT=1` | 只跑 Web，不启 ClawBot |
| `DEEPSEEK_API_KEY` | ClawBot 回复用 |

Drizzle schema：`src/db/schema.ts`。可选：`bun run db:generate` 生成 SQL 迁移；进程启动时也会 `ensureSchema()` 建表。

## 说明（第一刀边界）

- **不做**：短信、微信开放平台 OAuth、WebAuthn、按 tenant 多 worker。
- ClawBot 会话仍是进程共享的 `WECHAT_SESSION_FILE`；账号体系与 bot 并存，后续再挂到具体 tenant。
