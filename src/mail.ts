/**
 * Login email delivery (OTP digits + magic link).
 *
 * Priority:
 * 1. SMTP when SMTP_ADDRESS + SMTP_USERNAME + SMTP_PASSWORD are set
 *    (same keys as moge / Dokploy — EMAIL_SENDER, SMTP_DOMAIN, SMTP_SSL_ENABLED)
 * 2. Resend when RESEND_API_KEY + MAIL_FROM are set
 * 3. Dev: console + OTP_DEV_SINK file
 */

import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";

function smtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_ADDRESS?.trim() &&
      process.env.SMTP_USERNAME?.trim() &&
      process.env.SMTP_PASSWORD?.trim(),
  );
}

function mailFrom(): string {
  return (
    process.env.EMAIL_SENDER?.trim() ||
    process.env.MAIL_FROM?.trim() ||
    process.env.SMTP_USERNAME?.trim() ||
    "noreply@localhost"
  );
}

async function sendViaSmtp(to: string, subject: string, text: string): Promise<void> {
  const address = process.env.SMTP_ADDRESS!.trim();
  const port = Number(process.env.SMTP_PORT?.trim() || "465");
  const user = process.env.SMTP_USERNAME!.trim();
  const pass = process.env.SMTP_PASSWORD!.trim();
  const domain = process.env.SMTP_DOMAIN?.trim();
  const sslRaw = process.env.SMTP_SSL_ENABLED?.trim().toLowerCase();
  // Default SSL on for 465 (moge prod); honor explicit false/0
  const secure =
    sslRaw === "false" || sslRaw === "0"
      ? false
      : sslRaw === "true" || sslRaw === "1" || port === 465;

  const transporter = nodemailer.createTransport({
    host: address,
    port,
    secure,
    auth: { user, pass },
    ...(domain ? { name: domain } : {}),
  });

  await transporter.sendMail({
    from: mailFrom(),
    to,
    subject,
    text,
  });
  console.log(`[mail] login email sent via SMTP to ${to}`);
}

async function sendViaResend(to: string, subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY!.trim();
  const from = process.env.MAIL_FROM!.trim();
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Resend failed: ${resp.status} ${body}`);
  }
  console.log(`[mail] login email sent via Resend to ${to}`);
}

function writeDevSink(to: string, code: string, magicUrl: string): void {
  console.log(`[mail:dev] OTP for ${to}: ${code}`);
  console.log(`[mail:dev] magic link for ${to}: ${magicUrl}`);
  const sink = process.env.OTP_DEV_SINK?.trim() || "./data/otp-dev.log";
  try {
    fs.mkdirSync(path.dirname(path.resolve(sink)), { recursive: true });
    fs.appendFileSync(
      sink,
      `${new Date().toISOString()}\t${to}\t${code}\t${magicUrl}\n`,
      "utf-8",
    );
  } catch (err) {
    console.warn("[mail:dev] failed to write OTP sink:", err);
  }
}

export async function sendLoginEmail(
  to: string,
  payload: { code: string; magicUrl: string },
): Promise<void> {
  const subject = "Your WeBot login link and code";
  const text = [
    `Sign in to WeBot with this magic link (expires in 10 minutes):`,
    payload.magicUrl,
    ``,
    `Or enter this one-time code: ${payload.code}`,
    ``,
    `If you did not request this, ignore this email.`,
  ].join("\n");

  if (smtpConfigured()) {
    await sendViaSmtp(to, subject, text);
    return;
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  const mailFromEnv = process.env.MAIL_FROM?.trim();
  if (resendKey && mailFromEnv) {
    await sendViaResend(to, subject, text);
    return;
  }

  writeDevSink(to, payload.code, payload.magicUrl);
}

/** @deprecated use sendLoginEmail */
export async function sendOtpEmail(to: string, code: string): Promise<void> {
  await sendLoginEmail(to, {
    code,
    magicUrl: `(no-magic)`,
  });
}
