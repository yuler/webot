import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import {
  extractJsonObject,
  parseTodoSplitPayload,
  splitUtteranceIntoTodos,
  TODO_SEMANTIC_SPLIT_MAX,
} from "../src/todos/semantic-split";

describe("todo semantic-split parsing", () => {
  test("extractJsonObject tolerates fences and prose", () => {
    expect(extractJsonObject('{"todos":[{"title":"A","remindAtText":null}]}')).toEqual({
      todos: [{ title: "A", remindAtText: null }],
    });
    expect(
      extractJsonObject('```json\n{"todos":[{"title":"B","remindAtText":"明天9点"}]}\n```'),
    ).toEqual({ todos: [{ title: "B", remindAtText: "明天9点" }] });
    expect(extractJsonObject('here: {"todos":[]} thanks')).toEqual({ todos: [] });
    expect(extractJsonObject("not json")).toBeNull();
  });

  test("parseTodoSplitPayload validates, trims, caps", () => {
    expect(parseTodoSplitPayload(null)).toEqual([]);
    expect(parseTodoSplitPayload({ todos: "x" })).toEqual([]);
    expect(
      parseTodoSplitPayload({
        todos: [
          { title: "  交社保  ", remindAtText: "明天 9:00" },
          { title: "", remindAtText: null },
          { title: "买牛奶", remindAtText: "null" },
          { nope: true },
        ],
      }),
    ).toEqual([
      { title: "交社保", remindAtText: "明天 9:00" },
      { title: "买牛奶", remindAtText: null },
    ]);

    const many = {
      todos: Array.from({ length: TODO_SEMANTIC_SPLIT_MAX + 3 }, (_, i) => ({
        title: `t${i}`,
        remindAtText: null,
      })),
    };
    expect(parseTodoSplitPayload(many)).toHaveLength(TODO_SEMANTIC_SPLIT_MAX);
  });

  test("splitUtteranceIntoTodos returns null on completer fail / empty", async () => {
    expect(await splitUtteranceIntoTodos("x", async () => null)).toBeNull();
    expect(await splitUtteranceIntoTodos("x", async () => '{"todos":[]}')).toBeNull();
    expect(
      await splitUtteranceIntoTodos("x", async () => {
        throw new Error("boom");
      }),
    ).toBeNull();
    const ok = await splitUtteranceIntoTodos("提醒我买奶", async () =>
      JSON.stringify({ todos: [{ title: "买奶", remindAtText: null }] }),
    );
    expect(ok).toEqual([{ title: "买奶", remindAtText: null }]);
  });
});

describe("todo NL semantic multi-create (subprocess)", () => {
  test("multi → N; single → 1; LLM fail → heuristic; disabled skips", () => {
    const dbPath = path.join(import.meta.dir, "..", "data", "test-todo-semantic.sqlite");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    for (const s of ["", "-wal", "-shm"]) {
      try {
        fs.unlinkSync(dbPath + s);
      } catch {}
    }

    const script = `
process.env.SQLITE_PATH = ${JSON.stringify(dbPath)};
process.env.SESSION_SECRET = "todo-semantic";
const { ensureSchema } = await import("../src/db/index.ts");
ensureSchema();
const { findOrCreateUser } = await import("../src/auth/users.ts");
const user = findOrCreateUser("todo-semantic@example.com");
const { handleTodoMessage } = await import("../src/todos/commands.ts");
const { listTodos } = await import("../src/todos/store.ts");
const { updateTodosSettings } = await import("../src/todos/settings.ts");

const multiFake = async () =>
  JSON.stringify({
    todos: [
      { title: "控制台加 build info（构建时间+git hash）", remindAtText: "早上" },
      { title: "登录后外部端能看待办", remindAtText: null },
    ],
  });

const sample =
  "早上把 webot 更新一下：控制台加 build info（构建时间+git hash），以及登录后外部端能看待办";
const multi = await handleTodoMessage(user.id, sample, { completeJson: multiFake });
if (!multi.handled) throw new Error("multi should handle");
if (!multi.reply.includes("2 条")) throw new Error("should say 2 todos: " + multi.reply);
if (!multi.reply.includes("build info") || !multi.reply.includes("外部端")) {
  throw new Error("reply should confirm both titles: " + multi.reply);
}
if (!multi.reply.includes("24")) throw new Error("tips once: " + multi.reply);
const open1 = listTodos(user.id, { status: "open" });
if (open1.length !== 2) throw new Error("expected 2 open, got " + open1.length);

const singleFake = async () =>
  JSON.stringify({ todos: [{ title: "买牛奶", remindAtText: "明天 10:00" }] });
const single = await handleTodoMessage(user.id, "明天 10:00 提醒我买牛奶和面包啊其实只要牛奶", {
  completeJson: singleFake,
});
if (!single.handled || !single.reply.includes("买牛奶")) throw new Error("single failed: " + JSON.stringify(single));
if (single.reply.includes("条待办")) throw new Error("single should not use multi header");
const open2 = listTodos(user.id, { status: "open" });
if (open2.length !== 3) throw new Error("expected 3 open after single, got " + open2.length);

const beforeFail = listTodos(user.id, { status: "open" }).length;
const fail = await handleTodoMessage(user.id, "明天 9:00 提醒我交社保", {
  completeJson: async () => null,
});
if (!fail.handled || !fail.reply.includes("交社保")) {
  throw new Error("LLM fail should heuristic fallback: " + JSON.stringify(fail));
}
const afterFail = listTodos(user.id, { status: "open" }).length;
if (afterFail !== beforeFail + 1) throw new Error("heuristic should create 1");

// slash stays single / no completer call
let slashCalled = false;
const slash = await handleTodoMessage(user.id, "/todo add 只要一条 明天 8:00", {
  completeJson: async () => {
    slashCalled = true;
    return JSON.stringify({ todos: [{ title: "不应走语义", remindAtText: null }] });
  },
});
if (!slash.handled || slashCalled) throw new Error("slash must not call completer");
if (!slash.reply.includes("只要一条")) throw new Error("slash add broken");

updateTodosSettings(user.id, { todosEnabled: false });
const openBeforeOff = listTodos(user.id, { status: "open" }).length;
const off = await handleTodoMessage(user.id, sample, { completeJson: multiFake });
if (off.handled) throw new Error("disabled module must skip NL create, got " + JSON.stringify(off));
if (listTodos(user.id, { status: "open" }).length !== openBeforeOff) {
  throw new Error("disabled must not create");
}

console.log("OK");
`;
    const scriptPath = path.join(import.meta.dir, "_todo_semantic_tmp.ts");
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
