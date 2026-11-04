import { describe, expect, test } from "bun:test";
import type { Todo } from "../src/lib/api";
import {
  bucketForDay,
  calendarDay,
  groupTodosByDate,
  todoGroupKey,
} from "../src/lib/todo-groups";

function todo(partial: Partial<Todo> & Pick<Todo, "id" | "title">): Todo {
  return {
    userId: "u1",
    notes: null,
    dueAt: null,
    remindAt: null,
    status: "open",
    completedAt: null,
    source: "console",
    createdAt: "2026-11-04T00:00:00.000Z",
    updatedAt: "2026-11-04T00:00:00.000Z",
    deletedAt: null,
    ...partial,
  };
}

describe("todo-groups", () => {
  const tz = "Asia/Shanghai";
  // 2026-11-05 10:00 CST
  const now = new Date("2026-11-05T02:00:00.000Z");

  test("calendarDay in Asia/Shanghai", () => {
    expect(calendarDay("2026-11-05T01:30:00.000Z", tz)).toBe("2026-11-05");
  });

  test("todoGroupKey prefers dueAt", () => {
    expect(
      todoGroupKey({
        dueAt: "2026-11-06T01:00:00.000Z",
        remindAt: "2026-11-05T01:00:00.000Z",
      }),
    ).toBe("2026-11-06T01:00:00.000Z");
    expect(todoGroupKey({ dueAt: null, remindAt: "2026-11-05T01:00:00.000Z" })).toBe(
      "2026-11-05T01:00:00.000Z",
    );
    expect(todoGroupKey({ dueAt: null, remindAt: null })).toBeNull();
  });

  test("bucketForDay maps relative to today", () => {
    expect(bucketForDay(null, "2026-11-05")).toBe("none");
    expect(bucketForDay("2026-11-04", "2026-11-05")).toBe("overdue");
    expect(bucketForDay("2026-11-05", "2026-11-05")).toBe("today");
    expect(bucketForDay("2026-11-06", "2026-11-05")).toBe("tomorrow");
    expect(bucketForDay("2026-11-10", "2026-11-05")).toBe("later");
  });

  test("groupTodosByDate buckets + hides empty + sorts", () => {
    const items = [
      todo({ id: "later", title: "later", remindAt: "2026-11-10T01:00:00.000Z" }),
      todo({ id: "today-b", title: "today-b", remindAt: "2026-11-05T08:00:00.000Z" }),
      todo({ id: "today-a", title: "today-a", remindAt: "2026-11-05T01:00:00.000Z" }),
      todo({ id: "overdue", title: "overdue", dueAt: "2026-11-04T01:00:00.000Z" }),
      todo({ id: "none", title: "none" }),
      todo({
        id: "tmr-due",
        title: "tmr-due",
        dueAt: "2026-11-06T01:00:00.000Z",
        remindAt: "2026-11-05T01:00:00.000Z",
      }),
    ];
    const buckets = groupTodosByDate(items, { timeZone: tz, now });
    expect(buckets.map((b) => b.id)).toEqual([
      "overdue",
      "today",
      "tomorrow",
      "later",
      "none",
    ]);
    expect(buckets.find((b) => b.id === "today")!.items.map((t) => t.id)).toEqual([
      "today-a",
      "today-b",
    ]);
    expect(buckets.find((b) => b.id === "tomorrow")!.items.map((t) => t.id)).toEqual([
      "tmr-due",
    ]);
  });
});
