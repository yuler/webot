/**
 * OpenAI-style tool definitions + dispatcher for ClawBot DeepSeek tool calls.
 * Mutating tools respect todosEnabled (list still works when off).
 */

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
    type: "function" as const,
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
    type: "function" as const,
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
    type: "function" as const,
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
    type: "function" as const,
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
    type: "function" as const,
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
];

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
    const remindText = typeof args.remind_at_text === "string" ? args.remind_at_text : "";
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
