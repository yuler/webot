Type: grilling
Status: closed
Blocked by: none

## Question

用户在微信侧交互时，MVP 阶段是否需要多轮上下文记忆（保持会话历史窗口）？二维码展示形态偏好在终端通过 ASCII 直接打印，还是在本地开启简易 HTTP 静态服务通过浏览器展示？

## Resolution

按照极简 MVP 原则达成以下策略：
1. **二维码展示**：终端内直接以 UTF-8/ASCII 块字符打印二维码，同时在工作目录下保存一份 `qrcode.png`，兼顾无头服务器与桌面终端扫码便利性。
2. **上下文策略**：内存维护每个 `from_user_id` 的滑动窗口（默认最近 6 轮对话），支持输入 `/clear` 或 `/reset` 重置当前会话历史。
3. **消息类型处理**：优先解析 `item_list` 中的文本消息（`type: 1`），遇到非文本消息（图片、语音等）优雅降级回复友好提示。
