export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export class DeepSeekBot {
  private histories: Map<string, ChatMessage[]> = new Map();

  constructor(
    private apiKey: string,
    private baseUrl: string = "https://api.deepseek.com",
    private model: string = "deepseek-chat",
  ) {}

  public resetUser(userId: string): void {
    this.histories.delete(userId);
  }

  public async chat(userId: string, userPrompt: string): Promise<string> {
    if (!this.apiKey) {
      return "⚠️ 服务端还没有配置 AI 模型的 API_KEY，暂时无法回复。";
    }

    let history = this.histories.get(userId);
    if (!history) {
      history = [];
      this.histories.set(userId, history);
    }

    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "你是运行在微信里的智能助手。回答简明得体、排版易于微信移动端阅读。",
      },
      ...history,
      { role: "user", content: userPrompt },
    ];

    try {
      const resp = await fetch(`${this.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        console.error(`[AI] 接口错误: ${resp.status} - ${errorText}`);
        return `⚠️ 调用 AI API 异常 (${resp.status})，请检查 API Key 或配置。`;
      }

      const data = (await resp.json()) as {
        choices?: Array<{ message: { content: string } }>;
      };

      const reply = data.choices?.[0]?.message?.content?.trim() || "⚠️ AI 返回了空内容。";

      history.push({ role: "user", content: userPrompt });
      history.push({ role: "assistant", content: reply });
      while (history.length > 6) {
        history.shift();
      }

      return reply;
    } catch (err: any) {
      console.error("[AI] API 请求异常:", err.message);
      return "⚠️ 抱歉，当前处理回复超时或发生网络异常，请重试。";
    }
  }
}
