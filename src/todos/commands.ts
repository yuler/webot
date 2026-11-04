/**
 * WeChat `/todo` light commands + heuristic NL intents for 待办.
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

export type TodoCommandResult = { handled: true; reply: string } | { handled: false };

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

/**
 * Heuristic NL (no LLM). Returns handled when confident.
 * Does nothing if module disabled (except enabling phrases).
 */
export function tryTodoNaturalLanguage(userId: string, text: string): TodoCommandResult {
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

  if (!looksCreate) return { handled: false };

  const remindAt = parseRemindAt(trimmed);
  let title = stripTimePhrases(trimmed);
  title = title
    .replace(/^待办\s*/, "")
    .replace(/^(请)?(帮我)?/, "")
    .trim();
  if (!title || title.length < 1) title = "未命名待办";
  return { handled: true, reply: createWithConfirm(userId, title, remindAt) };
}

export function handleTodoMessage(userId: string, text: string): TodoCommandResult {
  const slash = tryTodoSlashCommand(userId, text);
  if (slash.handled) return slash;
  return tryTodoNaturalLanguage(userId, text);
}
