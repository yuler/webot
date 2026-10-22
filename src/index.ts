/**
 * WeChat ClawBot + DeepSeek (Bun & TypeScript)
 * 纯本地运行的极简微信个人号（iLink 协议）AI 对话服务，无需 OpenClaw Gateway。
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import QRCode from "qrcode";

const ILINK_BASE_URL = "https://ilinkai.weixin.qq.com";
const SESSION_FILE = process.env.WECHAT_SESSION_FILE?.trim() || ".wechat_session.json";

interface SessionData {
  bot_token?: string;
  updates_buf?: string;
  bot_id?: string;
}

interface WechatMessageItem {
  type: number;
  text_item?: {
    text: string;
  };
}

interface WechatMessage {
  message_id?: string;
  seq?: number;
  from_user_id: string;
  to_user_id: string;
  context_token: string;
  item_list?: WechatMessageItem[];
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// 终端炫彩打印（支持 gum 增强）
function printBanner(title: string, subtitle?: string): void {
  try {
    const text = subtitle ? `${title}\n${subtitle}` : title;
    const proc = Bun.spawnSync([
      "gum",
      "style",
      "--border", "normal",
      "--margin", "1",
      "--padding", "1 2",
      "--border-foreground", "212",
      text,
    ]);
    if (proc.exitCode === 0) {
      console.log(proc.stdout.toString().trim());
      return;
    }
  } catch {
    // 降级为原生终端输出
  }

  console.log("\n" + "=".repeat(60));
  console.log(`  ${title}`);
  if (subtitle) console.log(`  ${subtitle}`);
  console.log("=".repeat(60) + "\n");
}

type LanStatus = "starting" | "wait" | "scaned" | "confirmed" | "expired" | "ready" | "error";

const lanPage = {
  png: null as Buffer | null,
  status: "starting" as LanStatus,
  message: "正在申请登录二维码…",
};

let lanServerStarted = false;

function lanAddresses(port: number): string[] {
  const urls = [`http://127.0.0.1:${port}`];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      const isIPv4 = iface.family === "IPv4" || iface.family === 4;
      if (isIPv4 && !iface.internal) {
        urls.push(`http://${iface.address}:${port}`);
      }
    }
  }
  return urls;
}

function startLanServer(): void {
  if (lanServerStarted) return;
  const port = Number(process.env.PORT || 3000);
  const hostname = process.env.HOST || "0.0.0.0";
  Bun.serve({
    hostname,
    port,
    fetch(req) {
      const pathname = new URL(req.url).pathname;
      if (pathname === "/qrcode.png") {
        if (!lanPage.png) return new Response("qr not ready", { status: 404 });
        return new Response(lanPage.png, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "no-store",
          },
        });
      }
      if (pathname === "/status") {
        return Response.json({ status: lanPage.status, message: lanPage.message });
      }
      const html = `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WeChat ClawBot</title>
<style>
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #111; color: #f5f5f5; }
  main { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 24px; text-align: center; }
  img { width: min(80vw, 320px); height: auto; background: #fff; border-radius: 12px; }
  p { margin: 0; line-height: 1.5; }
  .muted { color: #aaa; font-size: 14px; }
</style>
<main>
  <h1>微信扫码登录</h1>
  <img id="qr" alt="登录二维码" src="/qrcode.png">
  <p id="msg">${lanPage.message}</p>
  <p class="muted">微信 → 我 → 设置 → 插件 → ClawBot，扫描此二维码并确认。</p>
</main>
<script>
  async function tick() {
    try {
      const res = await fetch("/status", { cache: "no-store" });
      const data = await res.json();
      document.getElementById("msg").textContent = data.message || data.status;
      if (data.status === "wait" || data.status === "expired" || data.status === "starting") {
        document.getElementById("qr").src = "/qrcode.png?t=" + Date.now();
      }
    } catch {}
  }
  setInterval(tick, 2000);
</script>
</html>`;
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      });
    },
  });
  lanServerStarted = true;
  console.log("[LAN] 手机访问登录页:");
  for (const url of lanAddresses(port)) {
    console.log(`  ${url}`);
  }
}

function makeHeaders(botToken?: string): Record<string, string> {
  const uinInt = Math.floor(100000000 + Math.random() * 900000000);
  const uinB64 = Buffer.from(String(uinInt)).toString("base64");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-WECHAT-UIN": uinB64,
    "iLink-App-ClientVersion": "1",
  };
  if (botToken) {
    headers["AuthorizationType"] = "ilink_bot_token";
    headers["Authorization"] = `Bearer ${botToken}`;
  }
  return headers;
}

class WeChatClient {
  public botToken: string | null = null;
  public updatesBuf: string = "";
  public botId: string = "";

  constructor(private sessionPath: string = SESSION_FILE) {
    this.loadSession();
  }

  public loadSession(): void {
    if (fs.existsSync(this.sessionPath)) {
      try {
        const raw = fs.readFileSync(this.sessionPath, "utf-8");
        const data: SessionData = JSON.parse(raw);
        this.botToken = data.bot_token || null;
        this.updatesBuf = data.updates_buf || "";
        this.botId = data.bot_id || "";
        if (this.botToken) {
          console.log("[WeChat] 已从本地凭据加载持久化会话");
        }
      } catch (err) {
        console.warn("[WeChat] 读取本地凭据失败:", err);
      }
    }
  }

  public saveSession(): void {
    const data: SessionData = {
      bot_token: this.botToken || undefined,
      updates_buf: this.updatesBuf,
      bot_id: this.botId,
    };
    fs.writeFileSync(this.sessionPath, JSON.stringify(data, null, 2), "utf-8");
  }

  public clearSession(): void {
    this.botToken = null;
    this.updatesBuf = "";
    this.botId = "";
    if (fs.existsSync(this.sessionPath)) {
      try {
        fs.unlinkSync(this.sessionPath);
      } catch {
        // ignore
      }
    }
  }

  public async loginWithQrCode(): Promise<void> {
    console.log("[WeChat] 正在向微信申请登录二维码...");
    const resp = await fetch(`${ILINK_BASE_URL}/ilink/bot/get_bot_qrcode?bot_type=3`, {
      method: "GET",
      headers: makeHeaders(),
    });

    if (!resp.ok) {
      throw new Error(`获取二维码网络失败: HTTP ${resp.status}`);
    }

    const qrData = (await resp.json()) as { ret: number; qrcode: string; qrcode_img_content: string };
    if (qrData.ret !== 0) {
      throw new Error(`获取二维码失败: ${JSON.stringify(qrData)}`);
    }

    const { qrcode: qrcodeKey, qrcode_img_content: qrContent } = qrData;

    try {
      lanPage.png = Buffer.from(await QRCode.toBuffer(qrContent, { width: 640, margin: 1 }));
      lanPage.status = "wait";
      lanPage.message = "等待手机微信扫码";
    } catch (e) {
      lanPage.status = "error";
      lanPage.message = "二维码生成失败";
      console.warn("二维码图片生成异常:", e);
    }

    printBanner("请打开微信扫描下方二维码", "路径：微信 -> 我 -> 设置 -> 插件 -> ClawBot");

    // 终端紧凑字符打印二维码
    try {
      const asciiQr = await QRCode.toString(qrContent, { type: "terminal", small: true });
      console.log(asciiQr);
    } catch (e) {
      console.warn("二维码终端渲染异常:", e);
    }

    // 另存为本地图片便于无头或桌面查看
    try {
      await QRCode.toFile("qrcode.png", qrContent);
      console.log("📸 二维码已保存到本地: qrcode.png");
    } catch {
      // ignore
    }

    console.log(`🔗 原始链接: ${qrContent}\n`);
    console.log("⏳ 等待手机微信扫码并点击确认...");

    // 长轮询等待扫码结果
    while (true) {
      try {
        const statusResp = await fetch(
          `${ILINK_BASE_URL}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcodeKey)}`,
          {
            method: "GET",
            headers: makeHeaders(),
            signal: AbortSignal.timeout(45000),
          }
        );

        if (!statusResp.ok) {
          await Bun.sleep(2000);
          continue;
        }

        const statusData = (await statusResp.json()) as {
          ret: number;
          status: string;
          bot_token?: string;
          ilink_bot_id?: string;
        };

        const { status } = statusData;
        if (status === "wait") {
          lanPage.status = "wait";
          lanPage.message = "等待手机微信扫码";
          await Bun.sleep(1000);
          continue;
        } else if (status === "scaned") {
          if (lanPage.status !== "scaned") {
            console.log("[WeChat] 📱 已扫码，请在手机上点击「确认登录」...");
          }
          lanPage.status = "scaned";
          lanPage.message = "已扫码，请在手机上点击确认登录";
          await Bun.sleep(1000);
          continue;
        } else if (status === "confirmed") {
          this.botToken = statusData.bot_token || null;
          this.botId = statusData.ilink_bot_id || "";
          this.saveSession();
          lanPage.status = "confirmed";
          lanPage.message = "登录成功，可以关闭此页";
          console.log("🎉 微信扫码登录成功！");
          break;
        } else if (status === "expired") {
          lanPage.status = "expired";
          lanPage.message = "二维码已过期，正在刷新…";
          console.warn("[WeChat] 二维码已超时，重新获取...");
          return await this.loginWithQrCode();
        } else {
          await Bun.sleep(2000);
        }
      } catch (err: any) {
        if (err.name === "TimeoutError" || err.name === "AbortError") {
          continue;
        }
        console.warn("[WeChat] 轮询网络异常，重试中:", err.message);
        await Bun.sleep(2000);
      }
    }
  }

  public async getUpdates(): Promise<WechatMessage[]> {
    if (!this.botToken) return [];

    try {
      const resp = await fetch(`${ILINK_BASE_URL}/ilink/bot/getupdates`, {
        method: "POST",
        headers: makeHeaders(this.botToken),
        body: JSON.stringify({ get_updates_buf: this.updatesBuf }),
        signal: AbortSignal.timeout(45000),
      });

      if (resp.status === 401 || resp.status === 403) {
        console.warn("[WeChat] 登录凭证被拒绝，需重新登录");
        this.clearSession();
        return [];
      }

      const data = (await resp.json()) as {
        ret: number;
        errmsg?: string;
        get_updates_buf?: string;
        msgs?: WechatMessage[];
      };

      if (data.ret !== 0) {
        console.warn(`[WeChat] getupdates 接口异常 ret=${data.ret}, errmsg=${data.errmsg}`);
        if ([-14, -2, -1].includes(data.ret)) {
          this.clearSession();
        }
        return [];
      }

      if (data.get_updates_buf) {
        this.updatesBuf = data.get_updates_buf;
        this.saveSession();
      }

      return data.msgs || [];
    } catch (err: any) {
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        return [];
      }
      console.warn("[WeChat] 消息长轮询网络波动:", err.message);
      await Bun.sleep(2000);
      return [];
    }
  }

  public async sendMessage(toUserId: string, contextToken: string, text: string): Promise<boolean> {
    if (!this.botToken) return false;

    const payload = {
      msg: {
        from_user_id: "",
        to_user_id: toUserId,
        client_id: crypto.randomUUID(),
        message_type: 2,
        message_state: 2,
        context_token: contextToken,
        item_list: [
          {
            type: 1,
            text_item: {
              text,
            },
          },
        ],
      },
      base_info: {
        channel: 0,
      },
    };

    try {
      const resp = await fetch(`${ILINK_BASE_URL}/ilink/bot/sendmessage`, {
        method: "POST",
        headers: makeHeaders(this.botToken),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });

      const res = (await resp.json()) as { ret: number };
      if (res.ret === 0) {
        console.log(`[WeChat] 已回复 (to: ${toUserId.slice(0, 8)}...): ${text.slice(0, 30)}...`);
        return true;
      } else {
        console.error("[WeChat] 消息回复失败:", res);
        return false;
      }
    } catch (err: any) {
      console.error("[WeChat] 发送消息网络异常:", err.message);
      return false;
    }
  }
}

class DeepSeekBot {
  private histories: Map<string, ChatMessage[]> = new Map();

  constructor(
    private apiKey: string,
    private baseUrl: string = "https://api.deepseek.com",
    private model: string = "deepseek-chat"
  ) {}

  public resetUser(userId: string): void {
    this.histories.delete(userId);
  }

  public async chat(userId: string, userPrompt: string): Promise<string> {
    if (!this.apiKey) {
      return "⚠️ 服务端还没有配置 DEEPSEEK_API_KEY，暂时无法回复。";
    }

    let history = this.histories.get(userId);
    if (!history) {
      history = [];
      this.histories.set(userId, history);
    }

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: "你是运行在微信里的智能助手，由 DeepSeek 提供强大支持。回答简明得体、排版易于微信移动端阅读。",
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
        console.error(`[DeepSeek] 接口错误: ${resp.status} - ${errorText}`);
        return `⚠️ 调用 DeepSeek API 异常 (${resp.status})，请检查 API Key 或配置。`;
      }

      const data = (await resp.json()) as {
        choices?: Array<{ message: { content: string } }>;
      };

      const reply = data.choices?.[0]?.message?.content?.trim() || "⚠️ DeepSeek 返回了空内容。";

      // 维护最近 6 轮滑动窗口 (3 对问答)
      history.push({ role: "user", content: userPrompt });
      history.push({ role: "assistant", content: reply });
      while (history.length > 6) {
        history.shift();
      }

      return reply;
    } catch (err: any) {
      console.error("[DeepSeek] API 请求异常:", err.message);
      return "⚠️ 抱歉，当前处理回复超时或发生网络异常，请重试。";
    }
  }
}

function loadHomeEnv(): void {
  const homeEnv = path.join(os.homedir(), ".env.local");
  if (!fs.existsSync(homeEnv)) return;
  const text = fs.readFileSync(homeEnv, "utf-8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (process.env[key]) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

async function main() {
  loadHomeEnv();
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim() || "";
  if (!apiKey) {
    printBanner("未检测到 DEEPSEEK_API_KEY", "可写入 ~/.env.local 或项目 .env 后重启");
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";

  printBanner(
    "WeChat ClawBot + DeepSeek (Bun & TS)",
    `模型: ${model} | 历史重置: 发送 /reset 或 /clear`
  );

  startLanServer();

  const wechat = new WeChatClient();
  const deepseek = new DeepSeekBot(apiKey, baseUrl, model);

  if (!wechat.botToken) {
    await wechat.loginWithQrCode();
  } else {
    lanPage.status = "ready";
    lanPage.message = "已登录，服务监听中";
  }

  const seenMsgIds = new Set<string>();

  console.log("[System] 服务已就绪，进入实时长轮询监听...");

  while (true) {
    if (!wechat.botToken) {
      console.log("[System] 凭证不存在或已失效，重新启动扫码...");
      await wechat.loginWithQrCode();
    }

    const msgs = await wechat.getUpdates();
    if (!wechat.botToken) {
      continue;
    }

    for (const msg of msgs) {
      const msgId = msg.message_id || String(msg.seq || "");
      if (msgId) {
        if (seenMsgIds.has(msgId)) continue;
        seenMsgIds.add(msgId);
        if (seenMsgIds.size > 1000) {
          const firstKey = seenMsgIds.values().next().value;
          if (firstKey) seenMsgIds.delete(firstKey);
        }
      }

      const fromUser = msg.from_user_id;
      const contextToken = msg.context_token;
      if (!fromUser || !contextToken) continue;

      let userText: string | null = null;
      for (const item of msg.item_list || []) {
        if (item.type === 1 && item.text_item?.text) {
          userText = item.text_item.text;
          break;
        }
      }

      if (userText !== null) {
        const text = userText.trim();
        console.log(`[Message] 收到来自 [${fromUser.slice(0, 8)}...] 的文本: ${text}`);

        if (text === "/reset" || text === "/clear") {
          deepseek.resetUser(fromUser);
          await wechat.sendMessage(fromUser, contextToken, "🧹 会话记忆已重置，我们可以重新开始！");
        } else {
          const reply = await deepseek.chat(fromUser, text);
          await wechat.sendMessage(fromUser, contextToken, reply);
        }
      } else {
        console.log(`[Message] 收到来自 [${fromUser.slice(0, 8)}...] 的非文本消息`);
        await wechat.sendMessage(
          fromUser,
          contextToken,
          "🤖 收到您的非文本消息，当前仅支持纯文本交互哦~"
        );
      }
    }

    await Bun.sleep(500);
  }
}

// 捕获中断信号优雅退出
process.on("SIGINT", () => {
  console.log("\n[System] 正在安全停止 WeChat ClawBot 服务...");
  process.exit(0);
});
process.on("SIGTERM", () => {
  console.log("\n[System] 正在安全停止 WeChat ClawBot 服务...");
  process.exit(0);
});

main().catch((err) => {
  console.error("[Fatal]", err);
  process.exit(1);
});
