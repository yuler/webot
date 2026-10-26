import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { Database } from "bun:sqlite";

const TMP = path.join(import.meta.dir, "..", "data", "test-per-user-claw.sqlite");
const PORT = 3461;
const BASE = `http://127.0.0.1:${PORT}`;
const SINK = path.join(path.dirname(TMP), "otp-per-user-claw.log");

let proc: ReturnType<typeof Bun.spawn> | null = null;

function cookieFromSetCookie(header: string | null): string {
  if (!header) return "";
  return header.split(";")[0]!.trim();
}

function allSetCookie(res: Response): string {
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders.getSetCookie().join("\n");
  }
  return res.headers.get("set-cookie") || "";
}

async function login(email: string): Promise<string> {
  await fetch(`${BASE}/api/auth/request-otp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const deadline = Date.now() + 3000;
  let magicUrl = "";
  while (Date.now() < deadline) {
    if (fs.existsSync(SINK)) {
      const lines = fs.readFileSync(SINK, "utf-8").trim().split("\n").filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        const parts = lines[i]!.split("\t");
        if (parts[1] === email && parts[3]) {
          magicUrl = parts[3]!.replace(/^https?:\/\/[^/]+/, BASE);
          break;
        }
      }
      if (magicUrl) break;
    }
    await Bun.sleep(50);
  }
  expect(magicUrl).toBeTruthy();
  const magicRes = await fetch(magicUrl, { redirect: "manual" });
  expect(magicRes.status).toBe(302);
  const cookie = cookieFromSetCookie(allSetCookie(magicRes));
  expect(cookie).toContain("webot_session=");
  return cookie;
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
      WEBOT_TEST_HOOKS: "1",
      SESSION_SECRET: "test-secret-per-user-claw",
      SQLITE_PATH: TMP,
      PORT: String(PORT),
      HOST: "127.0.0.1",
      PUBLIC_ORIGIN: BASE,
      APP_ORIGIN: BASE,
      OTP_DEV_SINK: SINK,
      NODE_ENV: "test",
      COOKIE_SECURE: "",
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
  throw new Error("per-user claw API did not become ready");
});

afterAll(() => {
  proc?.kill();
  proc = null;
});

describe("per-user ClawBot session isolation", () => {
  test("legacy /status and /qrcode.png are gone", async () => {
    const s = await fetch(`${BASE}/status`);
    expect(s.status).toBe(410);
    const q = await fetch(`${BASE}/qrcode.png`);
    expect(q.status).toBe(410);
  });

  test("/api/bot/status and qrcode require auth", async () => {
    const s = await fetch(`${BASE}/api/bot/status`);
    expect(s.status).toBe(401);
    const q = await fetch(`${BASE}/api/bot/qrcode.png`);
    expect(q.status).toBe(401);
  });

  test("two logged-in users get distinct QR rev and PNG bytes", async () => {
    const cookieA = await login("claw-a@example.com");
    const cookieB = await login("claw-b@example.com");

    const pngA = Buffer.from("PNG-USER-A-BYTES").toString("base64");
    const pngB = Buffer.from("PNG-USER-B-BYTES-DIFFERENT").toString("base64");

    const injA = await fetch(`${BASE}/api/bot/__test/inject-qr`, {
      method: "POST",
      headers: { cookie: cookieA, "content-type": "application/json" },
      body: JSON.stringify({ rev: "rev-a-111", pngBase64: pngA }),
    });
    expect(injA.status).toBe(200);
    const bodyA = (await injA.json()) as { rev: string; hasQr: boolean };
    expect(bodyA.rev).toBe("rev-a-111");
    expect(bodyA.hasQr).toBe(true);

    const injB = await fetch(`${BASE}/api/bot/__test/inject-qr`, {
      method: "POST",
      headers: { cookie: cookieB, "content-type": "application/json" },
      body: JSON.stringify({ rev: "rev-b-222", pngBase64: pngB }),
    });
    expect(injB.status).toBe(200);
    const bodyB = (await injB.json()) as { rev: string; hasQr: boolean };
    expect(bodyB.rev).toBe("rev-b-222");
    expect(bodyB.hasQr).toBe(true);

    const statusA = await fetch(`${BASE}/api/bot/status`, { headers: { cookie: cookieA } });
    const statusB = await fetch(`${BASE}/api/bot/status`, { headers: { cookie: cookieB } });
    const sa = (await statusA.json()) as { rev: string };
    const sb = (await statusB.json()) as { rev: string };
    expect(sa.rev).toBe("rev-a-111");
    expect(sb.rev).toBe("rev-b-222");
    expect(sa.rev).not.toBe(sb.rev);

    const imgA = await fetch(`${BASE}/api/bot/qrcode.png`, { headers: { cookie: cookieA } });
    const imgB = await fetch(`${BASE}/api/bot/qrcode.png`, { headers: { cookie: cookieB } });
    expect(imgA.status).toBe(200);
    expect(imgB.status).toBe(200);
    const bytesA = Buffer.from(await imgA.arrayBuffer());
    const bytesB = Buffer.from(await imgB.arrayBuffer());
    expect(bytesA.toString()).toBe("PNG-USER-A-BYTES");
    expect(bytesB.toString()).toBe("PNG-USER-B-BYTES-DIFFERENT");
    expect(bytesA.equals(bytesB)).toBe(false);
  });

  test("bot_token rows are isolated per userId in SQLite", async () => {
    const repoRoot = path.join(import.meta.dir, "..");
    const script = `
process.env.SQLITE_PATH = ${JSON.stringify(TMP)};
process.env.SESSION_SECRET = "test-secret-per-user-claw";
const { ensureSchema } = await import("../src/db/index.ts");
const { findOrCreateUser } = await import("../src/auth/users.ts");
const { claimBotToken, getClawSession, updateClawSession } = await import("../src/claw/store.ts");
ensureSchema();
const u1 = findOrCreateUser("tok-a@example.com");
const u2 = findOrCreateUser("tok-b@example.com");
claimBotToken(u1.id, "token-AAA", { message: "a ready" });
claimBotToken(u2.id, "token-BBB", { message: "b ready" });
const s1 = getClawSession(u1.id);
const s2 = getClawSession(u2.id);
if (s1?.botToken !== "token-AAA") throw new Error("u1 token overwritten");
if (s2?.botToken !== "token-BBB") throw new Error("u2 token overwritten");
// re-claim same token onto u2 clears u1
claimBotToken(u2.id, "token-AAA", { message: "stolen" });
const s1b = getClawSession(u1.id);
const s2b = getClawSession(u2.id);
if (s1b?.botToken) throw new Error("u1 should lose exclusive token");
if (s2b?.botToken !== "token-AAA") throw new Error("u2 should own token");
console.log("OK");
`;
    const p = path.join(import.meta.dir, "_per_user_token_tmp.ts");
    fs.writeFileSync(p, script);
    const r = Bun.spawnSync({
      cmd: ["bun", "run", p],
      cwd: repoRoot,
      env: { ...process.env, SQLITE_PATH: TMP, SESSION_SECRET: "test-secret-per-user-claw" },
    });
    try {
      fs.unlinkSync(p);
    } catch {}
    expect(r.exitCode).toBe(0);
    expect(r.stdout.toString()).toContain("OK");
  });

  test("POST /api/bot/reset resets credentials and disconnects binding", async () => {
    const cookie = await login("reset-claw@example.com");

    // Inject active session
    const repoRoot = path.join(import.meta.dir, "..");
    const script = `
process.env.SQLITE_PATH = ${JSON.stringify(TMP)};
process.env.SESSION_SECRET = "test-secret-per-user-claw";
const { ensureSchema } = await import("../src/db/index.ts");
const { findOrCreateUser } = await import("../src/auth/users.ts");
const { claimBotToken } = await import("../src/claw/store.ts");
const { ensureBindingForUser, activateBindingByCode } = await import("../src/auth/bindings.ts");
ensureSchema();
const u = findOrCreateUser("reset-claw@example.com");
claimBotToken(u.id, "token-RESET-TEST", { message: "ready" });
const b = ensureBindingForUser(u.id);
activateBindingByCode(b.bindCode, "wx-bound-user");
console.log("INJECTED");
`;
    const p = path.join(import.meta.dir, "_inject_reset_tmp.ts");
    fs.writeFileSync(p, script);
    Bun.spawnSync({
      cmd: ["bun", "run", p],
      cwd: repoRoot,
      env: { ...process.env, SQLITE_PATH: TMP, SESSION_SECRET: "test-secret-per-user-claw" },
    });
    try {
      fs.unlinkSync(p);
    } catch {}

    const statusBefore = await fetch(`${BASE}/api/bot/status`, { headers: { cookie } });
    const sb = (await statusBefore.json()) as { botReady: boolean };
    expect(sb.botReady).toBe(true);

    const bindBefore = await fetch(`${BASE}/api/binding`, { headers: { cookie } });
    const bb = (await bindBefore.json()) as { binding: { status: string; wechatUserId: string | null } };
    expect(bb.binding.status).toBe("active");
    expect(bb.binding.wechatUserId).toBe("wx-bound-user");

    // Call POST /api/bot/reset
    const res = await fetch(`${BASE}/api/bot/reset`, { method: "POST", headers: { cookie } });
    expect(res.status).toBe(200);
    const resetBody = (await res.json()) as { botReady: boolean };
    expect(resetBody.botReady).toBe(false);

    // Verify binding is disconnected
    const bindAfter = await fetch(`${BASE}/api/binding`, { headers: { cookie } });
    const ba = (await bindAfter.json()) as { binding: { status: string; wechatUserId: string | null } };
    expect(ba.binding.status).toBe("disconnected");
    expect(ba.binding.wechatUserId).toBeNull();
  });

  test("first message from unbound user auto-binds to owner", async () => {
    const repoRoot = path.join(import.meta.dir, "..");
    const script = `
process.env.SQLITE_PATH = ${JSON.stringify(TMP)};
process.env.SESSION_SECRET = "test-secret-per-user-claw";
const { ensureSchema } = await import("../src/db/index.ts");
const { findOrCreateUser } = await import("../src/auth/users.ts");
const { ensureBindingForUser, findActiveBindingByWechatUserId, getBindingForUser } = await import("../src/auth/bindings.ts");
const { claimBotToken } = await import("../src/claw/store.ts");

ensureSchema();
const u = findOrCreateUser("autobind@example.com");
claimBotToken(u.id, "tok-autobind");
const b = ensureBindingForUser(u.id);
if (b.wechatUserId !== null) throw new Error("should be unbound initially");

// Simulate the auto-bind logic from handleMessages
let binding = findActiveBindingByWechatUserId("wx-sender-123");
if (!binding || binding.userId !== u.id) {
  const ownerBinding = ensureBindingForUser(u.id);
  if (!ownerBinding.wechatUserId || ownerBinding.status !== "active") {
    const { activateBindingByCode } = await import("../src/auth/bindings.ts");
    const auto = activateBindingByCode(ownerBinding.bindCode, "wx-sender-123");
    if (auto.ok) binding = auto.binding;
  }
}
if (!binding || binding.userId !== u.id || binding.wechatUserId !== "wx-sender-123") {
  throw new Error("auto-bind failed");
}
const fresh = getBindingForUser(u.id);
if (fresh?.status !== "active" || fresh?.wechatUserId !== "wx-sender-123") {
  throw new Error("DB binding state incorrect");
}
console.log("AUTO-BIND OK");
`;
    const p = path.join(import.meta.dir, "_autobind_test_tmp.ts");
    fs.writeFileSync(p, script);
    const r = Bun.spawnSync({
      cmd: ["bun", "run", p],
      cwd: repoRoot,
      env: { ...process.env, SQLITE_PATH: TMP, SESSION_SECRET: "test-secret-per-user-claw" },
    });
    try {
      fs.unlinkSync(p);
    } catch {}
    expect(r.exitCode).toBe(0);
    expect(r.stdout.toString()).toContain("AUTO-BIND OK");
  });
});
