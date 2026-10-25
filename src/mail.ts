/**
 * Login email delivery (OTP digits + magic link).
 * Dev default: log to console (+ optional file).
 * Optional Resend when RESEND_API_KEY + MAIL_FROM are set.
 */

import fs from "node:fs";
import path from "node:path";

export async function sendLoginEmail(
  to: string,
  payload: { code: string; magicUrl: string },
): Promise<void> {
  const subject = "Your WeBot login link and code";
  const body = [
    `Sign in to WeBot with this magic link (expires in 10 minutes):`,
    payload.magicUrl,
    ``,
    `Or enter this one-time code: ${payload.code}`,
    ``,
    `If you did not request this, ignore this email.`,
  ].join("\n");

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();

  if (apiKey && from) {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: body,
      }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Resend failed: ${resp.status} ${text}`);
    }
    console.log(`[mail] login email sent via Resend to ${to}`);
    return;
  }

  console.log(`[mail:dev] OTP for ${to}: ${payload.code}`);
  console.log(`[mail:dev] magic link for ${to}: ${payload.magicUrl}`);
  const sink = process.env.OTP_DEV_SINK?.trim() || "./data/otp-dev.log";
  try {
    fs.mkdirSync(path.dirname(path.resolve(sink)), { recursive: true });
    fs.appendFileSync(
      sink,
      `${new Date().toISOString()}\t${to}\t${payload.code}\t${payload.magicUrl}\n`,
      "utf-8",
    );
  } catch (err) {
    console.warn("[mail:dev] failed to write OTP sink:", err);
  }
}

/** @deprecated use sendLoginEmail */
export async function sendOtpEmail(to: string, code: string): Promise<void> {
  await sendLoginEmail(to, {
    code,
    magicUrl: `(no-magic)`,
  });
}
