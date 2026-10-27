import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { DeepSeekBot, DEFAULT_SYSTEM_PROMPT } from "../src/claw/deepseek";
import { resetAllChatMemory, onChatMemoryResetAll } from "../src/chat-memory";

describe("System Prompt & Anti-Extraction Protection", () => {
  const origSystemPrompt = process.env.SYSTEM_PROMPT;
  const origAiSystemPrompt = process.env.AI_SYSTEM_PROMPT;

  beforeEach(() => {
    delete process.env.SYSTEM_PROMPT;
    delete process.env.AI_SYSTEM_PROMPT;
  });

  afterEach(() => {
    if (origSystemPrompt !== undefined) process.env.SYSTEM_PROMPT = origSystemPrompt;
    else delete process.env.SYSTEM_PROMPT;
    if (origAiSystemPrompt !== undefined) process.env.AI_SYSTEM_PROMPT = origAiSystemPrompt;
    else delete process.env.AI_SYSTEM_PROMPT;
  });

  test("default system prompt enforces WeBot identity and forbids model disclosure", () => {
    const bot = new DeepSeekBot("dummy-key");
    const prompt = bot.getSystemPrompt();

    expect(prompt).toContain("WeBot 智能助手");
    expect(prompt).toContain("DeepSeek");
    expect(prompt).toContain("OpenAI");
    expect(prompt).toContain("严格保密");
    expect(prompt).toBe(DEFAULT_SYSTEM_PROMPT);
  });

  test("custom system prompt can be set via constructor", () => {
    const customPrompt = "你是专属助手，只负责财务计算。";
    const bot = new DeepSeekBot("dummy-key", "https://api.deepseek.com", "deepseek-chat", customPrompt);
    expect(bot.getSystemPrompt()).toBe(customPrompt);
  });

  test("custom system prompt can be overridden via SYSTEM_PROMPT env var", () => {
    process.env.SYSTEM_PROMPT = "你是由某科技公司定制的专业客服，严禁透露底层架构。";
    const bot = new DeepSeekBot("dummy-key");
    expect(bot.getSystemPrompt()).toBe("你是由某科技公司定制的专业客服，严禁透露底层架构。");
  });

  test("custom system prompt can be overridden via AI_SYSTEM_PROMPT env var as fallback", () => {
    process.env.AI_SYSTEM_PROMPT = "AI_SYSTEM_PROMPT 设定的提示词";
    const bot = new DeepSeekBot("dummy-key");
    expect(bot.getSystemPrompt()).toBe("AI_SYSTEM_PROMPT 设定的提示词");
  });

  test("resetAllUsers clears in-memory history across all users", async () => {
    let capturedBody: any = null;
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (url: string, init?: any) => {
      capturedBody = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "你好，我是 WeBot 智能助手！" } }],
        }),
        { status: 200 },
      );
    }) as any;

    try {
      const bot = new DeepSeekBot("fake-key");
      await bot.chat("user_1", "第一条问候");
      await bot.chat("user_2", "第二位用户的问候");

      expect(bot.getHistory("user_1").length).toBe(2);
      expect(bot.getHistory("user_2").length).toBe(2);

      // Verify that system prompt sent to model is the secure prompt
      expect(capturedBody.messages[0].role).toBe("system");
      expect(capturedBody.messages[0].content).toContain("WeBot 智能助手");

      bot.resetAllUsers();
      expect(bot.getHistory("user_1").length).toBe(0);
      expect(bot.getHistory("user_2").length).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("resetAllChatMemory hook triggers registered callbacks", () => {
    let called = false;
    const unregister = onChatMemoryResetAll(() => {
      called = true;
    });

    resetAllChatMemory();
    expect(called).toBe(true);
    unregister();
  });
});
