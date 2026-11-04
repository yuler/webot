import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { TODOS_TOOLS_SYSTEM } from "../src/todos/tips";
import { normalizeTodoIntentMarker } from "../src/todos/commands";

describe("todo intent markers", () => {
  test("TODOS_TOOLS_SYSTEM forbids success without tool ok", () => {
    expect(TODOS_TOOLS_SYSTEM).toMatch(/禁止/);
    expect(TODOS_TOOLS_SYSTEM).toMatch(/tool/i);
  });

  test("normalizeTodoIntentMarker maps @todo verbs to /todo", () => {
    expect(normalizeTodoIntentMarker("@todo list")).toBe("/todo list");
    expect(normalizeTodoIntentMarker("@todo")).toBe("/todo");
    expect(normalizeTodoIntentMarker("随便聊聊")).toBe("随便聊聊");
  });

  test("handleTodoMessage treats @todo list and NL after @todo", () => {
    const dbPath = path.join(import.meta.dir, "..", "data", "test-todo-at-prefix.sqlite");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    for (const s of ["", "-wal", "-shm"]) {
      try {
        fs.unlinkSync(dbPath + s);
      } catch {}
    }

    const script = `
process.env.SQLITE_PATH = ${JSON.stringify(dbPath)};
process.env.SESSION_SECRET = "todo-at-prefix";
const { ensureSchema } = await import("../src/db/index.ts");
ensureSchema();
const { findOrCreateUser } = await import("../src/auth/users.ts");
const user = findOrCreateUser("todo-at@example.com");
const { createTodo } = await import("../src/todos/store.ts");
const { handleTodoMessage } = await import("../src/todos/commands.ts");

createTodo({ userId: user.id, title: "已有任务", source: "wechat" });
const list = await handleTodoMessage(user.id, "@todo list");
if (!list.handled) throw new Error("@todo list should handle");
if (!/未完成待办|没有未完成/.test(list.reply)) throw new Error("bad list reply: " + list.reply);

const nl = await handleTodoMessage(user.id, "@todo 明天下午3点提醒我交社保");
if (!nl.handled) throw new Error("@todo NL should handle");
if (!nl.reply.includes("交社保")) throw new Error("NL reply missing title");

console.log("OK");
`;
    const scriptPath = path.join(import.meta.dir, "_todo_at_prefix_tmp.ts");
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
    if (r.exitCode !== 0) {
      console.error(r.stderr.toString());
      console.error(r.stdout.toString());
    }
  });
});
