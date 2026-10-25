import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "../db";
import { newId, nowIso, randomBindCode } from "./crypto";

export type BindingRow = typeof schema.wechatBindings.$inferSelect;

function uniqueBindCode(): string {
  for (let i = 0; i < 8; i++) {
    const code = randomBindCode();
    const hit = db
      .select({ id: schema.wechatBindings.id })
      .from(schema.wechatBindings)
      .where(eq(schema.wechatBindings.bindCode, code))
      .get();
    if (!hit) return code;
  }
  return randomBindCode() + newId().slice(0, 4);
}

export function ensureBindingForUser(userId: string): BindingRow {
  const existing = db
    .select()
    .from(schema.wechatBindings)
    .where(eq(schema.wechatBindings.userId, userId))
    .get();
  if (existing) return existing;

  const now = nowIso();
  const row: BindingRow = {
    id: newId(),
    userId,
    bindCode: uniqueBindCode(),
    wechatUserId: null,
    status: "pending",
    boundAt: null,
    disconnectedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(schema.wechatBindings).values(row).run();
  return row;
}

export function getBindingForUser(userId: string): BindingRow | null {
  return (
    db.select().from(schema.wechatBindings).where(eq(schema.wechatBindings.userId, userId)).get() ??
    null
  );
}

export function resetBindCode(userId: string): BindingRow {
  const now = nowIso();
  const existing = ensureBindingForUser(userId);
  const next = uniqueBindCode();
  db.update(schema.wechatBindings)
    .set({
      bindCode: next,
      // Resetting code unbinds WeChat until they bind again
      wechatUserId: null,
      status: "pending",
      boundAt: null,
      disconnectedAt: null,
      updatedAt: now,
    })
    .where(eq(schema.wechatBindings.id, existing.id))
    .run();
  return getBindingForUser(userId)!;
}

export function disconnectBinding(userId: string): BindingRow {
  const now = nowIso();
  const existing = ensureBindingForUser(userId);
  db.update(schema.wechatBindings)
    .set({
      wechatUserId: null,
      status: "disconnected",
      disconnectedAt: now,
      updatedAt: now,
    })
    .where(eq(schema.wechatBindings.id, existing.id))
    .run();
  return getBindingForUser(userId)!;
}

/**
 * Bind a WeChat iLink user id to the account that owns this bind code.
 * Returns the binding or an error reason.
 */
export function activateBindingByCode(
  bindCodeRaw: string,
  wechatUserId: string,
): { ok: true; binding: BindingRow } | { ok: false; error: string } {
  const bindCode = bindCodeRaw.trim().toUpperCase();
  if (!bindCode) return { ok: false, error: "empty code" };

  const row = db
    .select()
    .from(schema.wechatBindings)
    .where(eq(schema.wechatBindings.bindCode, bindCode))
    .get();
  if (!row) return { ok: false, error: "invalid code" };

  // If this WeChat id was bound to someone else, clear it
  const others = db
    .select()
    .from(schema.wechatBindings)
    .where(
      and(
        eq(schema.wechatBindings.wechatUserId, wechatUserId),
        ne(schema.wechatBindings.id, row.id),
      ),
    )
    .all();
  const now = nowIso();
  for (const o of others) {
    db.update(schema.wechatBindings)
      .set({
        wechatUserId: null,
        status: "disconnected",
        disconnectedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.wechatBindings.id, o.id))
      .run();
  }

  db.update(schema.wechatBindings)
    .set({
      wechatUserId,
      status: "active",
      boundAt: now,
      disconnectedAt: null,
      updatedAt: now,
    })
    .where(eq(schema.wechatBindings.id, row.id))
    .run();

  return { ok: true, binding: getBindingForUser(row.userId)! };
}

export function findActiveBindingByWechatUserId(wechatUserId: string): BindingRow | null {
  return (
    db
      .select()
      .from(schema.wechatBindings)
      .where(
        and(
          eq(schema.wechatBindings.wechatUserId, wechatUserId),
          eq(schema.wechatBindings.status, "active"),
        ),
      )
      .get() ?? null
  );
}

/** Parse "/bind CODE" or bare "WB-XXXXXX" from a WeChat text message. */
export function extractBindCodeFromText(text: string): string | null {
  const trimmed = text.trim();
  const cmd = trimmed.match(/^\/bind\s+(\S+)/i);
  if (cmd?.[1]) return cmd[1].toUpperCase();
  if (/^WB-[A-Z0-9]{6,12}$/i.test(trimmed)) return trimmed.toUpperCase();
  return null;
}
