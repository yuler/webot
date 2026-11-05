import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { parseRemindAt, shanghaiWallToIso, stripTimePhrases, formatAbsoluteZh } from "../src/todos/time";
import {
  PROACTIVE_QUOTA_HEURISTIC,
  PROACTIVE_WINDOW_MS,
  TODOS_TIPS_SHORT,
} from "../src/todos/tips";
import {
  stopTodosReminderScheduler,
  isTodosReminderSchedulerRunning,
  startTodosReminderScheduler,
} from "../src/todos/reminders";

describe("todos time parse", () => {
  test("parses 明天 HH:mm into Asia/Shanghai absolute", () => {
    const now = new Date("2026-11-04T02:00:00.000Z"); // 10:00 CST
    const iso = parseRemindAt("明天 9:30 提醒我交社保", now);
    expect(iso).toBeTruthy();
    // 2026-11-05 09:30 CST = 2026-11-05 01:30 UTC
    expect(iso!.startsWith("2026-11-05T01:30")).toBe(true);
    expect(formatAbsoluteZh(iso!)).toContain("09");
  });

  test("parses relative 分钟后", () => {
    const now = new Date("2026-11-04T12:00:00.000Z");
    const iso = parseRemindAt("10分钟后提醒我站起来", now);
    expect(iso).toBe(new Date(now.getTime() + 10 * 60_000).toISOString());
  });

  test("stripTimePhrases leaves title", () => {
    expect(stripTimePhrases("明天 9:00 提醒我交社保")).toContain("交社保");
  });

  test("shanghaiWallToIso roundtrip morning", () => {
    const iso = shanghaiWallToIso(2026, 11, 5, 9, 0, 0);
    expect(iso).toBe("2026-11-05T01:00:00.000Z");
  });
});

describe("todos tips + constants", () => {
  test("tips mention heuristic window and quota", () => {
    expect(TODOS_TIPS_SHORT).toMatch(/24/);
    expect(TODOS_TIPS_SHORT).toMatch(/10/);
    expect(TODOS_TIPS_SHORT).toMatch(/启发式|非精确/);
    expect(PROACTIVE_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
    expect(PROACTIVE_QUOTA_HEURISTIC).toBe(10);
  });
});

describe("todos reminder scheduler lifecycle", () => {
  afterEach(() => {
    stopTodosReminderScheduler();
  });

  test("start/stop ticker", () => {
    expect(isTodosReminderSchedulerRunning()).toBe(false);
    const ctl = startTodosReminderScheduler({ intervalMs: 60_000 });
    expect(isTodosReminderSchedulerRunning()).toBe(true);
    ctl.stop();
    expect(isTodosReminderSchedulerRunning()).toBe(false);
  });
});

/**
 * Store / settings / commands need a dedicated SQLITE_PATH before importing db.
 * Spawn a child so the singleton db binds to an isolated file.
 */
describe("todos store + settings + commands (subprocess)", () => {
  test("default enabled, create with remind, catchup flag, NL command", () => {
    const dbPath = path.join(import.meta.dir, "..", "data", "test-todos-unit.sqlite");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    for (const s of ["", "-wal", "-shm"]) {
      try {
        fs.unlinkSync(dbPath + s);
      } catch {}
    }

    const script = `
process.env.SQLITE_PATH = ${JSON.stringify(dbPath)};
process.env.SESSION_SECRET = "todos-unit";
const { ensureSchema } = await import("../src/db/index.ts");
ensureSchema();
const { findOrCreateUser } = await import("../src/auth/users.ts");
const user = findOrCreateUser("todos-unit@example.com");
const { getTodosSettings, recordUserInbound, canSendProactive, bumpProactiveSent, updateTodosSettings } = await import("../src/todos/settings.ts");
const { createTodo, listTodos, listCatchupCandidates, markReminder, completeTodo, updateTodo } = await import("../src/todos/store.ts");
const { handleTodoMessage } = await import("../src/todos/commands.ts");
const { PROACTIVE_QUOTA_HEURISTIC } = await import("../src/todos/tips.ts");

const settings0 = getTodosSettings(user.id);
if (settings0.todosEnabled !== true) throw new Error("todos should default ON");

const remindAt = new Date(Date.now() - 60_000).toISOString();
const { todo, reminder } = createTodo({ userId: user.id, title: "交社保", remindAt, source: "wechat" });
if (!reminder) throw new Error("expected reminder row");
if (listTodos(user.id, { status: "open" }).length !== 1) throw new Error("expected 1 open todo");

// Without inbound window → cannot send
let gate = canSendProactive(user.id);
if (gate.ok) throw new Error("expected no_window before inbound");

recordUserInbound(user.id, { wechatUserId: "wx-test", contextToken: "ctx-1" });
gate = canSendProactive(user.id);
if (!gate.ok) throw new Error("expected ok after inbound: " + gate.reason);

// Simulate skipped_window then catchup candidate
markReminder(reminder.id, { status: "skipped_window", skipReason: "no_window" });
const catchups = listCatchupCandidates(user.id);
if (catchups.length !== 1 || catchups[0].id !== reminder.id) throw new Error("catchup candidate missing");

// Quota heuristic
for (let i = 0; i < PROACTIVE_QUOTA_HEURISTIC; i++) bumpProactiveSent(user.id);
gate = canSendProactive(user.id);
if (gate.ok || gate.reason !== "quota") throw new Error("expected quota gate");

// NL create
updateTodosSettings(user.id, { proactiveSentInWindow: 0 });
const nl = await handleTodoMessage(user.id, "明天 10:00 提醒我买牛奶");
if (!nl.handled) throw new Error("NL should handle");
if (!nl.reply.includes("买牛奶")) throw new Error("reply should confirm title");
if (!nl.reply.includes("10")) throw new Error("reply should confirm absolute time");
if (!nl.reply.includes("24")) throw new Error("reply should include tips");

// Inline update todo title
const updated = updateTodo(user.id, todo.id, { title: "交医保和社保" });
if (!updated || updated.title !== "交医保和社保") throw new Error("updateTodo title failed");

const done = await handleTodoMessage(user.id, "/todo done 交医保和社保");
if (!done.handled || !done.reply.includes("完成")) throw new Error("done failed");
if (completeTodo(user.id, todo.id)?.status !== "done" && listTodos(user.id, { status: "open" }).some(t => t.id === todo.id)) {
  throw new Error("todo should be done");
}

const off = await handleTodoMessage(user.id, "/todo off");
if (!off.handled) throw new Error("off failed");
if (getTodosSettings(user.id).todosEnabled !== false) throw new Error("should be disabled");

console.log("OK");
`;
    const scriptPath = path.join(import.meta.dir, "_todos_unit_tmp.ts");
    fs.writeFileSync(scriptPath, script);
    const r = Bun.spawnSync({
      cmd: ["bun", "run", scriptPath],
      cwd: path.join(import.meta.dir, ".."),
      env: { ...process.env, SQLITE_PATH: dbPath },
    });
    try {
      fs.unlinkSync(scriptPath);
    } catch {}
    if (r.exitCode !== 0) {
      console.error(r.stderr.toString());
      console.error(r.stdout.toString());
    }
    expect(r.exitCode).toBe(0);
    expect(r.stdout.toString()).toContain("OK");
  });

  test("disabled keeps reminder pending; slash/API writes rejected", () => {
    const dbPath = path.join(import.meta.dir, "..", "data", "test-todos-disabled.sqlite");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    for (const s of ["", "-wal", "-shm"]) {
      try {
        fs.unlinkSync(dbPath + s);
      } catch {}
    }

    const port = 3467;
    const script = `
process.env.SQLITE_PATH = ${JSON.stringify(dbPath)};
process.env.SESSION_SECRET = "todos-disabled-unit";
process.env.WEBOT_SKIP_BOT = "1";
process.env.PORT = String(${port});
process.env.HOST = "127.0.0.1";
process.env.NODE_ENV = "test";
process.env.COOKIE_SECURE = "";
process.env.SMTP_ADDRESS = "";
process.env.SMTP_USERNAME = "";
process.env.SMTP_PASSWORD = "";
process.env.RESEND_API_KEY = "";

const { ensureSchema } = await import("../src/db/index.ts");
ensureSchema();
const { findOrCreateUser } = await import("../src/auth/users.ts");
const user = findOrCreateUser("todos-disabled@example.com");
const { updateTodosSettings, getTodosSettings } = await import("../src/todos/settings.ts");
const { createTodo, listDuePendingReminders } = await import("../src/todos/store.ts");
const { handleTodoMessage } = await import("../src/todos/commands.ts");
const { processDueReminders } = await import("../src/todos/reminders.ts");
const { createSession, SESSION_COOKIE } = await import("../src/auth/session.ts");
const { startApiServer } = await import("../src/api.ts");

const past = new Date(Date.now() - 120_000).toISOString();
const { todo, reminder } = createTodo({
  userId: user.id,
  title: "关掉后仍应待推",
  remindAt: past,
  source: "wechat",
});
if (!reminder) throw new Error("expected reminder");

updateTodosSettings(user.id, { todosEnabled: false });
if (getTodosSettings(user.id).todosEnabled !== false) throw new Error("should be off");

const before = listDuePendingReminders(new Date().toISOString());
if (!before.some((r) => r.id === reminder.id && r.status === "pending")) {
  throw new Error("reminder should still be pending before tick");
}

await processDueReminders(new Date());
const after = listDuePendingReminders(new Date().toISOString());
const still = after.find((r) => r.id === reminder.id);
if (!still || still.status !== "pending") {
  throw new Error("disabled tick must keep reminder pending, got " + JSON.stringify(still));
}

const addOff = await handleTodoMessage(user.id, "/todo add 不应创建");
if (!addOff.handled || !addOff.reply.includes("关闭")) {
  throw new Error("slash add while off should refuse: " + JSON.stringify(addOff));
}
const doneOff = await handleTodoMessage(user.id, "/todo done 关掉后");
if (!doneOff.handled || !doneOff.reply.includes("关闭")) {
  throw new Error("slash done while off should refuse: " + JSON.stringify(doneOff));
}
const listOff = await handleTodoMessage(user.id, "/todo list");
if (!listOff.handled) throw new Error("list while off should still work");

const openBefore = (await import("../src/todos/store.ts")).listTodos(user.id, { status: "open" });
const openCount = openBefore.length;

const { token } = createSession(user.id);
const server = startApiServer();
const cookie = SESSION_COOKIE + "=" + encodeURIComponent(token);
const postRes = await fetch("http://127.0.0.1:" + ${port} + "/api/todos", {
  method: "POST",
  headers: { cookie, "content-type": "application/json" },
  body: JSON.stringify({ title: "API不应创建" }),
});
if (postRes.status !== 403) {
  throw new Error("API POST while off expected 403, got " + postRes.status + " " + (await postRes.text()));
}
const body = await postRes.json();
if (body.code !== "todos_disabled") throw new Error("expected todos_disabled code");

const completeRes = await fetch(
  "http://127.0.0.1:" + ${port} + "/api/todos/" + encodeURIComponent(todo.id) + "/complete",
  { method: "POST", headers: { cookie } },
);
if (completeRes.status !== 403) {
  throw new Error("API complete while off expected 403, got " + completeRes.status);
}

const getRes = await fetch("http://127.0.0.1:" + ${port} + "/api/todos", {
  headers: { cookie },
});
if (!getRes.ok) throw new Error("GET list while off should work, got " + getRes.status);

const openAfter = (await import("../src/todos/store.ts")).listTodos(user.id, { status: "open" });
if (openAfter.length !== openCount) throw new Error("no new todos should be created while off");

server.stop();
console.log("OK");
`;
    const scriptPath = path.join(import.meta.dir, "_todos_disabled_tmp.ts");
    fs.writeFileSync(scriptPath, script);
    const r = Bun.spawnSync({
      cmd: ["bun", "run", scriptPath],
      cwd: path.join(import.meta.dir, ".."),
      env: { ...process.env, SQLITE_PATH: dbPath },
    });
    try {
      fs.unlinkSync(scriptPath);
    } catch {}
    if (r.exitCode !== 0) {
      console.error(r.stderr.toString());
      console.error(r.stdout.toString());
    }
    expect(r.exitCode).toBe(0);
    expect(r.stdout.toString()).toContain("OK");
  });
});

describe("ensureSchema creates todos tables", () => {
  test("fresh db has todos + user_module_settings", () => {
    const dbPath = path.join(import.meta.dir, "..", "data", "test-todos-schema.sqlite");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    for (const s of ["", "-wal", "-shm"]) {
      try {
        fs.unlinkSync(dbPath + s);
      } catch {}
    }
    const script = `
process.env.SQLITE_PATH = ${JSON.stringify(dbPath)};
const { ensureSchema, sqlite } = await import("../src/db/index.ts");
ensureSchema();
for (const name of ["user_module_settings", "todos", "todo_reminders"]) {
  const row = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
  if (!row) throw new Error("missing table " + name);
}
const cols = sqlite.prepare("PRAGMA table_info(user_module_settings)").all();
if (!cols.some((c) => c.name === "todos_enabled")) throw new Error("todos_enabled missing");
console.log("OK");
`;
    const scriptPath = path.join(import.meta.dir, "_todos_schema_tmp.ts");
    fs.writeFileSync(scriptPath, script);
    const r = Bun.spawnSync({
      cmd: ["bun", "run", scriptPath],
      cwd: path.join(import.meta.dir, ".."),
      env: { ...process.env, SQLITE_PATH: dbPath },
    });
    try {
      fs.unlinkSync(scriptPath);
    } catch {}
    expect(r.exitCode).toBe(0);
    expect(r.stdout.toString()).toContain("OK");
  });
});
