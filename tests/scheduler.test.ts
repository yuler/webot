import { describe, expect, test, afterEach } from "bun:test";
import {
  msUntilNextTarget,
  runDailyArchive,
  startDailyArchiveScheduler,
  stopDailyArchiveScheduler,
  isSchedulerRunning,
  parseArchiveHour,
  parseArchiveMinute,
} from "../src/claw/scheduler";
import { rateLimiter } from "../src/claw/rate-limit";
import { onChatMemoryResetAll } from "../src/chat-memory";

describe("Daily Archive Scheduler", () => {
  afterEach(() => {
    stopDailyArchiveScheduler();
  });

  test("msUntilNextTarget calculates milliseconds for target later today", () => {
    const from = new Date("2026-10-27T02:00:00.000Z");
    // target is 04:00 today
    // Note: msUntilNextTarget uses local time on targetHour
    const targetHour = (from.getHours() + 2) % 24;
    const ms = msUntilNextTarget(targetHour, 0, from);
    expect(ms).toBe(2 * 3600 * 1000);
  });

  test("msUntilNextTarget schedules for tomorrow if target has passed today", () => {
    const from = new Date("2026-10-27T10:00:00.000Z");
    // target was 08:00 today (2 hours ago)
    const targetHour = (from.getHours() - 2 + 24) % 24;
    const ms = msUntilNextTarget(targetHour, 0, from);
    // Should be 22 hours from now
    expect(ms).toBe(22 * 3600 * 1000);
  });

  test("runDailyArchive resets memory and rate limits", () => {
    let memoryResetCalled = false;
    const unregister = onChatMemoryResetAll(() => {
      memoryResetCalled = true;
    });

    // Populate rate limiter with some usage
    rateLimiter.setLimits(10, 10);
    rateLimiter.checkLimit("test_user_schedule");
    expect(rateLimiter.getStats("test_user_schedule").dailyCount).toBe(1);

    const result = runDailyArchive();

    expect(result.chatMemoryReset).toBe(true);
    expect(result.rateLimitsReset).toBe(true);
    expect(memoryResetCalled).toBe(true);
    expect(rateLimiter.getStats("test_user_schedule").dailyCount).toBe(0);

    unregister();
  });

  test("startDailyArchiveScheduler can start and stop", () => {
    expect(isSchedulerRunning()).toBe(false);

    const scheduler = startDailyArchiveScheduler({
      targetHour: 4,
      targetMinute: 0,
    });
    expect(isSchedulerRunning()).toBe(true);

    scheduler.stop();
    expect(isSchedulerRunning()).toBe(false);
  });

  test("parseArchiveHour/Minute fall back on invalid values", () => {
    expect(parseArchiveHour(undefined)).toBe(4);
    expect(parseArchiveHour("abc")).toBe(4);
    expect(parseArchiveHour("24")).toBe(4);
    expect(parseArchiveHour("-1")).toBe(4);
    expect(parseArchiveHour("7")).toBe(7);
    expect(parseArchiveMinute(undefined)).toBe(0);
    expect(parseArchiveMinute("xyz")).toBe(0);
    expect(parseArchiveMinute("60")).toBe(0);
    expect(parseArchiveMinute("15")).toBe(15);
  });
});
