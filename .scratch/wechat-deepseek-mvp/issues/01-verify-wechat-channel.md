Type: task
Status: closed
Blocked by: none

## Question

核验目标微信账号是否具备腾讯官方的 ClawBot 插件入口（路径：`微信 -> 我 -> 设置 -> 插件 -> ClawBot`）。这一结果决定后续技术链路是走腾讯官方 iLink HTTP 个人号协议，还是走零门槛的微信公众平台测试号（Sandbox）方案。

## Resolution

用户人工确认（HITL）：手机微信已开通并具备 `ClawBot` 插件。
决定：采用官方 iLink 原生 HTTP 协议直连个人号私聊，无需退回到公众平台测试号（Sandbox）方案。
