/**
 * Dual-layer in-memory rate limiter for WeBot:
 * 1. Short-term burst protection: limit requests per minute (e.g. 10/min)
 * 2. Daily quota: limit requests per day (e.g. 100/day)
 *
 * Configurable via RATE_LIMIT_PER_MINUTE and RATE_LIMIT_PER_DAY.
 * Values <= 0 disable that layer of rate limiting.
 * Invalid / non-finite env values fall back to defaults (same idea as SESSION_SECRET
 * fail-closed elsewhere: refuse bad config by using a known-safe default here).
 *
 * Quota is consumed when a request is *accepted to call AI* (checkLimit returns
 * allowed), not only after a successful model reply — so timeouts/API errors still
 * count. WeChat /reset clears chat memory only; it does not call resetUser here.
 */

export interface RateLimitResult {
  allowed: boolean;
  reason?: "minute" | "day";
  message?: string;
  minuteRemaining?: number;
  dailyRemaining?: number;
}

interface UserLimitBucket {
  timestamps: number[];
  dailyCount: number;
}

/** Parse an env int; empty/invalid → fallback. Values may be <= 0 (disable layer). */
export function parseEnvInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (trimmed === "") return fallback;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : fallback;
}

export function limitsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): { perMinute: number; perDay: number } {
  return {
    perMinute: parseEnvInt(env.RATE_LIMIT_PER_MINUTE, 10),
    perDay: parseEnvInt(env.RATE_LIMIT_PER_DAY, 100),
  };
}

export class RateLimiter {
  private buckets = new Map<string, UserLimitBucket>();

  constructor(
    private limitPerMinute: number = limitsFromEnv().perMinute,
    private limitPerDay: number = limitsFromEnv().perDay,
  ) {}

  public getLimitPerMinute(): number {
    return this.limitPerMinute;
  }

  public getLimitPerDay(): number {
    return this.limitPerDay;
  }

  public setLimits(perMinute: number, perDay: number): void {
    this.limitPerMinute = perMinute;
    this.limitPerDay = perDay;
  }

  /**
   * Check if a request from key (e.g. wechatUserId) is allowed.
   * If allowed, records the request timestamp and increments daily count
   * immediately (before the AI call). Denied checks do not consume quota.
   */
  public checkLimit(key: string, now: number = Date.now()): RateLimitResult {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [], dailyCount: 0 };
      this.buckets.set(key, bucket);
    }

    // 1. Clean up timestamps older than 60 seconds
    const oneMinuteAgo = now - 60_000;
    bucket.timestamps = bucket.timestamps.filter((t) => t > oneMinuteAgo);

    // 2. Check minute burst limit
    if (this.limitPerMinute > 0 && bucket.timestamps.length >= this.limitPerMinute) {
      return {
        allowed: false,
        reason: "minute",
        message: `⚠️ 提问太频繁了，请稍候再试（每分钟限 ${this.limitPerMinute} 次）。`,
        minuteRemaining: 0,
        dailyRemaining: Math.max(0, this.limitPerDay - bucket.dailyCount),
      };
    }

    // 3. Check daily quota
    if (this.limitPerDay > 0 && bucket.dailyCount >= this.limitPerDay) {
      return {
        allowed: false,
        reason: "day",
        message: `⚠️ 今日提问额度（${this.limitPerDay} 次）已达上限，已为您保护算力，每日凌晨 04:00 将自动重置，明天再聊吧~`,
        minuteRemaining: Math.max(0, this.limitPerMinute - bucket.timestamps.length),
        dailyRemaining: 0,
      };
    }

    // Allowed: record request (consumed even if the subsequent AI call fails)
    bucket.timestamps.push(now);
    bucket.dailyCount += 1;

    return {
      allowed: true,
      minuteRemaining:
        this.limitPerMinute > 0
          ? Math.max(0, this.limitPerMinute - bucket.timestamps.length)
          : Infinity,
      dailyRemaining:
        this.limitPerDay > 0
          ? Math.max(0, this.limitPerDay - bucket.dailyCount)
          : Infinity,
    };
  }

  /** Reset daily counters for all users (called by daily scheduled archive). */
  public resetDaily(): void {
    for (const bucket of this.buckets.values()) {
      bucket.dailyCount = 0;
    }
  }

  /**
   * Clear minute + daily buckets for one key (tests / explicit admin wipe).
   * Not used by WeChat `/reset` — that only clears chat memory / soft-deletes DB rows.
   * Daily quota resets at the scheduled archive (default 04:00 Asia/Shanghai).
   */
  public resetUser(key: string): void {
    this.buckets.delete(key);
  }

  /** Reset all buckets (useful for tests or complete reloads). */
  public resetAll(): void {
    this.buckets.clear();
  }

  /** Get current stats for a key without consuming quota. */
  public getStats(
    key: string,
    now: number = Date.now(),
  ): { minuteCount: number; dailyCount: number } {
    const bucket = this.buckets.get(key);
    if (!bucket) return { minuteCount: 0, dailyCount: 0 };
    const oneMinuteAgo = now - 60_000;
    const minuteCount = bucket.timestamps.filter((t) => t > oneMinuteAgo).length;
    return { minuteCount, dailyCount: bucket.dailyCount };
  }
}

export const rateLimiter = new RateLimiter();
