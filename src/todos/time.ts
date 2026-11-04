/**
 * Lightweight Asia/Shanghai-oriented time helpers for single-shot 待办 reminders.
 * Confirm absolute time in replies so users can correct ambiguity.
 */

const TZ = "Asia/Shanghai";

/** Format an Instant in Asia/Shanghai for user-facing confirmation. */
export function formatAbsoluteZh(isoOrDate: string | Date, timeZone = TZ): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return String(isoOrDate);
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** Wall-clock parts in a timezone (via formatToParts). */
function zonedParts(date: Date, timeZone = TZ) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") === 24 ? 0 : get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Build an Instant that is Y-M-D H:M:S in Asia/Shanghai. */
export function shanghaiWallToIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
): string {
  // Iterate: guess UTC then correct using zoned parts (handles DST-less CST = UTC+8).
  let utc = Date.UTC(year, month - 1, day, hour - 8, minute, second);
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(new Date(utc));
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const want = Date.UTC(year, month - 1, day, hour, minute, second);
    utc += want - asUtc;
  }
  return new Date(utc).toISOString();
}

function todayShanghai(from = new Date()) {
  return zonedParts(from);
}

function addDaysShanghai(
  base: { year: number; month: number; day: number },
  days: number,
): { year: number; month: number; day: number } {
  // noon UTC proxy to avoid edge issues
  const mid = new Date(Date.UTC(base.year, base.month - 1, base.day, 12));
  mid.setUTCDate(mid.getUTCDate() + days);
  return { year: mid.getUTCFullYear(), month: mid.getUTCMonth() + 1, day: mid.getUTCDate() };
}

/**
 * Parse common Chinese / relative remind phrases into an ISO instant.
 * Returns null if no time found (caller may create todo without reminder).
 */
export function parseRemindAt(text: string, now = new Date(), timeZone = TZ): string | null {
  const raw = text.trim();
  if (!raw) return null;

  // X分钟后 / X小时后
  const relMin = raw.match(/(\d+)\s*分钟后/);
  if (relMin) {
    return new Date(now.getTime() + Number(relMin[1]) * 60_000).toISOString();
  }
  const relHour = raw.match(/(\d+)\s*小时后/);
  if (relHour) {
    return new Date(now.getTime() + Number(relHour[1]) * 3_600_000).toISOString();
  }

  const hm =
    raw.match(/(?:(\d{1,2})\s*[：:]\s*(\d{2}))/) ||
    raw.match(/(\d{1,2})\s*点\s*(\d{1,2})?/);
  let hour: number | null = null;
  let minute = 0;
  if (hm) {
    hour = Number(hm[1]);
    minute = hm[2] != null && hm[2] !== "" ? Number(hm[2]) : 0;
    if (raw.includes("下午") || raw.includes("晚上") || raw.includes("傍晚")) {
      if (hour < 12) hour += 12;
    }
    if (raw.includes("中午") && hour < 11) hour = 12;
    if (hour === 24) hour = 0;
  }

  const today = todayShanghai(now);
  let y = today.year;
  let m = today.month;
  let d = today.day;

  if (/后天/.test(raw)) {
    ({ year: y, month: m, day: d } = addDaysShanghai(today, 2));
  } else if (/明天|明日/.test(raw)) {
    ({ year: y, month: m, day: d } = addDaysShanghai(today, 1));
  } else if (/今天|今日/.test(raw)) {
    // keep today
  } else {
    const ymd = raw.match(/(\d{4})[-\/.年](\d{1,2})[-\/.月](\d{1,2})/);
    const md = raw.match(/(\d{1,2})[-\/.月](\d{1,2})/);
    if (ymd) {
      y = Number(ymd[1]);
      m = Number(ymd[2]);
      d = Number(ymd[3]);
    } else if (md) {
      m = Number(md[1]);
      d = Number(md[2]);
    } else if (hour == null) {
      return null;
    }
  }

  if (hour == null) {
    // date only → 09:00 default
    hour = 9;
    minute = 0;
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  let iso = shanghaiWallToIso(y, m, d, hour, minute, 0);
  // If "今天" (or bare time) already passed, roll to tomorrow
  if (!/后天|明天|明日|\d{4}[-\/.年]|\d{1,2}[-\/.月]/.test(raw) && new Date(iso).getTime() <= now.getTime()) {
    const next = addDaysShanghai({ year: y, month: m, day: d }, 1);
    iso = shanghaiWallToIso(next.year, next.month, next.day, hour, minute, 0);
  }
  return iso;
}

/** Strip time-ish phrases to leave a title candidate. */
export function stripTimePhrases(text: string): string {
  return text
    .replace(/^(请)?(帮我)?(提醒我|记得|待办|todo)\s*/i, "")
    .replace(/(后天|明天|明日|今天|今日)/g, " ")
    .replace(/(\d+)\s*分钟后/g, " ")
    .replace(/(\d+)\s*小时后/g, " ")
    .replace(/(\d{4})[-\/.年](\d{1,2})[-\/.月](\d{1,2})日?/g, " ")
    .replace(/(\d{1,2})[-\/.月](\d{1,2})日?/g, " ")
    .replace(/(\d{1,2})\s*[：:]\s*(\d{2})/g, " ")
    .replace(/(\d{1,2})\s*点\s*(\d{1,2})?分?/g, " ")
    .replace(/(上午|下午|晚上|傍晚|中午)/g, " ")
    .replace(/提醒我|叫我|记得/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
