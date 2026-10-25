import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { Database } from "bun:sqlite";

const TMP = path.join(import.meta.dir, "..", "data", "test-mvp.sqlite");
const PORT = 3457;
const BASE = `http://127.0.0.1:${PORT}`;

let proc: ReturnType<typeof Bun.spawn> | null = null;
const otpLog: string[] = [];

function cookieFromSetCookie(header: string | null): string {
  if (!header) return "";
  return header.split(";")[0]!.trim();
}

beforeAll(async () => {
  fs.mkdirSync(path.dirname(TMP), { recursive: true });
  try {
    fs.unlinkSync(TMP);
  } catch {}
  for (const s of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(TMP + s);
    } catch {}
  }

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
      OTP_DEV_SINK: path.join(path.dirname(TMP), "otp-test.log"),
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  // drain logs for OTP codes
  (async () => {
    const reader = proc!.stdout.getReader();
    const dec = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = dec.decode(value);
      otpLog.push(text);
      if (text.includes("[mail:dev]")) process.stdout.write(text);
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

  // wait for health
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

function latestOtp(email: string): string {
  const joined = otpLog.join("");
  const re = new RegExp(`OTP for ${email.replace(".", "\\.")}: (\\d{6})`, "g");
  let m: RegExpExecArray | null;
  let last = "";
  while ((m = re.exec(joined))) last = m[1]!;
  if (!last) {
    // also try sink file
    const sink = path.join(path.dirname(TMP), "otp-test.log");
    if (fs.existsSync(sink)) {
      const lines = fs.readFileSync(sink, "utf-8").trim().split("\n");
      for (let i = lines.length - 1; i >= 0; i--) {
        const parts = lines[i]!.split("\t");
        if (parts[1] === email && parts[2]) return parts[2]!;
      }
    }
  }
  if (!last) throw new Error(`OTP not found for ${email}. logs=${joined.slice(-500)}`);
  return last;
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

    await Bun.sleep(150);
    const code = latestOtp(email);

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
    expect(body.email).toBe(email);
    expect(body.binding.bindCode).toMatch(/^WB-/);
    expect(body.binding.status).toBe("pending");

    const cookie = cookieFromSetCookie(verifyRes.headers.get("set-cookie"));
    expect(cookie.startsWith("webot_session=")).toBe(true);

    const me = await fetch(`${BASE}/api/me`, { headers: { cookie } });
    expect(me.status).toBe(200);
    const meBody = (await me.json()) as { user: { email: string }; binding: { bindCode: string } };
    expect(meBody.user.email).toBe(email);
    expect(meBody.binding.bindCode).toBe(body.binding.bindCode);

    // stash for next tests via globalThis
    (globalThis as any).__mvp = { cookie, email, bindCode: body.binding.bindCode };
  });

  test("bind code reset changes code and clears wechat link", async () => {
    const { cookie, bindCode } = (globalThis as any).__mvp as {
      cookie: string;
      bindCode: string;
    };

    // simulate an active bind in DB then reset via API
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
    expect(data.binding.bindCode).toMatch(/^WB-/);
    expect(data.binding.status).toBe("pending");
    expect(data.binding.wechatUserId).toBeNull();

    (globalThis as any).__mvp.bindCode = data.binding.bindCode;
  });

  test("messages persistence via bind activation + API list", async () => {
    const { cookie, bindCode } = (globalThis as any).__mvp as {
      cookie: string;
      bindCode: string;
    };

    // Use library functions in-process against same DB file — server already has schema.
    // Activate bind + insert messages through HTTP-less module with env pointing at TMP.
    process.env.SQLITE_PATH = TMP;
    process.env.SESSION_SECRET = "test-secret-mvp";

    // Dynamic import after env is set — modules may already be cached from other imports.
    // Prefer writing through SQL + then reading via API after activating with auth modules
    // loaded in a subprocess to avoid bun module cache of a different DB path.
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
      env: {
        ...process.env,
        SQLITE_PATH: TMP,
        SESSION_SECRET: "test-secret-mvp",
      },
    });
    try { fs.unlinkSync(scriptPath); } catch {}
    if (seed.exitCode !== 0) {
      console.error(seed.stdout.toString());
      console.error(seed.stderr.toString());
    }
    expect(seed.exitCode).toBe(0);
    expect(seed.stdout.toString()).toContain("OK");

    const list = await fetch(`${BASE}/api/messages`, { headers: { cookie } });
    expect(list.status).toBe(200);
    const body = (await list.json()) as {
      messages: Array<{ role: string; content: string }>;
    };
    const contents = body.messages.map((m) => m.content);
    expect(contents).toContain("hello from wechat");
    expect(contents).toContain("hi back");

    const me = await fetch(`${BASE}/api/me`, { headers: { cookie } });
    const meBody = (await me.json()) as { binding: { status: string; wechatUserId: string | null } };
    expect(meBody.binding.status).toBe("active");
    expect(meBody.binding.wechatUserId).toBe("wx-msg-user");
  });
});
