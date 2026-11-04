/**
 * Independent 待办 reminder ticker (separate from daily 04:00 archive scheduler).
 *
 * Single-process assumption: one setInterval chain per process — same as
 * src/claw/scheduler.ts. Do not run multiple WeBot replicas against one DB
 * without an external lock, or duplicate proactive sends may occur.
 *
 * Reminders write a short row to `messages` for the console timeline but are
 * NEVER injected into DeepSeek chat-memory / model context.
 */

import { insertMessage } from "../auth/messages";
import { nowIso } from "../auth/crypto";
import * as ilink from "../claw/ilink";
import { getClawSession } from "../claw/store";
import { bumpProactiveSent, canSendProactive, getTodosSettings } from "./settings";
import {
  getTodoForUser,
  listCatchupCandidates,
  listDuePendingReminders,
  markReminder,
  type TodoReminderRow,
} from "./store";
import { formatAbsoluteZh } from "./time";
import { TODOS_TIPS_SHORT } from "./tips";

const TICK_MS_DEFAULT = 30_000;

let timer: ReturnType<typeof setInterval> | null = null;
let tickInFlight = false;

export type DeliverResult =
  | { ok: true }
  | { ok: false; reason: string; status?: "skipped_window" | "skipped_quota" | "failed" };

async function deliverReminder(
  reminder: TodoReminderRow,
  opts: { catchup?: boolean } = {},
): Promise<DeliverResult> {
  const todo = getTodoForUser(reminder.userId, reminder.todoId);
  if (!todo || todo.status !== "open") {
    markReminder(reminder.id, {
      status: "failed",
      skipReason: "todo_not_open",
      attempt: reminder.attempt + 1,
      catchupUsed: opts.catchup ? true : reminder.catchupUsed,
    });
    return { ok: false, reason: "todo_not_open", status: "failed" };
  }

  const settings = getTodosSettings(reminder.userId);
  // Module off: leave reminder pending so it can fire after re-enable.
  if (!settings.todosEnabled) {
    return { ok: false, reason: "todos_disabled" };
  }

  const gate = canSendProactive(reminder.userId);
  if (!gate.ok) {
    const status =
      gate.reason === "quota"
        ? "skipped_quota"
        : gate.reason === "no_window" ||
            gate.reason === "no_context" ||
            gate.reason === "no_wechat"
          ? "skipped_window"
          : "failed";
    markReminder(reminder.id, {
      status,
      skipReason: gate.reason,
      attempt: reminder.attempt + 1,
      catchupUsed: opts.catchup ? true : reminder.catchupUsed,
    });
    return { ok: false, reason: gate.reason, status };
  }

  const session = getClawSession(reminder.userId);
  const botToken = session?.botToken;
  if (!botToken) {
    markReminder(reminder.id, {
      status: "skipped_window",
      skipReason: "no_bot_token",
      attempt: reminder.attempt + 1,
      catchupUsed: opts.catchup ? true : reminder.catchupUsed,
    });
    return { ok: false, reason: "no_bot_token", status: "skipped_window" };
  }

  const when = formatAbsoluteZh(
    todo.remindAt || reminder.scheduledAt,
    settings.timezone || "Asia/Shanghai",
  );
  const prefix = opts.catchup ? "补推提醒" : "待办提醒";
  const text = `⏰ ${prefix}：${todo.title}\n时间：${when}\n\n${TODOS_TIPS_SHORT}`;

  const sent = await ilink.sendMessage(
    botToken,
    gate.settings.lastWechatUserId!,
    gate.settings.lastContextToken!,
    text,
  );

  if (!sent) {
    markReminder(reminder.id, {
      status: "failed",
      skipReason: "send_failed",
      attempt: reminder.attempt + 1,
      catchupUsed: opts.catchup ? true : reminder.catchupUsed,
    });
    return { ok: false, reason: "send_failed", status: "failed" };
  }

  const sentAt = nowIso();
  markReminder(reminder.id, {
    status: "sent",
    sentAt,
    skipReason: null,
    attempt: reminder.attempt + 1,
    catchupUsed: opts.catchup ? true : reminder.catchupUsed,
  });
  bumpProactiveSent(reminder.userId);

  // Console timeline only — do NOT push into DeepSeek chat-memory.
  insertMessage({
    userId: reminder.userId,
    wechatUserId: gate.settings.lastWechatUserId,
    role: "assistant",
    content: `[待办提醒] ${todo.title} @ ${when}`,
  });

  return { ok: true };
}

export async function processDueReminders(now = new Date()): Promise<{ processed: number }> {
  const due = listDuePendingReminders(now.toISOString());
  let processed = 0;
  for (const rem of due) {
    await deliverReminder(rem);
    processed += 1;
  }
  return { processed };
}

/**
 * On next user inbound: per todo, catch up at most the most recent skipped reminder
 * (max 1 catch-up per todo). Counts toward heuristic proactive quota. No full queue replay.
 */
export async function processCatchupForUser(userId: string): Promise<{ sent: number }> {
  const candidates = listCatchupCandidates(userId);
  let sent = 0;
  for (const rem of candidates) {
    const gate = canSendProactive(userId);
    if (!gate.ok) break;
    const result = await deliverReminder(rem, { catchup: true });
    if (result.ok) sent += 1;
  }
  return { sent };
}

export function isTodosReminderSchedulerRunning(): boolean {
  return timer !== null;
}

export function startTodosReminderScheduler(options?: {
  intervalMs?: number;
}): { stop: () => void } {
  if (timer) {
    return {
      stop() {
        stopTodosReminderScheduler();
      },
    };
  }
  const intervalMs =
    options?.intervalMs ?? Number(process.env.TODOS_REMINDER_TICK_MS || TICK_MS_DEFAULT);
  const delay = Number.isFinite(intervalMs) && intervalMs >= 5_000 ? intervalMs : TICK_MS_DEFAULT;

  console.log(
    `[Todos] reminder ticker ready (every ${delay}ms). Single-process assumption — do not multi-replica without a lock.`,
  );

  timer = setInterval(() => {
    if (tickInFlight) return;
    tickInFlight = true;
    void processDueReminders()
      .catch((err) => console.error("[Todos] reminder tick failed:", err))
      .finally(() => {
        tickInFlight = false;
      });
  }, delay);

  return {
    stop() {
      stopTodosReminderScheduler();
    },
  };
}

export function stopTodosReminderScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log("[Todos] reminder ticker stopped.");
  }
}
