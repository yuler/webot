import { describe, expect, test, beforeEach } from "bun:test";
import {
  RateLimiter,
  rateLimiter,
  parseEnvInt,
  limitsFromEnv,
} from "../src/claw/rate-limit";

describe("Dual-layer RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter(3, 5); // 3 per minute, 5 per day for testing
    rateLimiter.resetAll();
  });

  test("allows requests within both limits", () => {
    const res1 = limiter.checkLimit("u1", 1000);
    expect(res1.allowed).toBe(true);
    expect(res1.minuteRemaining).toBe(2);
    expect(res1.dailyRemaining).toBe(4);

    const res2 = limiter.checkLimit("u1", 2000);
    expect(res2.allowed).toBe(true);
    expect(res2.minuteRemaining).toBe(1);
    expect(res2.dailyRemaining).toBe(3);

    const res3 = limiter.checkLimit("u1", 3000);
    expect(res3.allowed).toBe(true);
    expect(res3.minuteRemaining).toBe(0);
    expect(res3.dailyRemaining).toBe(2);
  });

  test("blocks requests exceeding minute burst limit", () => {
    limiter.checkLimit("u1", 1000);
    limiter.checkLimit("u1", 2000);
    limiter.checkLimit("u1", 3000);

    const blocked = limiter.checkLimit("u1", 4000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe("minute");
    expect(blocked.message).toContain("每分钟限 3 次");
  });

  test("allows requests again once 1 minute has elapsed (sliding window)", () => {
    limiter.checkLimit("u1", 1000);
    limiter.checkLimit("u1", 2000);
    limiter.checkLimit("u1", 3000);

    // Blocked within 60s
    expect(limiter.checkLimit("u1", 4000).allowed).toBe(false);

    // 60.001 seconds later, first timestamp expires
    const allowedAfterWindow = limiter.checkLimit("u1", 61001);
    expect(allowedAfterWindow.allowed).toBe(true);
  });

  test("blocks requests exceeding daily quota", () => {
    // 5 per day limit
    // Make 3 requests at minute 0
    limiter.checkLimit("u1", 1000);
    limiter.checkLimit("u1", 2000);
    limiter.checkLimit("u1", 3000);

    // Make 2 requests at minute 2 (minute window cleared)
    limiter.checkLimit("u1", 120_000);
    limiter.checkLimit("u1", 121_000);

    // Now dailyCount is 5
    const blockedDay = limiter.checkLimit("u1", 122_000);
    expect(blockedDay.allowed).toBe(false);
    expect(blockedDay.reason).toBe("day");
    expect(blockedDay.message).toContain("今日提问额度（5 次）已达上限");
  });

  test("resetDaily clears dailyCount for all users", () => {
    limiter.checkLimit("u1", 1000);
    limiter.checkLimit("u1", 2000);
    limiter.checkLimit("u1", 3000);
    limiter.checkLimit("u1", 120_000);
    limiter.checkLimit("u1", 121_000);

    expect(limiter.checkLimit("u1", 122_000).allowed).toBe(false);

    limiter.resetDaily();

    // Now daily quota is reset, minute window is clear
    const retry = limiter.checkLimit("u1", 123_000);
    expect(retry.allowed).toBe(true);
  });

  test("isolates limits between different users", () => {
    limiter.checkLimit("u1", 1000);
    limiter.checkLimit("u1", 2000);
    limiter.checkLimit("u1", 3000);
    expect(limiter.checkLimit("u1", 4000).allowed).toBe(false);

    // u2 should still be allowed
    const u2Result = limiter.checkLimit("u2", 4000);
    expect(u2Result.allowed).toBe(true);
    expect(u2Result.minuteRemaining).toBe(2);
  });

  test("resetUser clears specific user data", () => {
    limiter.checkLimit("u1", 1000);
    limiter.checkLimit("u1", 2000);
    limiter.checkLimit("u1", 3000);
    expect(limiter.checkLimit("u1", 4000).allowed).toBe(false);

    limiter.resetUser("u1");
    expect(limiter.checkLimit("u1", 4000).allowed).toBe(true);
  });

  test("denied checks do not consume daily quota", () => {
    const tight = new RateLimiter(1, 2);
    expect(tight.checkLimit("u", 1000).allowed).toBe(true);
    // minute blocked — should not bump daily further
    expect(tight.checkLimit("u", 2000).allowed).toBe(false);
    expect(tight.getStats("u", 2000).dailyCount).toBe(1);
  });
});

describe("Rate limit env parsing", () => {
  test("parseEnvInt falls back on empty / invalid / non-finite", () => {
    expect(parseEnvInt(undefined, 10)).toBe(10);
    expect(parseEnvInt("", 10)).toBe(10);
    expect(parseEnvInt("  ", 10)).toBe(10);
    expect(parseEnvInt("abc", 10)).toBe(10);
    expect(parseEnvInt("NaN", 10)).toBe(10);
    expect(parseEnvInt("12.5", 10)).toBe(12.5);
    expect(parseEnvInt("0", 10)).toBe(0);
    expect(parseEnvInt("-1", 10)).toBe(-1);
  });

  test("limitsFromEnv uses defaults for missing or invalid values", () => {
    expect(limitsFromEnv({} as NodeJS.ProcessEnv)).toEqual({ perMinute: 10, perDay: 100 });
    expect(
      limitsFromEnv({
        RATE_LIMIT_PER_MINUTE: "abc",
        RATE_LIMIT_PER_DAY: "nope",
      } as NodeJS.ProcessEnv),
    ).toEqual({ perMinute: 10, perDay: 100 });
    expect(
      limitsFromEnv({
        RATE_LIMIT_PER_MINUTE: "7",
        RATE_LIMIT_PER_DAY: "42",
      } as NodeJS.ProcessEnv),
    ).toEqual({ perMinute: 7, perDay: 42 });
  });
});
