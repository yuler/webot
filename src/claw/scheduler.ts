/**
 * In-process daily archive scheduler for WeBot.
 * Automatically runs daily at 04:00 AM (local time) to:
 * 1. Reset all in-memory chat histories (preventing context token blow-up across days).
 * 2. Reset daily rate limit quotas.
 * 3. Log execution summary without affecting SQLite database message history.
 */

import { resetAllChatMemory } from "../chat-memory";
import { rateLimiter } from "./rate-limit";

export interface ArchiveResult {
  executedAt: string;
  chatMemoryReset: boolean;
  rateLimitsReset: boolean;
}

/**
 * Calculates milliseconds from `fromDate` until the next occurrence of targetHour:targetMinute.
 */
export function msUntilNextTarget(
  targetHour = 4,
  targetMinute = 0,
  fromDate = new Date(),
): number {
  const next = new Date(fromDate);
  next.setHours(targetHour, targetMinute, 0, 0);

  // If the target time today has already passed, schedule for tomorrow
  if (next.getTime() <= fromDate.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return next.getTime() - fromDate.getTime();
}

/**
 * Execute the daily archive tasks immediately.
 */
export function runDailyArchive(): ArchiveResult {
  const executedAt = new Date().toISOString();
  console.log(`[Scheduler] ⏳ 开始执行每日自动归档与上下文重置 (${executedAt})...`);

  // 1. Reset in-memory chat histories across all users
  resetAllChatMemory();

  // 2. Reset daily rate limit counters
  rateLimiter.resetDaily();

  const result: ArchiveResult = {
    executedAt,
    chatMemoryReset: true,
    rateLimitsReset: true,
  };

  console.log(`[Scheduler] ✅ 每日自动归档已完成: 活跃对话上下文已重置，每日提问额度已清零。`);
  return result;
}

let schedulerTimer: ReturnType<typeof setTimeout> | null = null;

export function isSchedulerRunning(): boolean {
  return schedulerTimer !== null;
}

/**
 * Starts the in-process daily scheduler.
 */
export function startDailyArchiveScheduler(options?: {
  targetHour?: number;
  targetMinute?: number;
  onArchive?: (res: ArchiveResult) => void;
}): { stop: () => void } {
  // If already running, return controller
  if (schedulerTimer) {
    return {
      stop() {
        stopDailyArchiveScheduler();
      },
    };
  }

  const targetHour =
    options?.targetHour ??
    (process.env.ARCHIVE_HOUR ? Number(process.env.ARCHIVE_HOUR) : 4);
  const targetMinute =
    options?.targetMinute ??
    (process.env.ARCHIVE_MINUTE ? Number(process.env.ARCHIVE_MINUTE) : 0);

  function scheduleNext() {
    const ms = msUntilNextTarget(targetHour, targetMinute);
    const hours = (ms / 3_600_000).toFixed(2);
    console.log(
      `[Scheduler] 每日自动归档任务已就绪：将在 ${hours} 小时后（${String(targetHour).padStart(2, "0")}:${String(targetMinute).padStart(2, "0")}）自动执行。`,
    );

    schedulerTimer = setTimeout(() => {
      try {
        const res = runDailyArchive();
        options?.onArchive?.(res);
      } catch (err) {
        console.error("[Scheduler] 每日自动归档执行异常:", err);
      } finally {
        scheduleNext();
      }
    }, ms);
  }

  scheduleNext();

  return {
    stop() {
      stopDailyArchiveScheduler();
    },
  };
}

export function stopDailyArchiveScheduler(): void {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
    console.log("[Scheduler] 每日自动归档定时任务已停止。");
  }
}
