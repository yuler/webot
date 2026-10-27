/**
 * In-process chat memory reset hooks (DeepSeek histories keyed by WeChat user id).
 * API clear, WeChat /reset, and daily scheduled archive go through here.
 */

type ResetFn = (wechatUserId: string) => void;
type ResetAllFn = () => void;

const resetters = new Set<ResetFn>();
const resetAllHandlers = new Set<ResetAllFn>();

export function onChatMemoryReset(fn: ResetFn): () => void {
  resetters.add(fn);
  return () => {
    resetters.delete(fn);
  };
}

export function onChatMemoryResetAll(fn: ResetAllFn): () => void {
  resetAllHandlers.add(fn);
  return () => {
    resetAllHandlers.delete(fn);
  };
}

export function resetChatMemory(wechatUserId: string): void {
  if (!wechatUserId) return;
  for (const fn of resetters) {
    try {
      fn(wechatUserId);
    } catch (err) {
      console.warn("[chat-memory] reset failed:", err);
    }
  }
}

export function resetAllChatMemory(): void {
  for (const fn of resetAllHandlers) {
    try {
      fn();
    } catch (err) {
      console.warn("[chat-memory] resetAll failed:", err);
    }
  }
}

