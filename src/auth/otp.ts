import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "../db";
import { sendOtpEmail } from "../mail";
import { hashSecret, isValidEmail, newId, normalizeEmail, nowIso, randomOtpCode } from "./crypto";

const OTP_TTL_MS = 10 * 60 * 1000;

export async function requestOtp(rawEmail: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) {
    return { ok: false, error: "Invalid email address" };
  }

  const code = randomOtpCode();
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  db.insert(schema.otpCodes)
    .values({
      id: newId(),
      email,
      codeHash: hashSecret(code),
      expiresAt,
      createdAt,
    })
    .run();

  await sendOtpEmail(email, code);
  return { ok: true };
}

export function consumeOtp(
  rawEmail: string,
  code: string,
): { ok: true; email: string } | { ok: false; error: string } {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) {
    return { ok: false, error: "Invalid email address" };
  }
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    return { ok: false, error: "Invalid code" };
  }

  const now = nowIso();
  const rows = db
    .select()
    .from(schema.otpCodes)
    .where(
      and(
        eq(schema.otpCodes.email, email),
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
    return { ok: false, error: "Invalid or expired code" };
  }

  db.update(schema.otpCodes)
    .set({ consumedAt: now })
    .where(eq(schema.otpCodes.id, match.id))
    .run();

  return { ok: true, email };
}
