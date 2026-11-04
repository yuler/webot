/**
 * Shared 「待办」Tips copy. Phrase window/quota as heuristic — there is no exact iLink quota API.
 */

export const TODOS_TIPS_SHORT =
  "⏰ 提醒依赖 iLink/ClawBot（启发式估算，非精确官方额度）：约 24 小时内你主动聊过才能推送主动提醒；窗口内约 10 条主动消息。超窗或用尽请先发一句任意消息后再试。";

export const TODOS_TIPS_CONSOLE =
  "待办提醒依赖微信 ClawBot / iLink 的主动推送能力。以下为启发式说明（非精确官方 API）：约 24 小时互动窗口内才能主动提醒；窗口内约 10 条主动消息额度。超窗或额度用尽时，请先在微信里发一句任意消息，再等待补推。";

export const TODOS_TIPS_SYSTEM =
  "【待办模块 Tips】主动提醒受 iLink/ClawBot 限制（启发式，非精确额度 API）：用户约 24h 内需有主动互动才能推送；窗口内约 10 条主动消息。超窗需用户先发一句。创建带提醒时务必回显绝对时间，并附上简短 Tips。";

export const PROACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const PROACTIVE_QUOTA_HEURISTIC = 10;
