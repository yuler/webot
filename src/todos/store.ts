import { and, asc, desc, eq, isNull, lte, or } from "drizzle-orm";
import { db, schema } from "../db";
import { newId, nowIso } from "../auth/crypto";

export type TodoRow = typeof schema.todos.$inferSelect;
export type TodoReminderRow = typeof schema.todoReminders.$inferSelect;

export type TodoStatus = "open" | "done" | "cancelled";
export type TodoSource = "wechat" | "console" | "api";
export type ReminderStatus =
  | "pending"
  | "sent"
  | "skipped_window"
  | "skipped_quota"
  | "failed";

export function listTodos(
  userId: string,
  opts: { status?: TodoStatus | "all"; limit?: number; includeDeleted?: boolean } = {},
): TodoRow[] {
  const limit = Math.min(opts.limit ?? 100, 500);
  const clauses = [eq(schema.todos.userId, userId)];
  if (!opts.includeDeleted) clauses.push(isNull(schema.todos.deletedAt));
  if (opts.status && opts.status !== "all") {
    clauses.push(eq(schema.todos.status, opts.status));
  }
  return db
    .select()
    .from(schema.todos)
    .where(and(...clauses))
    .orderBy(asc(schema.todos.status), desc(schema.todos.createdAt))
    .limit(limit)
    .all();
}

export function getTodoForUser(userId: string, todoId: string): TodoRow | null {
  return (
    db
      .select()
      .from(schema.todos)
      .where(
        and(
          eq(schema.todos.id, todoId),
          eq(schema.todos.userId, userId),
          isNull(schema.todos.deletedAt),
        ),
      )
      .get() ?? null
  );
}

export function createTodo(input: {
  userId: string;
  title: string;
  notes?: string | null;
  dueAt?: string | null;
  remindAt?: string | null;
  source?: TodoSource;
}): { todo: TodoRow; reminder: TodoReminderRow | null } {
  const now = nowIso();
  const todo: TodoRow = {
    id: newId(),
    userId: input.userId,
    title: input.title.trim(),
    notes: input.notes?.trim() || null,
    dueAt: input.dueAt ?? null,
    remindAt: input.remindAt ?? null,
    status: "open",
    completedAt: null,
    source: input.source ?? "api",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  db.insert(schema.todos).values(todo).run();

  let reminder: TodoReminderRow | null = null;
  if (todo.remindAt) {
    reminder = {
      id: newId(),
      todoId: todo.id,
      userId: todo.userId,
      scheduledAt: todo.remindAt,
      sentAt: null,
      status: "pending",
      skipReason: null,
      attempt: 0,
      catchupUsed: false,
      createdAt: now,
      updatedAt: now,
    };
    db.insert(schema.todoReminders).values(reminder).run();
  }
  return { todo, reminder };
}

export function updateTodo(
  userId: string,
  todoId: string,
  patch: Partial<{
    title: string;
    notes: string | null;
    dueAt: string | null;
    remindAt: string | null;
    status: TodoStatus;
  }>,
): TodoRow | null {
  const existing = getTodoForUser(userId, todoId);
  if (!existing) return null;
  const now = nowIso();
  const next: Record<string, unknown> = { updatedAt: now };
  if (patch.title !== undefined) next.title = patch.title.trim();
  if (patch.notes !== undefined) next.notes = patch.notes;
  if (patch.dueAt !== undefined) next.dueAt = patch.dueAt;
  if (patch.remindAt !== undefined) next.remindAt = patch.remindAt;
  if (patch.status !== undefined) {
    next.status = patch.status;
    next.completedAt = patch.status === "done" ? now : null;
  }
  db.update(schema.todos)
    .set(next)
    .where(and(eq(schema.todos.id, todoId), eq(schema.todos.userId, userId)))
    .run();

  if (patch.remindAt !== undefined) {
    db.update(schema.todoReminders)
      .set({ status: "failed", skipReason: "rescheduled", updatedAt: now })
      .where(
        and(
          eq(schema.todoReminders.todoId, todoId),
          eq(schema.todoReminders.status, "pending"),
        ),
      )
      .run();
    if (patch.remindAt) {
      const reminder: TodoReminderRow = {
        id: newId(),
        todoId,
        userId,
        scheduledAt: patch.remindAt,
        sentAt: null,
        status: "pending",
        skipReason: null,
        attempt: 0,
        catchupUsed: false,
        createdAt: now,
        updatedAt: now,
      };
      db.insert(schema.todoReminders).values(reminder).run();
    }
  }

  return getTodoForUser(userId, todoId);
}

export function completeTodo(userId: string, todoId: string): TodoRow | null {
  return updateTodo(userId, todoId, { status: "done" });
}

export function softDeleteTodo(userId: string, todoId: string): TodoRow | null {
  const existing = getTodoForUser(userId, todoId);
  if (!existing) return null;
  const now = nowIso();
  db.update(schema.todos)
    .set({ deletedAt: now, updatedAt: now, status: "cancelled" })
    .where(and(eq(schema.todos.id, todoId), eq(schema.todos.userId, userId)))
    .run();
  db.update(schema.todoReminders)
    .set({ status: "failed", skipReason: "todo_deleted", updatedAt: now })
    .where(
      and(eq(schema.todoReminders.todoId, todoId), eq(schema.todoReminders.status, "pending")),
    )
    .run();
  return (
    db
      .select()
      .from(schema.todos)
      .where(and(eq(schema.todos.id, todoId), eq(schema.todos.userId, userId)))
      .get() ?? null
  );
}

export function rescheduleReminder(
  userId: string,
  todoId: string,
  remindAt: string,
): { todo: TodoRow; reminder: TodoReminderRow } | null {
  const todo = getTodoForUser(userId, todoId);
  if (!todo) return null;
  const now = nowIso();
  db.update(schema.todos)
    .set({ remindAt, updatedAt: now })
    .where(and(eq(schema.todos.id, todoId), eq(schema.todos.userId, userId)))
    .run();
  db.update(schema.todoReminders)
    .set({ status: "failed", skipReason: "rescheduled", updatedAt: now })
    .where(
      and(eq(schema.todoReminders.todoId, todoId), eq(schema.todoReminders.status, "pending")),
    )
    .run();
  const reminder: TodoReminderRow = {
    id: newId(),
    todoId,
    userId,
    scheduledAt: remindAt,
    sentAt: null,
    status: "pending",
    skipReason: null,
    attempt: 0,
    catchupUsed: false,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(schema.todoReminders).values(reminder).run();
  return { todo: getTodoForUser(userId, todoId)!, reminder };
}

export function listDuePendingReminders(nowIsoStr: string, limit = 50): TodoReminderRow[] {
  return db
    .select()
    .from(schema.todoReminders)
    .where(
      and(
        eq(schema.todoReminders.status, "pending"),
        lte(schema.todoReminders.scheduledAt, nowIsoStr),
      ),
    )
    .orderBy(asc(schema.todoReminders.scheduledAt))
    .limit(limit)
    .all();
}

/** Most recent skipped reminder per todo that has not used catch-up yet. */
export function listCatchupCandidates(userId: string): TodoReminderRow[] {
  const skipped = db
    .select()
    .from(schema.todoReminders)
    .where(
      and(
        eq(schema.todoReminders.userId, userId),
        eq(schema.todoReminders.catchupUsed, false),
        or(
          eq(schema.todoReminders.status, "skipped_window"),
          eq(schema.todoReminders.status, "skipped_quota"),
        ),
      ),
    )
    .orderBy(desc(schema.todoReminders.scheduledAt))
    .all();

  const seen = new Set<string>();
  const out: TodoReminderRow[] = [];
  for (const row of skipped) {
    if (seen.has(row.todoId)) continue;
    seen.add(row.todoId);
    out.push(row);
  }
  return out;
}

export function markReminder(
  reminderId: string,
  patch: Partial<{
    status: ReminderStatus;
    sentAt: string | null;
    skipReason: string | null;
    attempt: number;
    catchupUsed: boolean;
  }>,
): void {
  const next: Record<string, unknown> = { updatedAt: nowIso() };
  if (patch.status !== undefined) next.status = patch.status;
  if (patch.sentAt !== undefined) next.sentAt = patch.sentAt;
  if (patch.skipReason !== undefined) next.skipReason = patch.skipReason;
  if (patch.attempt !== undefined) next.attempt = patch.attempt;
  if (patch.catchupUsed !== undefined) next.catchupUsed = patch.catchupUsed;
  db.update(schema.todoReminders)
    .set(next)
    .where(eq(schema.todoReminders.id, reminderId))
    .run();
}

export function findOpenTodoByTitleHint(userId: string, hint: string): TodoRow | null {
  const q = hint.trim().toLowerCase();
  if (!q) return null;
  const open = listTodos(userId, { status: "open", limit: 50 });
  const exact = open.find((t) => t.title.toLowerCase() === q);
  if (exact) return exact;
  return open.find((t) => t.title.toLowerCase().includes(q)) ?? null;
}
