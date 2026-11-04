/**
 * WeChat `/todo` light commands + heuristic / semantic NL intents for 待办.
 * Recurrence is v1 single-shot only.
 */

import {
  completeTodo,
  createTodo,
  findOpenTodoByTitleHint,
  listTodos,
  rescheduleReminder,
} from "./store";
import { getTodosSettings, updateTodosSettings } from "./settings";
import { formatAbsoluteZh, parseRemindAt, stripTimePhrases } from "./time";
import { TODOS_TIPS_SHORT } from "./tips";
import {
  type JsonCompleter,
  type TodoSplitItem,
  splitUtteranceIntoTodos,
} from "./semantic-split";

export type TodoCommandResult = { handled: true; reply: string } | { handled: false };

export type TodoCommandOptions = {
  /** Injected one-shot JSON completer for NL semantic multi-todo split. */
  completeJson?: JsonCompleter;
};

function helpText(): string {
  return (
    "待办用法：\n" +
    "· /todo add 标题 [明天 9:00]\n" +
    "· /todo list\n" +
    "· /todo done 标题关键字\n" +
    "· /todo on | /todo off\n" +
    "也可以直接说：「明天下午3点提醒我交社保」\n\n" +
    TODOS_TIPS_SHORT
  );
}

function listText(userId: string): string {
  const open = listTodos(userId, { status: "open", limit: 20 });
  if (!open.length) return "当前没有未完成的待办。可以说「提醒我…」或 /todo add … 来创建。";
  const lines = open.map((t, i) => {
    const when = t.remindAt ? ` · ${formatAbsoluteZh(t.remindAt)}` : "";
    return `${i + 1}. ${t.title}${when}`;
  });
  return `未完成待办（${open.length}）：\n${lines.join("\n")}`;
}

function createWithConfirm(
  userId: string,
  title: string,
  remindAt: string | null,
  source: "wechat" = "wechat",
): string {
  const clean = title.trim() || "未命名待办";
  const { todo } = createTodo({
    userId,
    title: clean,
    remindAt,
    source,
  });
  if (remindAt) {
    const abs = formatAbsoluteZh(remindAt);
    return (
      `✅ 已创建待办「${todo.title}」\n` +
      `提醒时间：${abs}（请核对；不对可以说「改成…」）\n\n` +
      TODOS_TIPS_SHORT
    );
  }
  return `✅ 已创建待办「${todo.title}」（未设置提醒）。可用「明天 9 点提醒我 ${todo.title}」补提醒。`;
}

function createManyWithConfirm(userId: string, items: TodoSplitItem[]): string {
  const created: Array<{ title: string; remindAt: string | null }> = [];
  for (const item of items) {
    const remindAt = item.remindAtText ? parseRemindAt(item.remindAtText) : null;
    const clean = item.title.trim() || "未命名待办";
    const { todo } = createTodo({
      userId,
      title: clean,
      remindAt,
      source: "wechat",
    });
    created.push({ title: todo.title, remindAt });
  }

  if (created.length === 1) {
    const only = created[0]!;
    if (only.remindAt) {
      return (
        `✅ 已创建待办「${only.title}」\n` +
        `提醒时间：${formatAbsoluteZh(only.remindAt)}（请核对；不对可以说「改成…」）\n\n` +
        TODOS_TIPS_SHORT
      );
    }
    return (
      `✅ 已创建待办「${only.title}」（未设置提醒）。` +
      `可用「明天 9 点提醒我 ${only.title}」补提醒。`
    );
  }

  const lines = created.map((t) => {
    if (t.remindAt) {
      return `✅ 已创建待办「${t.title}」· 提醒 ${formatAbsoluteZh(t.remindAt)}`;
    }
    return `✅ 已创建待办「${t.title}」（未设置提醒）`;
  });
  return `已拆成 ${created.length} 条待办：\n${lines.join("\n")}\n\n${TODOS_TIPS_SHORT}`;
}

/** `/todo …` slash commands. */
export function tryTodoSlashCommand(userId: string, text: string): TodoCommandResult {
  const trimmed = text.trim();
  if (!/^\/todo\b/i.test(trimmed)) return { handled: false };

  const body = trimmed.replace(/^\/todo\b/i, "").trim();
  if (!body || body === "help" || body === "?" || body === "帮助") {
    return { handled: true, reply: helpText() };
  }

  const [verb, ...rest] = body.split(/\s+/);
  const arg = rest.join(" ").trim();
  const v = (verb || "").toLowerCase();

  if (v === "on" || v === "开启" || v === "enable") {
    updateTodosSettings(userId, { todosEnabled: true });
    return { handled: true, reply: "已开启待办模块（默认开启）。" };
  }
  if (v === "off" || v === "关闭" || v === "disable") {
    updateTodosSettings(userId, { todosEnabled: false });
    return { handled: true, reply: "已关闭待办模块。再开可用 /todo on。" };
  }

  // Align with console: reads/list OK while off; writes require module on.
  const settings = getTodosSettings(userId);
  const disabledMsg =
    "待办模块已关闭，无法修改。可用 /todo on 重新开启（列表仍可用：/todo list）。";

  if (v === "list" || v === "ls" || v === "列表") {
    return { handled: true, reply: listText(userId) };
  }
  if (v === "done" || v === "complete" || v === "完成") {
    if (!settings.todosEnabled) return { handled: true, reply: disabledMsg };
    if (!arg) return { handled: true, reply: "请指定要完成的待办标题关键字，例如：/todo done 买牛奶" };
    const hit = findOpenTodoByTitleHint(userId, arg);
    if (!hit) return { handled: true, reply: `没找到匹配「${arg}」的未完成待办。` };
    completeTodo(userId, hit.id);
    return { handled: true, reply: `✅ 已完成待办「${hit.title}」。` };
  }
  if (v === "add" || v === "new" || v === "创建") {
    if (!settings.todosEnabled) return { handled: true, reply: disabledMsg };
    if (!arg) return { handled: true, reply: "请附上标题，例如：/todo add 交社保 明天 9:00" };
    const remindAt = parseRemindAt(arg);
    const title = stripTimePhrases(arg) || arg;
    return { handled: true, reply: createWithConfirm(userId, title, remindAt) };
  }

  // `/todo 标题 明天9点` shorthand (write)
  if (!settings.todosEnabled) return { handled: true, reply: disabledMsg };
  const remindAt = parseRemindAt(body);
  const title = stripTimePhrases(body) || body;
  return { handled: true, reply: createWithConfirm(userId, title, remindAt) };
}

function heuristicCreate(userId: string, trimmed: string): TodoCommandResult {
  const remindAt = parseRemindAt(trimmed);
  let title = stripTimePhrases(trimmed);
  title = title
    .replace(/^待办\s*/, "")
    .replace(/^(请)?(帮我)?/, "")
    .trim();
  if (!title || title.length < 1) title = "未命名待办";
  return { handled: true, reply: createWithConfirm(userId, title, remindAt) };
}

/**
 * NL intents. Create path may call injected JSON completer for semantic multi-split;
 * on failure / empty / no completer → current single-todo heuristic.
 * Does nothing if module disabled (except enabling phrases).
 */
export async function tryTodoNaturalLanguage(
  userId: string,
  text: string,
  options?: TodoCommandOptions,
): Promise<TodoCommandResult> {
  const trimmed = text.trim();
  if (!trimmed) return { handled: false };

  const settings = getTodosSettings(userId);

  if (/^(打开|开启)待办/.test(trimmed) || /^enable\s+todos$/i.test(trimmed)) {
    updateTodosSettings(userId, { todosEnabled: true });
    return { handled: true, reply: "已开启待办模块。" };
  }
  if (/^(关闭|停用)待办/.test(trimmed) || /^disable\s+todos$/i.test(trimmed)) {
    updateTodosSettings(userId, { todosEnabled: false });
    return { handled: true, reply: "已关闭待办模块。" };
  }

  if (!settings.todosEnabled) return { handled: false };

  if (/^(列出|查看|我的)?待办/.test(trimmed) || /待办(列表|有哪些)/.test(trimmed)) {
    return { handled: true, reply: listText(userId) };
  }

  const doneMatch = trimmed.match(/^(完成|搞定|打勾)\s*(.+)$/);
  if (doneMatch) {
    const hint = doneMatch[2]!.trim();
    const hit = findOpenTodoByTitleHint(userId, hint);
    if (!hit) return { handled: true, reply: `没找到匹配「${hint}」的未完成待办。` };
    completeTodo(userId, hit.id);
    return { handled: true, reply: `✅ 已完成待办「${hit.title}」。` };
  }

  // Reschedule: 改成明天10点 / 把交社保改到…
  const resched = trimmed.match(/^(?:把)?(.+?)(?:改成|改到|推迟到)\s*(.+)$/);
  if (resched) {
    const hint = resched[1]!.replace(/待办|提醒/g, "").trim();
    const timePart = resched[2]!.trim();
    const when = parseRemindAt(timePart) || parseRemindAt(trimmed);
    if (when && hint) {
      const hit = findOpenTodoByTitleHint(userId, hint);
      if (hit) {
        rescheduleReminder(userId, hit.id, when);
        return {
          handled: true,
          reply:
            `✅ 已将「${hit.title}」提醒改到 ${formatAbsoluteZh(when)}\n\n` + TODOS_TIPS_SHORT,
        };
      }
    }
  }

  // Create: 提醒我… / 待办… / …提醒我…
  const looksCreate =
    /提醒我|叫我|记得/.test(trimmed) ||
    /^待办\s+/.test(trimmed) ||
    (parseRemindAt(trimmed) != null && /交|买|取|打|开会|电话|邮件|社保/.test(trimmed));

  // Compound task list without explicit「提醒我」— e.g. 「把 A：…，以及 B」.
  // Only accept when the model returns items; do not heuristic-create a mega-title.
  const looksCompoundCreate =
    !looksCreate &&
    /(以及|还有|另外)/.test(trimmed) &&
    /(更新|加上?|改成?|做成?|写|创建|提醒|看待办|待办)/.test(trimmed);

  if (!looksCreate && !looksCompoundCreate) return { handled: false };

  if (options?.completeJson) {
    const items = await splitUtteranceIntoTodos(trimmed, options.completeJson);
    if (items && items.length > 0) {
      return { handled: true, reply: createManyWithConfirm(userId, items) };
    }
  }

  if (looksCompoundCreate) return { handled: false };
  return heuristicCreate(userId, trimmed);
}

/** Normalize `/todo` and `@todo` intent markers before slash / NL routing. */
export function normalizeTodoIntentMarker(text: string): string {
  const trimmed = text.trim();
  const m = trimmed.match(/^[@/]todo\b([:\s]|$)/i);
  if (!m) return trimmed;
  const rest = trimmed.slice(m[0].length).trim();
  if (!rest) return "/todo";
  if (
    /^(add|list|ls|done|complete|on|off|help|\?|帮助|开启|关闭|创建|完成|列表)\b/i.test(
      rest,
    )
  ) {
    return `/todo ${rest}`;
  }
  // Natural language after marker — do not force slash shorthand create.
  return rest;
}

export async function handleTodoMessage(
  userId: string,
  text: string,
  options?: TodoCommandOptions,
): Promise<TodoCommandResult> {
  const normalized = normalizeTodoIntentMarker(text);
  const slash = tryTodoSlashCommand(userId, normalized);
  if (slash.handled) return slash;
  return tryTodoNaturalLanguage(userId, normalized, options);
}
