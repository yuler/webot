import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { newId, nowIso } from "./crypto";

export type MessageRow = typeof schema.messages.$inferSelect;

export function insertMessage(input: {
  userId: string;
  wechatUserId?: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  wechatMessageId?: string | null;
}): MessageRow {
  const row: MessageRow = {
    id: newId(),
    userId: input.userId,
    wechatUserId: input.wechatUserId ?? null,
    role: input.role,
    content: input.content,
    wechatMessageId: input.wechatMessageId ?? null,
    createdAt: nowIso(),
    deletedAt: null,
  };
  db.insert(schema.messages).values(row).run();
  return row;
}

/** Visible messages only (soft-deleted rows stay in DB). */
export function listMessagesForUser(userId: string, limit = 100): MessageRow[] {
  return db
    .select()
    .from(schema.messages)
    .where(and(eq(schema.messages.userId, userId), isNull(schema.messages.deletedAt)))
    .orderBy(desc(schema.messages.createdAt))
    .limit(limit)
    .all();
}

/**
 * Soft-delete all visible messages for one WeBot user (current tenant only).
 * Returns how many rows were tombstoned.
 */
export function softDeleteMessagesForUser(userId: string): { deleted: number } {
  const now = nowIso();
  const result = db
    .update(schema.messages)
    .set({ deletedAt: now })
    .where(and(eq(schema.messages.userId, userId), isNull(schema.messages.deletedAt)))
    .run();
  // bun-sqlite / drizzle: changes may be on result
  const deleted =
    typeof (result as { changes?: number }).changes === "number"
      ? (result as { changes: number }).changes
      : Number(
          db
            .select({ n: sql<number>`count(*)` })
            .from(schema.messages)
            .where(and(eq(schema.messages.userId, userId), eq(schema.messages.deletedAt, now)))
            .get()?.n ?? 0,
        );
  return { deleted };
}
