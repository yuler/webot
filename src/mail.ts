/**
 * OTP delivery. Dev default: log to console (+ optional file).
 * Optional Resend HTTP API when RESEND_API_KEY + MAIL_FROM are set.
 * (WebAuthn / SMS / WeChat OAuth intentionally out of scope for this slice.)
 */

import fs from "node:fs";
import path from "node:path";

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const subject = "Your WeBot login code";
  const body = `Your WeBot login code is ${code}\n\nIt expires in 10 minutes. If you did not request this, ignore this email.`;

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
    console.log(`[mail] OTP sent via Resend to ${to}`);
    return;
  }

  console.log(`[mail:dev] OTP for ${to}: ${code}`);
  const sink = process.env.OTP_DEV_SINK?.trim() || "./data/otp-dev.log";
  try {
    fs.mkdirSync(path.dirname(path.resolve(sink)), { recursive: true });
    fs.appendFileSync(
      sink,
      `${new Date().toISOString()}\t${to}\t${code}\n`,
      "utf-8",
    );
  } catch (err) {
    console.warn("[mail:dev] failed to write OTP sink:", err);
  }
}
