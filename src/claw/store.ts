/**
 * Per-user ClawBot session persistence + ephemeral QR PNG (not shared globally).
 */
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { db, schema } from "../db";
import { nowIso } from "../auth/crypto";

export type ClawStatus =
  | "idle"
  | "starting"
  | "wait"
  | "scaned"
  | "confirmed"
  | "expired"
  | "ready"
  | "error";

export type ClawSessionRow = typeof schema.clawBotSessions.$inferSelect;

/** In-memory QR images keyed by SaaS userId (PNG buffers are ephemeral). */
const qrPngByUser = new Map<string, Buffer>();

export function getQrPng(userId: string): Buffer | null {
  return qrPngByUser.get(userId) ?? null;
}

export function setQrPng(userId: string, png: Buffer | null): void {
  if (!png) {
    qrPngByUser.delete(userId);
    return;
  }
  qrPngByUser.set(userId, png);
}

export function getClawSession(userId: string): ClawSessionRow | null {
  return (
    db.select().from(schema.clawBotSessions).where(eq(schema.clawBotSessions.userId, userId)).get() ??
    null
  );
}

export function ensureClawSession(userId: string): ClawSessionRow {
  const existing = getClawSession(userId);
  if (existing) return existing;
  const now = nowIso();
  const row: ClawSessionRow = {
    userId,
    botToken: null,
    updatesBuf: "",
    botId: "",
    status: "idle",
    message: "",
    qrRev: "",
    updatedAt: now,
  };
  db.insert(schema.clawBotSessions).values(row).run();
  return row;
}

export function listSessionsWithBotToken(): ClawSessionRow[] {
  return db
    .select()
    .from(schema.clawBotSessions)
    .where(isNotNull(schema.clawBotSessions.botToken))
    .all()
    .filter((r) => Boolean(r.botToken));
}

export function updateClawSession(
  userId: string,
  patch: Partial<{
    botToken: string | null;
    updatesBuf: string;
    botId: string;
    status: ClawStatus;
    message: string;
    qrRev: string;
  }>,
): ClawSessionRow {
  ensureClawSession(userId);
  const next: Record<string, unknown> = { updatedAt: nowIso() };
  if (patch.botToken !== undefined) next.botToken = patch.botToken;
  if (patch.updatesBuf !== undefined) next.updatesBuf = patch.updatesBuf;
  if (patch.botId !== undefined) next.botId = patch.botId;
  if (patch.status !== undefined) next.status = patch.status;
  if (patch.message !== undefined) next.message = patch.message;
  if (patch.qrRev !== undefined) next.qrRev = patch.qrRev;
  db.update(schema.clawBotSessions).set(next).where(eq(schema.clawBotSessions.userId, userId)).run();
  return getClawSession(userId)!;
}

export function clearClawCredentials(userId: string): ClawSessionRow {
  setQrPng(userId, null);
  return updateClawSession(userId, {
    botToken: null,
    updatesBuf: "",
    botId: "",
    status: "idle",
    message: "凭证已清除，请重新扫码",
    qrRev: "",
  });
}

/** Persist token for userId; clear the same token from any other SaaS user (1 WeChat Bot ↔ 1 console). */
export function claimBotToken(
  userId: string,
  token: string,
  extra: Partial<{ botId: string; status: ClawStatus; message: string; qrRev: string }> = {},
): ClawSessionRow {
  const others = db
    .select()
    .from(schema.clawBotSessions)
    .where(and(eq(schema.clawBotSessions.botToken, token), ne(schema.clawBotSessions.userId, userId)))
    .all();
  for (const o of others) {
    clearClawCredentials(o.userId);
  }
  return updateClawSession(userId, {
    botToken: token,
    botId: extra.botId,
    status: extra.status ?? "ready",
    message: extra.message ?? "登录成功，服务监听中",
    qrRev: extra.qrRev ?? "",
  });
}


/** Test/helper: inject a wait-state QR for a user without calling iLink. */
export function __testInjectQr(
  userId: string,
  input: { rev: string; png: Buffer; message?: string },
): ClawSessionRow {
  setQrPng(userId, input.png);
  return updateClawSession(userId, {
    status: "wait",
    message: input.message ?? "等待手机微信扫码",
    qrRev: input.rev,
    botToken: null,
  });
}

export function publicBotView(userId: string): {
  status: string;
  message: string;
  rev: string;
  botReady: boolean;
  hasQr: boolean;
} {
  const row = ensureClawSession(userId);
  const botReady = row.status === "ready" || row.status === "confirmed" || Boolean(row.botToken);
  const hasQr = Boolean(getQrPng(userId)) && !botReady && row.status !== "error";
  return {
    status: row.status,
    message: row.message || (botReady ? "已登录，服务监听中" : "加载中…"),
    rev: row.qrRev,
    botReady,
    hasQr,
  };
}
