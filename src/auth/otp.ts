import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "../db";
import { sendLoginEmail } from "../mail";
import {
  hashSecret,
  isValidEmail,
  newId,
  normalizeEmail,
  nowIso,
  randomOtpCode,
  randomToken,
} from "./crypto";

const OTP_TTL_MS = 10 * 60 * 1000;
/** Min interval between send requests for the same email. */
const RATE_LIMIT_WINDOW_MS = 60_000;
/** Max successful send requests per email in this window. */
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_LONG_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_LONG = 10;

/** Failed OTP verifies before lockout (per email and optional IP). */
const VERIFY_MAX_FAILURES = 5;
/** Lockout window after too many failed verifies. */
const VERIFY_LOCKOUT_MS = 15 * 60 * 1000;

type VerifyLockState = { failures: number; lockedUntil: number };
/** In-process verify failure / lockout state (keyed email:… or ip:…). */
const verifyLocks = new Map<string, VerifyLockState>();

export type ConsumeOtpResult =
  | { ok: true; email: string }
  | { ok: false; error: string; retryAfterSec?: number };

function lockKeys(email: string, ip?: string): string[] {
  const keys = [`email:${email}`];
  if (ip && ip.length > 0) keys.push(`ip:${ip}`);
  return keys;
}

function checkVerifyLock(email: string, ip?: string): ConsumeOtpResult | null {
  const now = Date.now();
  let worstRetry = 0;
  for (const key of lockKeys(email, ip)) {
    const state = verifyLocks.get(key);
    if (!state) continue;
    if (state.lockedUntil > now) {
      worstRetry = Math.max(worstRetry, Math.ceil((state.lockedUntil - now) / 1000));
    }
  }
  if (worstRetry > 0) {
    return {
      ok: false,
      error: "Too many failed attempts. Try again later.",
      retryAfterSec: worstRetry,
    };
  }
  return null;
}

function recordVerifyFailure(email: string, ip?: string): ConsumeOtpResult | null {
  const now = Date.now();
  let lockedRetry = 0;
  for (const key of lockKeys(email, ip)) {
    let state = verifyLocks.get(key);
    if (!state) {
      state = { failures: 0, lockedUntil: 0 };
    } else if (state.lockedUntil > 0 && state.lockedUntil <= now) {
      // Previous lockout expired — start a fresh failure window.
      state = { failures: 0, lockedUntil: 0 };
    }
    if (state.lockedUntil > now) {
      lockedRetry = Math.max(lockedRetry, Math.ceil((state.lockedUntil - now) / 1000));
      verifyLocks.set(key, state);
      continue;
    }
    state.failures += 1;
    if (state.failures >= VERIFY_MAX_FAILURES) {
      state.lockedUntil = now + VERIFY_LOCKOUT_MS;
      state.failures = 0;
      lockedRetry = Math.max(lockedRetry, Math.ceil(VERIFY_LOCKOUT_MS / 1000));
    }
    verifyLocks.set(key, state);
  }
  if (lockedRetry > 0) {
    return {
      ok: false,
      error: "Too many failed attempts. Try again later.",
      retryAfterSec: lockedRetry,
    };
  }
  return null;
}

function clearVerifyLock(email: string, ip?: string): void {
  for (const key of lockKeys(email, ip)) {
    verifyLocks.delete(key);
  }
}

/** Test helper: clear in-memory verify lockouts. */
export function __resetVerifyLocksForTests(): void {
  verifyLocks.clear();
}

export type RequestLoginResult =
  | { ok: true }
  | { ok: false; error: string; retryAfterSec?: number };

/** Absolute site origin for magic-link emails only (not SSR API fetches). */
function publicOrigin(): string {
  return (
    process.env.PUBLIC_ORIGIN?.trim() ||
    process.env.APP_ORIGIN?.trim() ||
    `http://127.0.0.1:${process.env.PORT || 3000}`
  ).replace(/\/+$/, "");
}

function countRecentSends(email: string, sinceIso: string): number {
  // Count OTP rows only — each send inserts one otp + one magic.
  const rows = db
    .select({ id: schema.otpCodes.id })
    .from(schema.otpCodes)
    .where(
      and(
        eq(schema.otpCodes.email, email),
        eq(schema.otpCodes.kind, "otp"),
        gt(schema.otpCodes.createdAt, sinceIso),
      ),
    )
    .all();
  return rows.length;
}

function checkRateLimit(email: string): RequestLoginResult | null {
  const now = Date.now();
  const shortCount = countRecentSends(
    email,
    new Date(now - RATE_LIMIT_WINDOW_MS).toISOString(),
  );
  if (shortCount >= RATE_LIMIT_MAX) {
    return {
      ok: false,
      error: "Too many login emails. Try again in a minute.",
      retryAfterSec: 60,
    };
  }
  const longCount = countRecentSends(
    email,
    new Date(now - RATE_LIMIT_WINDOW_LONG_MS).toISOString(),
  );
  if (longCount >= RATE_LIMIT_MAX_LONG) {
    return {
      ok: false,
      error: "Too many login emails. Try again later.",
      retryAfterSec: 900,
    };
  }
  return null;
}

/** Invalidate all unused challenges for an email (otp + magic). */
export function invalidateUnusedChallenges(email: string, exceptId?: string): void {
  const now = nowIso();
  const rows = db
    .select({ id: schema.otpCodes.id })
    .from(schema.otpCodes)
    .where(and(eq(schema.otpCodes.email, email), isNull(schema.otpCodes.consumedAt)))
    .all();
  for (const row of rows) {
    if (exceptId && row.id === exceptId) continue;
    db.update(schema.otpCodes)
      .set({ consumedAt: now })
      .where(eq(schema.otpCodes.id, row.id))
      .run();
  }
}

/**
 * Send a magic-link login email (6-digit OTP kept as backup in the same mail).
 */
export async function requestOtp(rawEmail: string): Promise<RequestLoginResult> {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) {
    return { ok: false, error: "Invalid email address" };
  }

  const limited = checkRateLimit(email);
  if (limited) return limited;

  const code = randomOtpCode();
  const magicToken = randomToken();
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  const otpId = newId();
  const magicId = newId();

  db.insert(schema.otpCodes)
    .values({
      id: otpId,
      email,
      codeHash: hashSecret(code),
      kind: "otp",
      expiresAt,
      createdAt,
    })
    .run();

  db.insert(schema.otpCodes)
    .values({
      id: magicId,
      email,
      codeHash: hashSecret(magicToken),
      kind: "magic",
      expiresAt,
      createdAt,
    })
    .run();

  const magicUrl = `${publicOrigin()}/api/auth/magic?token=${encodeURIComponent(magicToken)}`;
  await sendLoginEmail(email, { code, magicUrl });
  return { ok: true };
}

export function consumeOtp(
  rawEmail: string,
  code: string,
  opts?: { ip?: string },
): ConsumeOtpResult {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) {
    return { ok: false, error: "Invalid email address" };
  }

  const locked = checkVerifyLock(email, opts?.ip);
  if (locked) return locked;

  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    const after = recordVerifyFailure(email, opts?.ip);
    if (after) return after;
    return { ok: false, error: "Invalid code" };
  }

  const now = nowIso();
  const rows = db
    .select()
    .from(schema.otpCodes)
    .where(
      and(
        eq(schema.otpCodes.email, email),
        eq(schema.otpCodes.kind, "otp"),
        isNull(schema.otpCodes.consumedAt),
        gt(schema.otpCodes.expiresAt, now),
      ),
    )
    .orderBy(desc(schema.otpCodes.createdAt))
    .limit(5)
    .all();

  const codeHash = hashSecret(trimmed);
  const match = rows.find((r) => r.codeHash === codeHash);
  if (!match) {
    const after = recordVerifyFailure(email, opts?.ip);
    if (after) return after;
    return { ok: false, error: "Invalid or expired code" };
  }

  db.update(schema.otpCodes)
    .set({ consumedAt: now })
    .where(eq(schema.otpCodes.id, match.id))
    .run();

  // Invalidate sibling otp + magic challenges for this email
  invalidateUnusedChallenges(email, match.id);
  clearVerifyLock(email, opts?.ip);

  return { ok: true, email };
}

export function consumeMagicToken(
  rawToken: string,
): { ok: true; email: string } | { ok: false; error: string } {
  const token = rawToken.trim();
  if (!token || token.length < 20) {
    return { ok: false, error: "Invalid or expired link" };
  }

  const now = nowIso();
  const codeHash = hashSecret(token);
  const match = db
    .select()
    .from(schema.otpCodes)
    .where(
      and(
        eq(schema.otpCodes.codeHash, codeHash),
        eq(schema.otpCodes.kind, "magic"),
        isNull(schema.otpCodes.consumedAt),
        gt(schema.otpCodes.expiresAt, now),
      ),
    )
    .get();

  if (!match) {
    return { ok: false, error: "Invalid or expired link" };
  }

  db.update(schema.otpCodes)
    .set({ consumedAt: now })
    .where(eq(schema.otpCodes.id, match.id))
    .run();

  invalidateUnusedChallenges(match.email, match.id);

  return { ok: true, email: match.email };
}
