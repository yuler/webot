# WeBot — ClawBot + DeepSeek + 邮箱登录控制台

Bun + TypeScript 本地/容器服务：微信 **ClawBot**（iLink）长轮询 + DeepSeek 回复；控制台用 **React + TanStack Start/Router/Query**，数据用 **SQLite + Drizzle**。

## 数据模型（MVP）

- `users` + `sessions` + `otp_codes` — 邮箱魔法验证码登录
- `wechat_bindings` — 每人一个绑定码；向 ClawBot 发送绑定码（或 `/bind CODE`）后 `active`；可重置码 / 断开
- `messages` — 绑定后的对话历史，控制台可看

**没有** multi-tenant / 短信 / 微信 OAuth / WebAuthn。

## 快速开始

```bash
mise install   # 可选
bun install
cp .env.example .env

# 终端 1：API（可带 ClawBot；调试控制台用 skip）
bun run console          # WEBOT_SKIP_BOT=1
# 或 bun run start       # API + ClawBot 单 worker

# 终端 2：TanStack Start UI（开发）
bun run web:dev          # http://127.0.0.1:5173  代理 /api → :3000
```

生产可先 `bun run web:build`，再由 Bun API 托管 `.output/public` / `dist/client` 静态资源（同进程 `/api`）。

### 试邮箱 OTP

1. 打开 `/login`，发验证码  
2. 看 API 日志 `[mail:dev] OTP for …` 或 `data/otp-dev.log`  
3. 登录后进 `/console`：复制绑定码 → 微信发给已扫码的 ClawBot

### ClawBot

- 网页：`/clawbot`（或 API 同端口）  
- 手机：微信 → 我 → 设置 → 插件 → ClawBot 扫码  
- 绑定后发消息会写入 `messages`；未绑定会提示发绑定码

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
