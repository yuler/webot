# WeBot — ClawBot + AI + 邮箱登录控制台

Bun + TypeScript 本地/容器服务：微信 **ClawBot**（iLink）长轮询 + 大模型（AI）回复；控制台用 **React + TanStack Start/Router/Query**，数据用 **SQLite + Drizzle**。大模型底座兼容任意 OpenAI 格式接口（DeepSeek、Qwen、Kimi、OpenAI 等）。

**生产：** [https://webot.yuler.dev/](https://webot.yuler.dev/)

**界面：** 见根目录 [`DESIGN.md`](./DESIGN.md)（自 k41 黑白直角方案）。

## 数据模型（MVP）

- `users` + `sessions` + `otp_codes` — 邮箱魔法链接登录（OTP 备选）
- `wechat_bindings` — 每人一个绑定码；向 ClawBot 发送绑定码（或 `/bind CODE`）后 `active`；可重置码 / 断开
- `messages` — 绑定后的对话历史，控制台可看；清空 / 微信 `/reset` 为软删除（`deleted_at`）
- `claw_bot_sessions` — 每用户独立 ClawBot 凭据（`bot_token` / QR / getupdates）

**没有** 短信 / 微信 OAuth / WebAuthn。

## 快速开始

```bash
mise install   # 可选
bun install
cp .env.example .env

# 终端 1：API（可带 ClawBot；调试控制台用 skip）
bun run console          # WEBOT_SKIP_BOT=1
# 或 bun run start       # API + per-user ClawBot workers

# 终端 2：TanStack Start UI（开发）
bun run web:dev          # http://127.0.0.1:5173  代理 /api → :3000
```

生产可先 `bun run web:build`（产出 `.output/` Nitro artifacts），再由 Bun API 同进程托管 UI + `/api`（见 Dockerfile）。

### 试邮箱登录（魔法链接为主）

1. 打开 `/login`，发送登录链接  
2. 本地未配 SMTP/Resend 时看 API 日志 `[mail:dev] magic link for …`，或 `data/otp-dev.log`  
3. 点魔法链接 → `/console`（可选：用邮件里的 6 位验证码）  
4. 登录控制台扫码上线 ClawBot，并复制绑定码发给微信  

生产：`bun run web:build` 后 `bun run start` 会用 Nitro `standard` 构建的 `{ fetch }` 托管 TanStack Start UI（与 `/api` 同端口）。

### 发信（与 moge 同邮箱 / Dokploy）

WeBot 优先走 **SMTP**，环境变量名与 moge 一致，便于在 Dokploy 上从 moge 应用复制：

| 变量 | 说明 |
|------|------|
| `SMTP_ADDRESS` | SMTP 主机（如 `smtp.mxhichina.com`） |
| `SMTP_PORT` | 默认 `465` |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | 邮箱账号与授权码 |
| `SMTP_DOMAIN` | 可选 EHLO 域名 |
| `SMTP_SSL_ENABLED` | `true`/`false`；465 默认开 TLS |
| `EMAIL_SENDER` | From 地址（也可用 `MAIL_FROM`） |
| `PUBLIC_ORIGIN` | 邮件里魔法链接的公网站点根 URL（仅发信用） |
| `APP_ORIGIN` | 可选；SSR/服务端请求本机 `/api` 的内网地址，默认 `http://127.0.0.1:$PORT`。Dokploy HTTPS 下务必不要用 `PUBLIC_ORIGIN` 做 SSR |

未配 `SMTP_*` 时可选用 `RESEND_API_KEY` + `MAIL_FROM`；两者都没有则写 `[mail:dev]` 日志。**不要把真实密码提交进 git。**

### ClawBot（每用户独立）

- 扫码在控制台 `/console`：每位登录用户各自申请二维码、各自存 `bot_token`、各自长轮询  
- 手机：微信 → 我 → 设置 → 插件 → ClawBot 扫码（一个微信号同时只能独占一个 Bot）  
- 绑定后发消息会写入 `messages`；未绑定会提示发绑定码；控制台或微信 `/reset` 软删除历史  
- **防套问系统提示词**：默认固化「WeBot 智能助手」身份并注入抗越狱防御，禁止透露底层技术与底座模型名称，支持通过 `SYSTEM_PROMPT` 环境变量自定义  
- **双层提问限流**：支持短期防突发（默认 10 次/分钟，`RATE_LIMIT_PER_MINUTE`）与每日额度上限（默认 100 次/天，`RATE_LIMIT_PER_DAY`），保护 Token 算力  
- **每日定时归档**：内置进程调度器每日凌晨 04:00 自动重置活跃上下文记忆（防跨天长会话 Token 膨胀）并清零每日限流配额，Web 控制台历史消息保持可见  

> **迁移（#11）：** 若你曾用过早期「全局共享」ClawBot，请在控制台重新扫码上线，并视为已轮换 `bot_token`（旧全局会话不再有效）。

## 测试

```bash
bun test
# 或 bun run test
```

覆盖：OTP 登录、绑定码重置、消息落库与 `/api/messages`。

## 脚本

| 命令 | 说明 |
|------|------|
| `bun run start` | API + ClawBot |
| `bun run console` | 仅 API |
| `bun run web:dev` | TanStack Start 开发服 |
| `bun run web:build` | 构建前端 |
| `bun test` | MVP 自动化测试 |
