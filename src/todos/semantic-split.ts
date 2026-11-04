/**
 * NL semantic multi-todo split via one-shot JSON LLM completion.
 * Slash `/todo add` stays heuristic; only WeChat NL create uses this.
 */

export const TODO_SEMANTIC_SPLIT_MAX = 8;

export type TodoSplitItem = {
  title: string;
  /** Optional time phrase for parseRemindAt; null if none. */
  remindAtText: string | null;
};

export type JsonCompleter = (
  system: string,
  user: string,
) => Promise<string | null>;

export const TODO_SPLIT_SYSTEM_PROMPT =
  "你是待办拆分助手。把用户的一句自然语言拆成若干独立待办。" +
  "只输出 JSON 对象，不要 markdown，不要解释。" +
  '格式：{"todos":[{"title":"简洁标题","remindAtText":null或时间短语}]}。' +
  "规则：\n" +
  "1. 按语义拆分复合请求（例如「A，以及 B」→ 两条），不要用简单标点硬切。\n" +
  "2. title 必填、非空、去掉「提醒我/记得」等套话，保留任务本身。\n" +
  "3. 若有明确时间（明天9点、下午3点等）写入 remindAtText；否则 null。" +
  "同一句共用一个时间时，可复制到每条。\n" +
  "4. 只有一个任务就返回一条；无法识别任务则返回 {\"todos\":[]}。\n" +
  `5. 最多 ${TODO_SEMANTIC_SPLIT_MAX} 条。`;

/** Extract first JSON object from model text (tolerates ``` fences). */
export function extractJsonObject(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(unfenced.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

/** Normalize model JSON into capped TodoSplitItem[]; empty if invalid / zero items. */
export function parseTodoSplitPayload(raw: unknown): TodoSplitItem[] {
  if (!raw || typeof raw !== "object") return [];
  const todos = (raw as { todos?: unknown }).todos;
  if (!Array.isArray(todos)) return [];
  const out: TodoSplitItem[] = [];
  for (const item of todos) {
    if (!item || typeof item !== "object") continue;
    const title = String((item as { title?: unknown }).title ?? "").trim();
    if (!title) continue;
    const remindRaw = (item as { remindAtText?: unknown }).remindAtText;
    let remindAtText: string | null = null;
    if (typeof remindRaw === "string") {
      const t = remindRaw.trim();
      remindAtText = t && t.toLowerCase() !== "null" ? t : null;
    }
    out.push({ title, remindAtText });
    if (out.length >= TODO_SEMANTIC_SPLIT_MAX) break;
  }
  return out;
}

/**
 * Ask the model to split `text` into todos.
 * Returns null on completer failure / empty / unparseable (caller falls back to heuristic).
 */
export async function splitUtteranceIntoTodos(
  text: string,
  complete: JsonCompleter,
): Promise<TodoSplitItem[] | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  let raw: string | null;
  try {
    raw = await complete(TODO_SPLIT_SYSTEM_PROMPT, trimmed);
  } catch (err) {
    console.warn("[todos] semantic split completer threw:", err);
    return null;
  }
  if (!raw) return null;
  const parsed = extractJsonObject(raw);
  if (parsed == null) return null;
  const items = parseTodoSplitPayload(parsed);
  if (!items.length) return null;
  return items;
}
