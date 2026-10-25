import { desc, eq } from "drizzle-orm";
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
  };
  db.insert(schema.messages).values(row).run();
  return row;
}

export function listMessagesForUser(userId: string, limit = 100): MessageRow[] {
  return db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.userId, userId))
    .orderBy(desc(schema.messages.createdAt))
    .limit(limit)
    .all();
}
