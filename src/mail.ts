/**
 * Login email delivery (magic link primary; OTP digits as backup).
 *
 * Sends through the configured SMTP account:
 * SMTP_ADDRESS, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD,
 * SMTP_SSL_ENABLED, SMTP_DOMAIN, EMAIL_SENDER.
 * Resend is only a fallback when SMTP is unset. Neither → dev sink.
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
  // Prefer the SMTP login itself so Exmail accepts the From address.
  return (
    process.env.SMTP_USERNAME?.trim() ||
    process.env.EMAIL_SENDER?.trim() ||
    process.env.MAIL_FROM?.trim() ||
    "noreply@localhost"
  );
}

export function mailTransport(): "smtp" | "resend" | "dev" {
  if (smtpConfigured()) return "smtp";
  if (process.env.RESEND_API_KEY?.trim() && process.env.MAIL_FROM?.trim()) return "resend";
  return "dev";
}

async function sendViaSmtp(to: string, subject: string, text: string): Promise<void> {
  const address = process.env.SMTP_ADDRESS!.trim();
  const port = Number(process.env.SMTP_PORT?.trim() || "465");
  const user = process.env.SMTP_USERNAME!.trim();
  const pass = process.env.SMTP_PASSWORD!.trim();
  const domain = process.env.SMTP_DOMAIN?.trim();
  const sslRaw = process.env.SMTP_SSL_ENABLED?.trim().toLowerCase();
  // Default SSL on for port 465; honor explicit false/0
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
  console.log(`[mail:dev] magic link for ${to}: ${magicUrl}`);
  console.log(`[mail:dev] OTP backup for ${to}: ${code}`);
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
  const subject = `WeBot 登录验证码 ${payload.code}`;
  const text = [
    `你正在登录 WeBot，以下两种方式任选其一（10 分钟内有效）：`,
    ``,
    `方式一：在登录页输入验证码`,
    `    ${payload.code}`,
    `    适合：邮件在手机上打开，但要在电脑上登录。`,
    ``,
    `方式二：直接点开魔法链接`,
    `    ${payload.magicUrl}`,
    `    适合：就在当前设备登录。链接在哪个浏览器打开，就登录哪个浏览器。`,
    ``,
    `如果不是你本人操作，忽略这封邮件即可。`,
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
