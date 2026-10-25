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
      PUBLIC_ORIGIN: BASE,
      OTP_DEV_SINK: SINK,
      // leave COOKIE_SECURE / NODE_ENV unset for HTTP tests; separate Secure test below
      NODE_ENV: "test",
      COOKIE_SECURE: "",
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
          return { code: parts[2]!, magicUrl: parts[3]! };
        }
      }
    }
    // busy wait briefly
    Bun.sleepSync(50);
  }
  throw new Error(`login email not found for ${email}`);
}

describe("MVP API", () => {
  test("OTP login happy path + binding created", async () => {
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
