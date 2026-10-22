## Destination

构建一个免 OpenClaw 运行时、纯本地跑的极简 WeChat + DeepSeek 交互 MVP 服务：支持本地生成二维码扫码连通微信，并在微信中发送消息时直连 DeepSeek API 获取回复。

## Notes

- Domain: WeChat Personal Bot (iLink) / WeChat Sandbox, DeepSeek API, Local Python Service
- Effort: wechat-deepseek-mvp
- Reference doc: [explore/00--openclaw-weixin.md](file:///home/yule/brain/explore/00--openclaw-weixin.md)
- Rules: 遵循 [AGENTS.md](file:///home/yule/brain/AGENTS.md) 极简设计，避免过度工程化

## Decisions so far

- [01-verify-wechat-channel.md](file:///home/yule/Projects/webot/.scratch/wechat-deepseek-mvp/issues/01-verify-wechat-channel.md): 用户已开通腾讯官方 ClawBot 插件，确认走官方 iLink 原生 HTTP 个人号私聊协议。
- [02-research-ilink-http-protocol.md](file:///home/yule/Projects/webot/.scratch/wechat-deepseek-mvp/issues/02-research-ilink-http-protocol.md): 查清 iLink 扫码认证（`get_bot_qrcode`）、长轮询（`getupdates`）与消息回发（`sendmessage`）接口规范及 Header/Payload 格式。
- [03-research-sandbox-fallback.md](file:///home/yule/Projects/webot/.scratch/wechat-deepseek-mvp/issues/03-research-sandbox-fallback.md): 公众号测试号备选路线已归档（因已具备 ClawBot 资格）。
- [04-conversation-strategy.md](file:///home/yule/Projects/webot/.scratch/wechat-deepseek-mvp/issues/04-conversation-strategy.md): 确定终端 ASCII + PNG 二维码输出，内存维护 6 轮滑动窗口上下文，支持 `/reset` 重置。
- [05-prototype-runnable-mvp.md](file:///home/yule/Projects/webot/.scratch/wechat-deepseek-mvp/issues/05-prototype-runnable-mvp.md): 交付独立启动脚本 `run_bot.py`，打通 iLink 扫码轮询与 DeepSeek 问答闭环。

## Not yet specified

- **流式分段体验**：DeepSeek 思考时间较长时，微信消息通道的打字态 (`sendtyping`) 与分段响应表现
- **非文本消息能力拓展**：支持图片识别等进阶多模态能力

## Out of scope

- 安装部署 OpenClaw Gateway 全套服务与 Companion 桌面客户端
- 多 IM 渠道扩展（Telegram、Discord、Slack 等）
- 生产级多租户隔离、账号配额与计费系统
