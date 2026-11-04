import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

describe("executeTodoTool", () => {
  test("create/list/complete/reschedule/delete + disabled/unknown", () => {
    const dbPath = path.join(import.meta.dir, "..", "data", "test-todo-tools.sqlite");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    for (const s of ["", "-wal", "-shm"]) {
      try {
        fs.unlinkSync(dbPath + s);
      } catch {}
    }

    const script = `
process.env.SQLITE_PATH = ${JSON.stringify(dbPath)};
process.env.SESSION_SECRET = "todo-tools-unit";
const { ensureSchema } = await import("../src/db/index.ts");
ensureSchema();
const { findOrCreateUser } = await import("../src/auth/users.ts");
const user = findOrCreateUser("todo-tools@example.com");
const { updateTodosSettings } = await import("../src/todos/settings.ts");
const { listTodos, getTodoForUser } = await import("../src/todos/store.ts");
const { executeTodoTool } = await import("../src/todos/tools.ts");

const created = executeTodoTool(user.id, "todos_create", {
  title: "交社保",
  remind_at_text: "明天 9:30",
});
if (!created.ok) throw new Error("create failed: " + created.message);
const listed = executeTodoTool(user.id, "todos_list", {});
if (!listed.ok) throw new Error("list failed");
if (!JSON.stringify(listed.data).includes("交社保")) throw new Error("list missing title");

const milk = executeTodoTool(user.id, "todos_create", { title: "买牛奶" });
if (!milk.ok) throw new Error("milk create failed");
const done = executeTodoTool(user.id, "todos_complete", { title_hint: "牛奶" });
if (!done.ok) throw new Error("complete failed: " + done.message);

const stand = executeTodoTool(user.id, "todos_create", { title: "站会" });
if (!stand.ok) throw new Error("stand create failed");
const standId = stand.data.id;
const res = executeTodoTool(user.id, "todos_reschedule", {
  todo_id: standId,
  remind_at_text: "明天 9:30",
});
if (!res.ok) throw new Error("reschedule failed: " + res.message);
const row = getTodoForUser(user.id, standId);
if (!row?.remindAt) throw new Error("remindAt missing after reschedule");

const merged = executeTodoTool(user.id, "todos_create", { title: "旧合并任务" });
if (!merged.ok) throw new Error("merged create failed");
const del = executeTodoTool(user.id, "todos_delete", { todo_id: merged.data.id });
if (!del.ok) throw new Error("delete failed: " + del.message);
if (listTodos(user.id, { status: "open" }).some((t) => t.id === merged.data.id)) {
  throw new Error("deleted todo still open");
}

updateTodosSettings(user.id, { todosEnabled: false });
const blocked = executeTodoTool(user.id, "todos_create", { title: "不应创建" });
if (blocked.ok) throw new Error("mutate should fail when disabled");

const unknown = executeTodoTool(user.id, "todos_explode", {});
if (unknown.ok) throw new Error("unknown tool should fail");

console.log("OK");
`;
    const scriptPath = path.join(import.meta.dir, "_todo_tools_tmp.ts");
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
