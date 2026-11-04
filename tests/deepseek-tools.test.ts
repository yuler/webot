import { afterEach, describe, expect, test } from "bun:test";
import { DeepSeekBot } from "../src/claw/deepseek";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("DeepSeekBot tool-call loop", () => {
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
      tools: [
        {
          type: "function",
          function: { name: "todos_list", parameters: { type: "object", properties: {} } },
        },
      ],
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
      new Response(JSON.stringify({ choices: [{ message: { content: "你好" } }] }), {
        status: 200,
      })) as any;
    const bot = new DeepSeekBot("test-key", "https://example.test");
    expect(await bot.chat("u2", "hi")).toBe("你好");
  });
});
