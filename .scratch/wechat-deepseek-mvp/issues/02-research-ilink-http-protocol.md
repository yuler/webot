Type: research
Status: closed
Blocked by: none

## Question

在剥离 OpenClaw Gateway 的前提下，如何用独立的 Python 脚本实现与 `https://ilinkai.weixin.qq.com` 接口的直接交互？需要明确获取二维码、扫码换取 Token、`getupdates` 长轮询以及携带 `context_token` 调用 `sendmessage` 的最小代码模式。

## Resolution

完成协议逆向与技术规格查验：
1. **基础地址**：`https://ilinkai.weixin.qq.com`
2. **二维码获取与扫码登录**：
   - 获取二维码：`GET /ilink/bot/get_bot_qrcode?bot_type=3`
     返回 `{"qrcode": "...", "qrcode_img_content": "..."}`。
   - 轮询状态：`GET /ilink/bot/get_qrcode_status?qrcode=<qrcode>`（请求头带 `iLink-App-ClientVersion: 1`），状态流转 `wait` -> `scaned` -> `confirmed`。确认后获取 `bot_token`。
3. **消息接收（长轮询）**：
   - 接口：`POST /ilink/bot/getupdates`
   - 请求头：`AuthorizationType: ilink_bot_token`、`Authorization: Bearer <bot_token>`、`X-WECHAT-UIN: <base64(uin)>`。
   - 报文：`{"get_updates_buf": "<cursor>"}`。
   - 响应：返回消息列表 `msgs` 与下一次轮询游标 `get_updates_buf`。每条消息包含 `from_user_id`、`item_list` 及会话回传所需的 `context_token`。
4. **消息发送**：
   - 接口：`POST /ilink/bot/sendmessage`
   - 报文：携带 `msg.to_user_id`、`msg.context_token`（必须回传接收时的 token）及 `msg.item_list`（文本类型 `type: 1`）。
