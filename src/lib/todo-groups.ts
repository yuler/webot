/**
 * Pure date-bucket helpers for console 待办 grouping (Google Tasks–style).
 * Group key = dueAt ?? remindAt. Calendar days use the user's todos timezone.
 */

import type { Todo } from "@/lib/api";

export type TodoBucketId = "overdue" | "today" | "tomorrow" | "later" | "none";

export type TodoBucket = {
  id: TodoBucketId;
  label: string;
  items: Todo[];
};

const BUCKET_ORDER: TodoBucketId[] = ["overdue", "today", "tomorrow", "later", "none"];

const BUCKET_LABEL: Record<TodoBucketId, string> = {
  overdue: "过期",
  today: "今天",
  tomorrow: "明天",
  later: "更晚",
  none: "无日期",
};

const DEFAULT_TZ = "Asia/Shanghai";

/** YYYY-MM-DD in `timeZone` for an Instant. */
export function calendarDay(isoOrDate: string | Date, timeZone = DEFAULT_TZ): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const mid = new Date(Date.UTC(y, m - 1, d, 12));
  mid.setUTCDate(mid.getUTCDate() + days);
  const yy = mid.getUTCFullYear();
  const mm = String(mid.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(mid.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Prefer dueAt when set; else remindAt. */
export function todoGroupKey(todo: Pick<Todo, "dueAt" | "remindAt">): string | null {
  return todo.dueAt || todo.remindAt || null;
}

export function bucketForDay(
  ymd: string | null,
  todayYmd: string,
): TodoBucketId {
  if (!ymd) return "none";
  if (ymd < todayYmd) return "overdue";
  if (ymd === todayYmd) return "today";
  if (ymd === addDaysYmd(todayYmd, 1)) return "tomorrow";
  return "later";
}

function sortKeyMs(todo: Todo): number {
  const key = todoGroupKey(todo);
  if (key) {
    const t = new Date(key).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const updated = new Date(todo.updatedAt).getTime();
  if (!Number.isNaN(updated)) return updated;
  const created = new Date(todo.createdAt).getTime();
  return Number.isNaN(created) ? 0 : created;
}

/**
 * Group open todos into 过期 / 今天 / 明天 / 更晚 / 无日期.
 * Empty buckets are omitted. Within a bucket: group key ascending.
 */
export function groupTodosByDate(
  todos: Todo[],
  opts: { timeZone?: string; now?: Date } = {},
): TodoBucket[] {
  const timeZone = opts.timeZone || DEFAULT_TZ;
  const now = opts.now ?? new Date();
  const todayYmd = calendarDay(now, timeZone);

  const buckets: Record<TodoBucketId, Todo[]> = {
    overdue: [],
    today: [],
    tomorrow: [],
    later: [],
    none: [],
  };

  for (const todo of todos) {
    const key = todoGroupKey(todo);
    const ymd = key ? calendarDay(key, timeZone) : null;
    buckets[bucketForDay(ymd || null, todayYmd)].push(todo);
  }

  for (const id of BUCKET_ORDER) {
    buckets[id].sort((a, b) => sortKeyMs(a) - sortKeyMs(b));
  }

  return BUCKET_ORDER.filter((id) => buckets[id].length > 0).map((id) => ({
    id,
    label: BUCKET_LABEL[id],
    items: buckets[id],
  }));
}

/** Compact zh-CN time for a secondary line. */
export function formatTodoWhen(iso: string, timeZone = DEFAULT_TZ): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}
