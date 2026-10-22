Type: prototype
Status: closed
Blocked by: 01, 02, 03, 04

## Question

基于选定的通道方案（01/02 或 03）及会话策略（04），实现一个独立的、零外部重型依赖的启动脚本（如 `run_bot.py`），配置 `DEEPSEEK_API_KEY`，实现扫码并跑通微信端问答端到端闭环。

## Resolution

已交付纯本地运行的独立脚本及配套文件：
1. **启动脚本**：`run_bot.py`（基于 PEP 723 声明依赖，支持 `uv run run_bot.py` 一键启动）。
2. **认证通道**：打通 Tencent iLink 原生 HTTP 协议扫码登录与长轮询（`getupdates` / `sendmessage`），终端输出 ASCII 二维码并自动导出 `qrcode.png`。
3. **会话持久化**：本地缓存凭证至 `.wechat_session.json`，重启免重复扫码，凭证失效自动重新调起二维码。
4. **模型对接与会话**：内置 DeepSeek API（默认 `deepseek-chat`），多轮滑动窗口会话管理，支持 `/reset` 与 `/clear` 重置会话。
5. **配套文档与配置**：提供 `.env.example`、`.gitignore` 与 `README.md`。
