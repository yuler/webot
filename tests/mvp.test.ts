import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { Database } from "bun:sqlite";

const TMP = path.join(import.meta.dir, "..", "data", "test-mvp.sqlite");
const PORT = 3457;
const BASE = `http://127.0.0.1:${PORT}`;
const SINK = path.join(path.dirname(TMP), "otp-test.log");

let proc: ReturnType<typeof Bun.spawn> | null = null;
const otpLog: string[] = [];

function cookieFromSetCookie(header: string | null): string {
  if (!header) return "";
  return header.split(";")[0]!.trim();
}

function allSetCookie(res: Response): string {
  // Bun may expose getSetCookie
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders.getSetCookie().join("\n");
  }
  return res.headers.get("set-cookie") || "";
}

beforeAll(async () => {
  fs.mkdirSync(path.dirname(TMP), { recursive: true });
  for (const s of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(TMP + s);
    } catch {}
  }
  try {
    fs.unlinkSync(SINK);
  } catch {}

  proc = Bun.spawn({
    cmd: ["bun", "run", "src/index.ts"],
    cwd: path.join(import.meta.dir, ".."),
    env: {
      ...process.env,
      WEBOT_SKIP_BOT: "1",
      SESSION_SECRET: "test-secret-mvp",
      SQLITE_PATH: TMP,
      PORT: String(PORT),
      HOST: "127.0.0.1",
      // Unreachable public origin (Dokploy HTTPS stand-in) — SSR must not use this
      PUBLIC_ORIGIN: "http://203.0.113.1:9",
      APP_ORIGIN: BASE,
      OTP_DEV_SINK: SINK,
      // leave COOKIE_SECURE / NODE_ENV unset for HTTP tests; separate Secure test below
      NODE_ENV: "test",
      COOKIE_SECURE: "",
      // Force mail:dev sink — do not inherit moge/Dokploy SMTP or Resend from host env
      SMTP_ADDRESS: "",
      SMTP_USERNAME: "",
      SMTP_PASSWORD: "",
      RESEND_API_KEY: "",
      MAIL_FROM: "",
      EMAIL_SENDER: "",
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  (async () => {
    const reader = proc!.stdout.getReader();
    const dec = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = dec.decode(value);
      otpLog.push(text);
    }
  })();
  (async () => {
    const reader = proc!.stderr.getReader();
    const dec = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      process.stderr.write(dec.decode(value));
    }
  })();

  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {}
    await Bun.sleep(100);
  }
  throw new Error("API server did not become ready");
});

afterAll(() => {
  proc?.kill();
  proc = null;
});

function latestFromSink(email: string): { code: string; magicUrl: string } {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (fs.existsSync(SINK)) {
      const lines = fs.readFileSync(SINK, "utf-8").trim().split("\n").filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        const parts = lines[i]!.split("\t");
        if (parts[1] === email && parts[2] && parts[3]) {
          // Email magic links use PUBLIC_ORIGIN; rewrite to APP_ORIGIN/BASE for local fetch
          const magicUrl = parts[3]!.replace(/^https?:\/\/[^/]+/, BASE);
          return { code: parts[2]!, magicUrl };
        }
      }
    }
    // busy wait briefly
    Bun.sleepSync(50);
  }
  throw new Error(`login email not found for ${email}`);
}

describe("MVP API", () => {
  test("OTP backup login happy path + binding created", async () => {
    const email = "mvp@example.com";
    const req = await fetch(`${BASE}/api/auth/request-otp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    expect(req.status).toBe(200);

    const { code } = latestFromSink(email);
    const verifyRes = await fetch(`${BASE}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    expect(verifyRes.status).toBe(200);
    const body = (await verifyRes.json()) as {
      ok: boolean;
      email: string;
      binding: { bindCode: string; status: string };
    };
    expect(body.ok).toBe(true);
    expect(body.binding.bindCode).toMatch(/^WB-/);

    const cookie = cookieFromSetCookie(verifyRes.headers.get("set-cookie"));
    expect(cookie.startsWith("webot_session=")).toBe(true);

    (globalThis as any).__mvp = { cookie, email, bindCode: body.binding.bindCode };
  });

  test("successful OTP verify invalidates sibling magic + other otp codes", async () => {
    const email = "invalidate@example.com";
    await fetch(`${BASE}/api/auth/request-otp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const first = latestFromSink(email);

    await fetch(`${BASE}/api/auth/request-otp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const second = latestFromSink(email);
    expect(second.code).not.toBe(first.code);

    const verifyRes = await fetch(`${BASE}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, code: second.code }),
    });
    expect(verifyRes.status).toBe(200);

    // old OTP no longer works
    const oldOtp = await fetch(`${BASE}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, code: first.code }),
    });
    expect(oldOtp.status).toBe(400);

    // magic from either send should be dead
    for (const url of [first.magicUrl, second.magicUrl]) {
      const magicRes = await fetch(url, { redirect: "manual" });
      expect(magicRes.status).toBe(302);
      const loc = magicRes.headers.get("location") || "";
      expect(loc.includes("/login")).toBe(true);
    }
  });

  test("magic link login sets session cookie and redirects", async () => {
    const email = "magic@example.com";
    await fetch(`${BASE}/api/auth/request-otp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const { magicUrl } = latestFromSink(email);
    const res = await fetch(magicUrl, { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/console");
    const setCookie = allSetCookie(res);
    expect(setCookie.includes("webot_session=")).toBe(true);

    const cookie = cookieFromSetCookie(res.headers.get("set-cookie"));
    const me = await fetch(`${BASE}/api/me`, { headers: { cookie } });
    expect(me.status).toBe(200);
    const body = (await me.json()) as { user: { email: string } };
    expect(body.user.email).toBe(email);
  });

  test("SSR / and /console work when PUBLIC_ORIGIN is unreachable", async () => {
    // Spawn sets PUBLIC_ORIGIN=http://203.0.113.1:9 and APP_ORIGIN=BASE
    const root = await fetch(`${BASE}/`, { redirect: "manual" });
    expect(root.status).toBe(200); // guest landing, not redirect
    expect(root.status).not.toBe(500);
    const guestHtml = await root.text();
    expect(guestHtml).toContain("微信里的 AI 助手");
    expect(guestHtml).toContain(">登录<");
    expect(guestHtml).toContain('>登录</a>');
    expect(guestHtml).toContain('aria-label="WeBot 首页"');
    expect(guestHtml).toContain('aria-label="切换主题"');
    expect(guestHtml).not.toContain(">退出<");
    // Scan lives on /console — no /clawbot route or link.
    expect(guestHtml).not.toContain('href="/clawbot"');
    expect(guestHtml).not.toContain(">WEBOT<");
    expect(guestHtml).not.toContain(">weBOT<");
    expect(guestHtml).toContain(">WeBot<");
    expect(guestHtml).toContain('src="/intro.mp4"');
    expect(guestHtml).toContain("WeBot 使用简介");
    // Guest CTAs go to /login; no console entry link on the landing.
    expect(guestHtml).not.toContain('href="/console"');
    expect(guestHtml).not.toContain(">黑<");
    expect(guestHtml).not.toContain(">白<");
    const login = await fetch(`${BASE}/login`);
    expect(login.status).toBe(200);
    const loginHtml = await login.text();
    expect(loginHtml).toContain("发送登录链接");
    expect(loginHtml).not.toContain("密码");
    const consoleUnauth = await fetch(`${BASE}/console`, { redirect: "manual" });
    expect(consoleUnauth.status).not.toBe(500);
    expect([302, 303, 307, 308].includes(consoleUnauth.status) || consoleUnauth.status === 200).toBe(true);
  });

  test("logged-in / still shows landing with 控制台 CTA (no redirect to /console)", async () => {
    const email = "landing-authed@example.com";
    await fetch(`${BASE}/api/auth/request-otp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const { magicUrl } = latestFromSink(email);
    const magicRes = await fetch(magicUrl, { redirect: "manual" });
    expect(magicRes.status).toBe(302);
    expect(magicRes.headers.get("location")).toBe("/console");
    const cookie = cookieFromSetCookie(magicRes.headers.get("set-cookie"));
    expect(cookie.includes("webot_session=")).toBe(true);

    const root = await fetch(`${BASE}/`, {
      redirect: "manual",
      headers: { cookie },
    });
    expect(root.status).toBe(200);
    expect([301, 302, 303, 307, 308].includes(root.status)).toBe(false);
    const html = await root.text();
    expect(html).toContain("微信里的 AI 助手");
    expect(html).toContain(">控制台<");
    expect(html).toContain('href="/console"');
    // Logout lives on /console, not AppBar / landing
    expect(html).not.toContain(">退出<");
    expect(html).toContain('aria-label="WeBot 首页"');
    expect(html).toContain('aria-label="切换主题"');
    expect(html).not.toContain(">登录<");
    expect(html).not.toContain('href="/clawbot"');
    expect(html).not.toContain('>邮箱登录</a>');
    expect(html).not.toContain(">黑<");
    expect(html).not.toContain(">白<");

    const consolePage = await fetch(`${BASE}/console`, { headers: { cookie } });
    expect(consolePage.status).toBe(200);
    const consoleHtml = await consolePage.text();
    expect(consoleHtml).toContain(">退出<");
    expect(consoleHtml).toContain("复制绑定命令");
    expect(consoleHtml).toContain("扫码上线");
    expect(consoleHtml).toContain("清空聊天记录");
    expect(consoleHtml).not.toContain('href="/clawbot"');
    expect(consoleHtml).toContain('aria-current="page"');
    expect(consoleHtml).toContain('aria-label="切换主题"');
  });

  test("invalid email on request-otp returns 400 (not 429)", async () => {
    for (const email of ["", "not-an-email", "missing-at", "@nouser.com"]) {
      const res = await fetch(`${BASE}/api/auth/request-otp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error?: string };
      expect(body.error).toMatch(/invalid email/i);
    }
  });

  test("OTP send rate limiting", async () => {
    const email = "ratelimit@example.com";
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await fetch(`${BASE}/api/auth/request-otp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      statuses.push(res.status);
    }
    // 3 allowed per 60s window, 4th should 429
    expect(statuses.filter((s) => s === 200).length).toBeGreaterThanOrEqual(3);
    expect(statuses).toContain(429);
  });

  test("OTP verify lockout after repeated failures", async () => {
    const email = "verify-lockout@example.com";
    await fetch(`${BASE}/api/auth/request-otp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const statuses: number[] = [];
    let locked = false;
    for (let i = 0; i < 8; i++) {
      const res = await fetch(`${BASE}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code: "12345" }),
      });
      statuses.push(res.status);
      if (res.status === 429) {
        const body = (await res.json()) as { retryAfterSec?: number };
        expect(body.retryAfterSec).toBeGreaterThan(0);
        locked = true;
        break;
      }
    }
    expect(statuses.some((s) => s === 400)).toBe(true);
    expect(locked).toBe(true);
  });

  test("bind code reset changes code and clears wechat link", async () => {
    const { cookie, bindCode } = (globalThis as any).__mvp as {
      cookie: string;
      bindCode: string;
    };

    const sqlite = new Database(TMP);
    sqlite
      .query(
        `UPDATE wechat_bindings SET wechat_user_id = ?, status = 'active', bound_at = ? WHERE bind_code = ?`,
      )
      .run("wx-test-user", new Date().toISOString(), bindCode);
    sqlite.close();

    const res = await fetch(`${BASE}/api/binding/reset`, {
      method: "POST",
      headers: { cookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      binding: { bindCode: string; status: string; wechatUserId: string | null };
    };
    expect(data.binding.bindCode).not.toBe(bindCode);
    expect(data.binding.status).toBe("pending");
    expect(data.binding.wechatUserId).toBeNull();
    (globalThis as any).__mvp.bindCode = data.binding.bindCode;
  });

  test("messages persistence via bind activation + API list", async () => {
    const { cookie, bindCode } = (globalThis as any).__mvp as {
      cookie: string;
      bindCode: string;
    };
    const repoRoot = path.join(import.meta.dir, "..");
    const helper = `
import { ensureSchema } from "../src/db/index.ts";
import { activateBindingByCode } from "../src/auth/bindings.ts";
import { insertMessage } from "../src/auth/messages.ts";
ensureSchema();
const r = activateBindingByCode(${JSON.stringify(bindCode)}, "wx-msg-user");
if (!r.ok) throw new Error(r.error);
insertMessage({ userId: r.binding.userId, wechatUserId: "wx-msg-user", role: "user", content: "hello from wechat" });
insertMessage({ userId: r.binding.userId, wechatUserId: "wx-msg-user", role: "assistant", content: "hi back" });
console.log("OK");
`;
    const scriptPath = path.join(import.meta.dir, "_seed_messages_tmp.ts");
    fs.writeFileSync(scriptPath, helper);
    const seed = Bun.spawnSync({
      cmd: ["bun", "run", scriptPath],
      cwd: repoRoot,
      env: { ...process.env, SQLITE_PATH: TMP, SESSION_SECRET: "test-secret-mvp" },
    });
    try {
      fs.unlinkSync(scriptPath);
    } catch {}
    expect(seed.exitCode).toBe(0);

    const list = await fetch(`${BASE}/api/messages`, { headers: { cookie } });
    expect(list.status).toBe(200);
    const body = (await list.json()) as { messages: Array<{ content: string }> };
    const contents = body.messages.map((m) => m.content);
    expect(contents).toContain("hello from wechat");
    expect(contents).toContain("hi back");
  });

  test("POST /api/messages/clear soft-deletes messages for current user only", async () => {
    const { cookie } = (globalThis as any).__mvp as { cookie: string };
    const before = await fetch(`${BASE}/api/messages`, { headers: { cookie } });
    expect(before.status).toBe(200);
    const beforeBody = (await before.json()) as { messages: Array<{ id: string }> };
    expect(beforeBody.messages.length).toBeGreaterThan(0);

    const clear = await fetch(`${BASE}/api/messages/clear`, {
      method: "POST",
      headers: { cookie },
    });
    expect(clear.status).toBe(200);
    const clearBody = (await clear.json()) as { ok: boolean; deleted: number };
    expect(clearBody.ok).toBe(true);
    expect(clearBody.deleted).toBeGreaterThan(0);

    const after = await fetch(`${BASE}/api/messages`, { headers: { cookie } });
    const afterBody = (await after.json()) as { messages: unknown[] };
    expect(afterBody.messages.length).toBe(0);

    // Rows remain with deleted_at (soft delete, not hard delete)
    const sqlite = new Database(TMP);
    const row = sqlite
      .query(`SELECT COUNT(*) AS n FROM messages WHERE deleted_at IS NOT NULL`)
      .get() as { n: number };
    sqlite.close();
    expect(Number(row.n)).toBeGreaterThan(0);
  });
});

describe("cookie Secure flag", () => {
  test("clearSessionCookieHeader includes Secure when COOKIE_SECURE=1", async () => {
    const repoRoot = path.join(import.meta.dir, "..");
    const script = `
process.env.COOKIE_SECURE = "1";
process.env.NODE_ENV = "production";
const { clearSessionCookieHeader, sessionCookieHeader } = await import("../src/auth/session.ts");
const clear = clearSessionCookieHeader();
const set = sessionCookieHeader("tok", new Date(Date.now() + 60000).toISOString());
if (!clear.includes("Secure")) throw new Error("clear missing Secure: " + clear);
if (!set.includes("Secure")) throw new Error("set missing Secure: " + set);
console.log("OK");
`;
    const p = path.join(import.meta.dir, "_cookie_secure_tmp.ts");
    fs.writeFileSync(p, script);
    const r = Bun.spawnSync({ cmd: ["bun", "run", p], cwd: repoRoot });
    try {
      fs.unlinkSync(p);
    } catch {}
    expect(r.exitCode).toBe(0);
    expect(r.stdout.toString()).toContain("OK");
  });
});
