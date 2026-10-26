import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "../db";
import { hashSecret, newId, nowIso, randomToken } from "./crypto";
import { isProductionRuntime } from "./secrets";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = "webot_session";

export type SessionUser = {
  id: string;
  email: string;
};

/** Production always Secure; local may opt in via COOKIE_SECURE=1. */
function cookieSecure(): boolean {
  return process.env.COOKIE_SECURE === "1" || isProductionRuntime();
}

export function createSession(userId: string): { token: string; expiresAt: string } {
  const token = randomToken();
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  db.insert(schema.sessions)
    .values({
      id: newId(),
      userId,
      tokenHash: hashSecret(token),
      expiresAt,
      createdAt,
    })
    .run();

  return { token, expiresAt };
}

export function getSessionUser(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  const now = nowIso();
  const row = db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      expiresAt: schema.sessions.expiresAt,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(
      and(
        eq(schema.sessions.tokenHash, hashSecret(token)),
        gt(schema.sessions.expiresAt, now),
      ),
    )
    .get();

  if (!row) return null;
  return { id: row.id, email: row.email };
}

export function destroySession(token: string | undefined | null): void {
  if (!token) return;
  db.delete(schema.sessions)
    .where(eq(schema.sessions.tokenHash, hashSecret(token)))
    .run();
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(val);
  }
  return out;
}

export function sessionCookieHeader(token: string, expiresAt: string): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ];
  if (cookieSecure()) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookieHeader(): string {
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (cookieSecure()) parts.push("Secure");
  return parts.join("; ");
}
