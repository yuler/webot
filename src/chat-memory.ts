/**
 * In-process chat memory reset hooks (DeepSeek histories keyed by WeChat user id).
 * API clear and WeChat /reset both go through here so DB soft-delete and RAM stay aligned.
 */

type ResetFn = (wechatUserId: string) => void;

const resetters = new Set<ResetFn>();

export function onChatMemoryReset(fn: ResetFn): () => void {
  resetters.add(fn);
  return () => {
    resetters.delete(fn);
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
