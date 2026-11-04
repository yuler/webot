import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { nowIso } from "../auth/crypto";
import { PROACTIVE_QUOTA_HEURISTIC, PROACTIVE_WINDOW_MS } from "./tips";

export type UserModuleSettings = typeof schema.userModuleSettings.$inferSelect;

const DEFAULTS = {
  todosEnabled: true,
  timezone: "Asia/Shanghai",
  tipsAckedAt: null as string | null,
  lastUserInboundAt: null as string | null,
  proactiveSentInWindow: 0,
  windowStartedAt: null as string | null,
  lastContextToken: null as string | null,
  lastWechatUserId: null as string | null,
};

export function getTodosSettings(userId: string): UserModuleSettings {
  const existing = db
    .select()
    .from(schema.userModuleSettings)
    .where(eq(schema.userModuleSettings.userId, userId))
    .get();
  if (existing) return existing;
  const now = nowIso();
  const row: UserModuleSettings = {
    userId,
    todosEnabled: DEFAULTS.todosEnabled,
    timezone: DEFAULTS.timezone,
    tipsAckedAt: DEFAULTS.tipsAckedAt,
    lastUserInboundAt: DEFAULTS.lastUserInboundAt,
    proactiveSentInWindow: DEFAULTS.proactiveSentInWindow,
    windowStartedAt: DEFAULTS.windowStartedAt,
    lastContextToken: DEFAULTS.lastContextToken,
    lastWechatUserId: DEFAULTS.lastWechatUserId,
    updatedAt: now,
  };
  db.insert(schema.userModuleSettings).values(row).run();
  return row;
}

export function updateTodosSettings(
  userId: string,
  patch: Partial<{
    todosEnabled: boolean;
    timezone: string;
    tipsAckedAt: string | null;
    lastUserInboundAt: string | null;
    proactiveSentInWindow: number;
    windowStartedAt: string | null;
    lastContextToken: string | null;
    lastWechatUserId: string | null;
  }>,
): UserModuleSettings {
  getTodosSettings(userId);
  const next: Record<string, unknown> = { updatedAt: nowIso() };
  if (patch.todosEnabled !== undefined) next.todosEnabled = patch.todosEnabled;
  if (patch.timezone !== undefined) next.timezone = patch.timezone;
  if (patch.tipsAckedAt !== undefined) next.tipsAckedAt = patch.tipsAckedAt;
  if (patch.lastUserInboundAt !== undefined) next.lastUserInboundAt = patch.lastUserInboundAt;
  if (patch.proactiveSentInWindow !== undefined) {
    next.proactiveSentInWindow = patch.proactiveSentInWindow;
  }
  if (patch.windowStartedAt !== undefined) next.windowStartedAt = patch.windowStartedAt;
  if (patch.lastContextToken !== undefined) next.lastContextToken = patch.lastContextToken;
  if (patch.lastWechatUserId !== undefined) next.lastWechatUserId = patch.lastWechatUserId;
  db.update(schema.userModuleSettings)
    .set(next)
    .where(eq(schema.userModuleSettings.userId, userId))
    .run();
  return getTodosSettings(userId);
}

/** Refresh 24h heuristic window on user inbound; store context for proactive sends. */
export function recordUserInbound(
  userId: string,
  input: { wechatUserId: string; contextToken: string; at?: Date },
): UserModuleSettings {
  const at = (input.at ?? new Date()).toISOString();
  return updateTodosSettings(userId, {
    lastUserInboundAt: at,
    windowStartedAt: at,
    proactiveSentInWindow: 0,
    lastContextToken: input.contextToken,
    lastWechatUserId: input.wechatUserId,
  });
}

export type ProactiveGate =
  | { ok: true; settings: UserModuleSettings }
  | {
      ok: false;
      reason: "disabled" | "no_window" | "quota" | "no_context" | "no_wechat";
      settings: UserModuleSettings;
    };

/** Heuristic gate — not an exact iLink quota API. */
export function canSendProactive(
  userId: string,
  now = new Date(),
): ProactiveGate {
  const settings = getTodosSettings(userId);
  if (!settings.todosEnabled) return { ok: false, reason: "disabled", settings };
  if (!settings.lastWechatUserId) return { ok: false, reason: "no_wechat", settings };
  if (!settings.lastContextToken) return { ok: false, reason: "no_context", settings };
  if (!settings.lastUserInboundAt) return { ok: false, reason: "no_window", settings };
  const inboundMs = new Date(settings.lastUserInboundAt).getTime();
  if (!Number.isFinite(inboundMs) || now.getTime() - inboundMs > PROACTIVE_WINDOW_MS) {
    return { ok: false, reason: "no_window", settings };
  }
  if (settings.proactiveSentInWindow >= PROACTIVE_QUOTA_HEURISTIC) {
    return { ok: false, reason: "quota", settings };
  }
  return { ok: true, settings };
}

export function bumpProactiveSent(userId: string): UserModuleSettings {
  const s = getTodosSettings(userId);
  return updateTodosSettings(userId, {
    proactiveSentInWindow: s.proactiveSentInWindow + 1,
  });
}
