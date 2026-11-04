# ClawBot Todo Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop WeChat ClawBot free-chat from hallucinating todo mutations by giving DeepSeek real todo tools, while keeping the existing `/todo` + high-confidence NL fast path.

**Architecture:** Keep `handleTodoMessage` before AI. Extend DeepSeek `chat` with OpenAI-compatible tool calling. Add a pure `executeTodoTool` dispatcher over `src/todos/store.ts`. Runtime injects tool defs + anti-hallucination system rules; loops tool_calls until a final text reply (max 4 rounds). `@todo` is normalized to the same intent path as `/todo` before the fast path.

**Tech Stack:** Bun, TypeScript, existing DeepSeek `/chat/completions`, SQLite todos store, `bun test`.

## Global Constraints

- Scope: WeChat ClawBot ↔ WeBot `todos` module only (not Cursor, not `md-todos`).
- Fast path retained: `handleTodoMessage` still runs first and short-circuits on success.
- Tools: `todos_list`, `todos_create`, `todos_complete`, `todos_reschedule`, `todos_delete` only.
- Never claim create/complete/reschedule/delete success unless the matching tool returned `ok: true`.
- Tool-using chat still consumes the normal AI rate limit (same as today’s free chat).
- Single delete may ask confirmation in model text; split/replace may `todos_delete` without extra confirm.
- Keep short open-todo list in `systemExtra` (current behavior).
- `todosEnabled === false`: tools that mutate must return an error payload; list may still succeed (align with slash commands).
- Do **not** git commit unless the user explicitly asks.
- TDD: failing test first for each task; no production code before red.

---

## File map

| File | Responsibility |
|------|----------------|
| `src/todos/tools.ts` (create) | Tool JSON schemas + `executeTodoTool(userId, name, args)` → structured result |
| `src/claw/deepseek.ts` (modify) | `chat` accepts optional `tools` + `executeTool`; tool-call loop; history stores final text only |
| `src/todos/commands.ts` (modify) | Treat `@todo` like `/todo` (strip marker, reuse slash + NL) |
| `src/claw/runtime.ts` (modify) | Pass todo tools into `ds.chat` when module relevant; harden systemExtra anti-hallucination rules |
| `src/todos/tips.ts` (modify) | Add short system rule string for tool honesty |
| `tests/todo-tools.test.ts` (create) | Unit tests for `executeTodoTool` |
| `tests/deepseek-tools.test.ts` (create) | Unit tests for tool-loop with mocked `fetch` |
| `tests/todos.test.ts` or `tests/todo-at-prefix.test.ts` (create/modify) | `@todo` / `/todo` marker normalization |

---

### Task 1: `executeTodoTool` dispatcher

**Files:**
- Create: `src/todos/tools.ts`
- Create: `tests/todo-tools.test.ts`
- Consumes: `listTodos`, `createTodo`, `completeTodo`, `rescheduleReminder`, `softDeleteTodo`, `findOpenTodoByTitleHint`, `getTodoForUser` from `src/todos/store.ts`; `parseRemindAt` from `src/todos/time.ts`; `getTodosSettings` from `src/todos/settings.ts`
- Produces:
  - `TODO_TOOL_DEFINITIONS: OpenAI-style tools array`
  - `type TodoToolName = "todos_list" \| "todos_create" \| "todos_complete" \| "todos_reschedule" \| "todos_delete"`
  - `type TodoToolResult = { ok: boolean; message: string; data?: unknown }`
  - `executeTodoTool(userId: string, name: string, args: Record<string, unknown>): TodoToolResult`

- [ ] **Step 1: Write the failing test**

Create `tests/todo-tools.test.ts` following the subprocess/DB pattern in `tests/todos.test.ts` (dedicated sqlite path via env if the suite uses that; otherwise same isolation style as existing store tests). Minimal cases:

```ts
import { describe, expect, test } from "bun:test";
// After store bootstrap matching todos.test.ts style:
test("todos_create then list returns the todo", () => {
  const created = executeTodoTool(user.id, "todos_create", {
    title: "交社保",
    remind_at_text: "明天 9:30",
  });
  expect(created.ok).toBe(true);
  const listed = executeTodoTool(user.id, "todos_list", {});
  expect(listed.ok).toBe(true);
  expect(JSON.stringify(listed.data)).toContain("交社保");
});

test("todos_delete soft-deletes and list omits it", () => {
  const created = executeTodoTool(user.id, "todos_create", { title: "旧合并任务" });
  const id = (created.data as { id: string }).id;
  const deleted = executeTodoTool(user.id, "todos_delete", { todo_id: id });
  expect(deleted.ok).toBe(true);
  const open = listTodos(user.id, { status: "open" });
  expect(open.find((t) => t.id === id)).toBeUndefined();
});

test("todos_complete by title hint", () => {
  executeTodoTool(user.id, "todos_create", { title: "买牛奶" });
  const done = executeTodoTool(user.id, "todos_complete", { title_hint: "牛奶" });
  expect(done.ok).toBe(true);
});

test("todos_reschedule updates remindAt", () => {
  const created = executeTodoTool(user.id, "todos_create", { title: "站会" });
  const id = (created.data as { id: string }).id;
  const res = executeTodoTool(user.id, "todos_reschedule", {
    todo_id: id,
    remind_at_text: "明天 9:30",
  });
  expect(res.ok).toBe(true);
  const row = getTodoForUser(user.id, id);
  expect(row?.remindAt).toBeTruthy();
});

test("mutate tools fail when todos disabled", () => {
  updateTodosSettings(user.id, { todosEnabled: false });
  const created = executeTodoTool(user.id, "todos_create", { title: "不应创建" });
  expect(created.ok).toBe(false);
});

test("unknown tool name returns ok false", () => {
  expect(executeTodoTool(user.id, "todos_explode", {}).ok).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/todo-tools.test.ts`  
Expected: FAIL (module or `executeTodoTool` missing)

- [ ] **Step 3: Write minimal implementation**

`src/todos/tools.ts`:

```ts
import {
  completeTodo,
  createTodo,
  findOpenTodoByTitleHint,
  getTodoForUser,
  listTodos,
  rescheduleReminder,
  softDeleteTodo,
} from "./store";
import { getTodosSettings } from "./settings";
import { formatAbsoluteZh, parseRemindAt } from "./time";

export type TodoToolResult = { ok: boolean; message: string; data?: unknown };

export const TODO_TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "todos_list",
      description: "List open todos for the bound WeBot user",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "todos_create",
      description: "Create a todo; optional Chinese/English time phrase in remind_at_text",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          remind_at_text: { type: "string", description: "e.g. 明天 9:30" },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "todos_complete",
      description: "Complete an open todo by todo_id or title_hint",
      parameters: {
        type: "object",
        properties: {
          todo_id: { type: "string" },
          title_hint: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "todos_reschedule",
      description: "Set or change remindAt via remind_at_text",
      parameters: {
        type: "object",
        properties: {
          todo_id: { type: "string" },
          title_hint: { type: "string" },
          remind_at_text: { type: "string" },
        },
        required: ["remind_at_text"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "todos_delete",
      description: "Soft-delete a todo (for split/replace or explicit delete)",
      parameters: {
        type: "object",
        properties: {
          todo_id: { type: "string" },
          title_hint: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
] as const;

function resolveTodo(userId: string, args: Record<string, unknown>) {
  const id = typeof args.todo_id === "string" ? args.todo_id.trim() : "";
  if (id) return getTodoForUser(userId, id);
  const hint = typeof args.title_hint === "string" ? args.title_hint : "";
  return findOpenTodoByTitleHint(userId, hint);
}

export function executeTodoTool(
  userId: string,
  name: string,
  args: Record<string, unknown>,
): TodoToolResult {
  const settings = getTodosSettings(userId);

  if (name === "todos_list") {
    const open = listTodos(userId, { status: "open", limit: 20 });
    return {
      ok: true,
      message: open.length ? `open=${open.length}` : "no open todos",
      data: open.map((t) => ({
        id: t.id,
        title: t.title,
        remindAt: t.remindAt,
      })),
    };
  }

  if (!settings.todosEnabled) {
    return { ok: false, message: "todos module disabled; use /todo on" };
  }

  if (name === "todos_create") {
    const title = String(args.title ?? "").trim();
    if (!title) return { ok: false, message: "title required" };
    const remindText =
      typeof args.remind_at_text === "string" ? args.remind_at_text : "";
    const remindAt = remindText ? parseRemindAt(remindText) : null;
    const { todo } = createTodo({
      userId,
      title,
      remindAt,
      source: "wechat",
    });
    return {
      ok: true,
      message: remindAt
        ? `created 「${todo.title}」 remind ${formatAbsoluteZh(remindAt)}`
        : `created 「${todo.title}」 (no remind)`,
      data: { id: todo.id, title: todo.title, remindAt: todo.remindAt },
    };
  }

  if (name === "todos_complete") {
    const hit = resolveTodo(userId, args);
    if (!hit) return { ok: false, message: "todo not found" };
    completeTodo(userId, hit.id);
    return { ok: true, message: `completed 「${hit.title}」`, data: { id: hit.id } };
  }

  if (name === "todos_reschedule") {
    const hit = resolveTodo(userId, args);
    if (!hit) return { ok: false, message: "todo not found" };
    const remindText = String(args.remind_at_text ?? "");
    const remindAt = parseRemindAt(remindText);
    if (!remindAt) return { ok: false, message: "could not parse remind_at_text" };
    rescheduleReminder(userId, hit.id, remindAt);
    return {
      ok: true,
      message: `rescheduled 「${hit.title}」 to ${formatAbsoluteZh(remindAt)}`,
      data: { id: hit.id, remindAt },
    };
  }

  if (name === "todos_delete") {
    const hit = resolveTodo(userId, args);
    if (!hit) return { ok: false, message: "todo not found" };
    softDeleteTodo(userId, hit.id);
    return { ok: true, message: `deleted 「${hit.title}」`, data: { id: hit.id } };
  }

  return { ok: false, message: `unknown tool ${name}` };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/todo-tools.test.ts`  
Expected: PASS

---

### Task 2: DeepSeek tool-call loop

**Files:**
- Modify: `src/claw/deepseek.ts`
- Create: `tests/deepseek-tools.test.ts`
- Consumes: Task 1 result type shape `{ ok, message, data? }` (stringified into tool role content)
- Produces: `chat(userId, prompt, options?: { systemExtra?: string; tools?: unknown[]; executeTool?: (name: string, args: Record<string, unknown>) => TodoToolResult | Promise<TodoToolResult>; maxToolRounds?: number })`

- [ ] **Step 1: Write the failing test**

`tests/deepseek-tools.test.ts` — mock global `fetch` to return one assistant message with `tool_calls`, then a final text message:

```ts
import { describe, expect, test } from "bun:test";
import { DeepSeekBot } from "../src/claw/deepseek";

test("chat executes tool_calls then returns final assistant text", async () => {
  const calls: unknown[] = [];
  let round = 0;
  globalThis.fetch = (async (_url: any, init?: any) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    round++;
    if (round === 1) {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: "call_1",
                    type: "function",
                    function: {
                      name: "todos_list",
                      arguments: "{}",
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({
        choices: [{ message: { role: "assistant", content: "当前没有未完成待办。" } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as any;

  const bot = new DeepSeekBot("test-key", "https://example.test", "deepseek-chat");
  const executed: string[] = [];
  const reply = await bot.chat("u1", "看看待办", {
    tools: [{ type: "function", function: { name: "todos_list", parameters: { type: "object", properties: {} } } }],
    executeTool: (name) => {
      executed.push(name);
      return { ok: true, message: "no open todos", data: [] };
    },
  });

  expect(executed).toEqual(["todos_list"]);
  expect(reply).toBe("当前没有未完成待办。");
  expect(calls.length).toBe(2);
  const second = calls[1] as { messages: Array<{ role: string }> };
  expect(second.messages.some((m) => m.role === "tool")).toBe(true);
});

test("chat without tools keeps single-shot behavior", async () => {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ choices: [{ message: { content: "你好" } }] }),
      { status: 200 },
    )) as any;
  const bot = new DeepSeekBot("test-key", "https://example.test");
  expect(await bot.chat("u2", "hi")).toBe("你好");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/deepseek-tools.test.ts`  
Expected: FAIL (`tools` / `executeTool` ignored or type error)

- [ ] **Step 3: Write minimal implementation**

In `DeepSeekBot.chat`:

1. Extend message type locally to allow `tool_calls` / `tool_call_id` / `role: "tool"`.
2. If `options.tools?.length` and `options.executeTool`:
   - Include `tools` + `tool_choice: "auto"` in request body.
   - Loop up to `maxToolRounds ?? 4`:
     - If assistant message has `tool_calls`, for each call: `JSON.parse(arguments)`, run `executeTool`, append assistant msg + tool msgs (`role: "tool"`, `tool_call_id`, `content: JSON.stringify(result)`), continue loop.
     - Else take `content` as reply, break.
3. On history: push only the user prompt + **final** assistant text (same 6-message trim as today). Do not persist raw tool transcripts into `histories` (keeps WeChat memory small; matches “todo UX structured” preference).
4. If rounds exhausted with only tool_calls: return `⚠️ 待办工具调用轮次过多，请用 /todo list 重试。`
5. Parse args safely: invalid JSON → tool result `{ ok: false, message: "invalid arguments JSON" }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/deepseek-tools.test.ts`  
Expected: PASS

---

### Task 3: `@todo` marker + wire runtime

**Files:**
- Modify: `src/todos/commands.ts` — normalize `@todo` / `/todo` at start of `handleTodoMessage`
- Modify: `src/todos/tips.ts` — add `TODOS_TOOLS_SYSTEM` honesty rules
- Modify: `src/claw/runtime.ts` — pass tools when `todosEnabled` (and still inject open list); always pass tools when enabled so free-chat mutations work
- Create: `tests/todo-at-prefix.test.ts` (or extend `tests/todos.test.ts`)

- [ ] **Step 1: Write the failing tests**

```ts
test("handleTodoMessage treats @todo list like /todo list", async () => {
  // create one open todo via store…
  const r = await handleTodoMessage(user.id, "@todo list");
  expect(r.handled).toBe(true);
  if (r.handled) expect(r.reply).toMatch(/未完成待办|没有未完成/);
});

test("handleTodoMessage strips @todo then NL create still works if heuristics match", async () => {
  const r = await handleTodoMessage(user.id, "@todo 明天下午3点提醒我交社保");
  expect(r.handled).toBe(true);
});
```

Also add a small unit assertion that `TODOS_TOOLS_SYSTEM` forbids claiming success without tool results (string contains 禁止 or 不得 / tool).

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/todo-at-prefix.test.ts`  
Expected: FAIL (`@todo list` not handled)

- [ ] **Step 3: Implement normalization + runtime wiring**

In `handleTodoMessage` (top):

```ts
let text = rawText.trim();
// Intent markers: /todo and @todo (case-insensitive, word boundary / whitespace)
text = text.replace(/^[@/]todo\b/i, "/todo").trim();
// If user wrote "@todo list" → "/todo list"
// If user wrote "@todo 提醒我…" → "/todo 提醒我…" which slash shorthand may create;
// if that is wrong for pure NL after marker, prefer:
//   - if rest starts with known verb → keep as /todo …
//   - else strip to rest and run NL only
```

Preferred normalization logic (exact):

```ts
export function normalizeTodoIntentMarker(text: string): string {
  const trimmed = text.trim();
  const m = trimmed.match(/^[@/]todo\b([:\s]|$)/i);
  if (!m) return trimmed;
  const rest = trimmed.slice(m[0].length).trim();
  if (!rest) return "/todo";
  // If rest already a slash subcommand style, prefix /todo
  if (/^(add|list|ls|done|complete|on|off|help|\?|帮助|开启|关闭|创建|完成|列表)\b/i.test(rest)) {
    return `/todo ${rest}`;
  }
  // Otherwise keep natural language body (no forced /todo shorthand create)
  return rest;
}
```

Then `handleTodoMessage` uses `normalizeTodoIntentMarker(text)` before slash/NL.

`TODOS_TOOLS_SYSTEM` in `tips.ts`:

```ts
export const TODOS_TOOLS_SYSTEM =
  "【待办写操作规则】你可以通过 tools 操作待办（list/create/complete/reschedule/delete）。" +
  "禁止在未收到对应 tool 且 ok=true 的结果前声称已创建、已完成、已改期或已删除。" +
  "无 /todo·@todo 标记时仅在用户有明确动词（提醒我/记一下/完成/改成/拆开/列出/删除等）时才调用写工具；暧昧时先问一句确认。" +
  "单条删除可先确认；用户明确要求拆分/替换旧待办时可直接 delete 旧条并 create 新条。";
```

In `runtime.ts` where `ds.chat` is called:

```ts
import { TODO_TOOL_DEFINITIONS, executeTodoTool } from "../todos/tools";
import { TODOS_TIPS_SYSTEM, TODOS_TOOLS_SYSTEM } from "../todos/tips";

// when todosSettings.todosEnabled:
systemExtra = TODOS_TIPS_SYSTEM + "\n" + TODOS_TOOLS_SYSTEM + /* existing support blurb + open list */;

const reply = await ds.chat(fromUser, text, {
  systemExtra,
  tools: todosSettings.todosEnabled ? [...TODO_TOOL_DEFINITIONS] : undefined,
  executeTool: todosSettings.todosEnabled
    ? (name, args) => executeTodoTool(binding.userId, name, args)
    : undefined,
});
```

When todos disabled, keep today’s list-only `systemExtra` behavior without tools (or omit tools). Fast path unchanged above this block.

- [ ] **Step 4: Run targeted tests**

Run: `bun test tests/todo-at-prefix.test.ts tests/todo-tools.test.ts tests/deepseek-tools.test.ts tests/todos.test.ts`  
Expected: PASS

- [ ] **Step 5: Full suite**

Run: `bun test tests`  
Expected: PASS

---

## Spec coverage check

| Spec point | Task |
|------------|------|
| ClawBot only / WeBot todos module | Task 3 runtime wire |
| `/todo` + `@todo` intent markers | Task 3 normalize |
| Context intent via model + conservative copy | Task 3 `TODOS_TOOLS_SYSTEM` |
| Keep fast path | Task 3 (no removal of `handleTodoMessage`) |
| Tools list/create/complete/reschedule/delete | Task 1 |
| Anti-hallucination hard rule | Task 3 system string + Task 2 real execution |
| Rate limit unchanged for tool chat | Task 3 (tools only inside existing post-limit `chat`) |
| Keep open list in systemExtra | Task 3 |
| No unsolicited commits | Global constraint |

## Placeholder scan

None intentional. Test DB bootstrap in Task 1 must copy the concrete pattern from `tests/todos.test.ts` (env `DATABASE_PATH` / subprocess) when implementing — open that file and mirror it rather than inventing a third harness.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-05-clawbot-todo-tools.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute in this session with executing-plans checkpoints  

Which approach?
