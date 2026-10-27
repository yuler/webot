/**
 * Per-user ClawBot workers: independent QR login + getupdates loops.
 * No shared lanPage / .wechat_session.json / global /qrcode.png.
 */
import QRCode from "qrcode";
import {
  activateBindingByCode,
  disconnectBinding,
  ensureBindingForUser,
  extractBindCodeFromText,
  findActiveBindingByWechatUserId,
  findBindingByCode,
} from "../auth/bindings";
import { insertMessage, softDeleteMessagesForUser } from "../auth/messages";
import { onChatMemoryReset, onChatMemoryResetAll } from "../chat-memory";
import { DeepSeekBot } from "./deepseek";
import { rateLimiter } from "./rate-limit";
import { startDailyArchiveScheduler } from "./scheduler";
import {
  claimBotToken,
  clearClawCredentials,
  ensureClawSession,
  getClawSession,
  getQrPng,
  listSessionsWithBotToken,
  publicBotView,
  setQrPng,
  updateClawSession,
} from "./store";
import * as ilink from "./ilink";

type WorkerState = {
  userId: string;
  running: boolean;
  phase: "idle" | "login" | "poll";
  abort: AbortController;
};

const workers = new Map<string, WorkerState>();
let deepseek: DeepSeekBot | null = null;
let runtimeStarted = false;

function skipBot(): boolean {
  return process.env.WEBOT_SKIP_BOT === "1";
}

function getDeepseek(): DeepSeekBot {
  if (!deepseek) {
    const apiKey =
      process.env.AI_API_KEY?.trim() ||
      process.env.DEEPSEEK_API_KEY?.trim() ||
      "";
    const baseUrl =
      process.env.AI_BASE_URL?.trim() ||
      process.env.DEEPSEEK_BASE_URL?.trim() ||
      "https://api.deepseek.com";
    const model =
      process.env.AI_MODEL?.trim() ||
      process.env.DEEPSEEK_MODEL?.trim() ||
      "deepseek-chat";
    const systemPrompt =
      process.env.SYSTEM_PROMPT?.trim() ||
      process.env.AI_SYSTEM_PROMPT?.trim();
    deepseek = new DeepSeekBot(apiKey, baseUrl, model, systemPrompt);
    onChatMemoryReset((wechatUserId) => deepseek!.resetUser(wechatUserId));
    onChatMemoryResetAll(() => deepseek!.resetAllUsers());
  }
  return deepseek;
}

async function loginWithQrForUser(userId: string, signal: AbortSignal): Promise<void> {
  qr: for (;;) {
    if (signal.aborted) return;
    console.log(`[Claw:${userId.slice(0, 8)}] 申请登录二维码…`);
    updateClawSession(userId, {
      status: "starting",
      message: "正在申请登录二维码…",
      qrRev: "",
      botToken: null,
    });
    setQrPng(userId, null);

    let qr;
    try {
      qr = await ilink.fetchBotQrCode();
    } catch (e: any) {
      updateClawSession(userId, {
        status: "error",
        message: `获取二维码失败: ${e?.message || e}`,
      });
      await Bun.sleep(3000);
      continue;
    }
    if (!qr.ok) {
      updateClawSession(userId, { status: "error", message: `获取二维码失败: ${qr.error}` });
      await Bun.sleep(3000);
      continue;
    }

    const issuedAt = Date.now();
    try {
      const png = Buffer.from(
        await QRCode.toBuffer(qr.qrContent, {
          errorCorrectionLevel: "M",
          margin: 2,
          scale: 8,
          color: { dark: "#000000", light: "#ffffff" },
        }),
      );
      setQrPng(userId, png);
      updateClawSession(userId, {
        status: "wait",
        message: "等待手机微信扫码",
        qrRev: String(issuedAt),
      });
    } catch (e) {
      console.warn(`[Claw:${userId.slice(0, 8)}] 二维码图片生成异常:`, e);
      updateClawSession(userId, { status: "error", message: "二维码生成失败" });
      await Bun.sleep(3000);
      continue;
    }

    const QR_REFRESH_BEFORE_MS = 80_000;
    const SCANNED_HOLD_MS = 60_000;
    let scannedAt = 0;

    while (!signal.aborted) {
      if (!scannedAt && Date.now() - issuedAt >= QR_REFRESH_BEFORE_MS) {
        updateClawSession(userId, { message: "二维码即将过期，正在刷新…" });
        continue qr;
      }

      try {
        const statusData = await ilink.fetchQrcodeStatus(qr.qrcodeKey);
        if (!statusData) {
          await Bun.sleep(2000);
          continue;
        }
        const status = statusData.status;
        if (status === "wait") {
          if (!scannedAt) {
            updateClawSession(userId, { status: "wait", message: "等待手机微信扫码" });
          }
          await Bun.sleep(1000);
          continue;
        }
        if (status === "scaned" || status === "scanned") {
          if (!scannedAt) {
            scannedAt = Date.now();
            console.log(`[Claw:${userId.slice(0, 8)}] 已扫码，等待确认…`);
          }
          updateClawSession(userId, {
            status: "scaned",
            message: "已扫码，请在手机上点击确认登录",
          });
          await Bun.sleep(1000);
          continue;
        }
        if (status === "confirmed") {
          const token = statusData.bot_token || null;
          if (token) {
            claimBotToken(userId, token, {
              botId: statusData.ilink_bot_id || "",
              status: "ready",
              message: "登录成功，服务监听中",
              qrRev: "",
            });
          } else {
            updateClawSession(userId, {
              botToken: null,
              botId: statusData.ilink_bot_id || "",
              status: "error",
              message: "确认登录但未返回 bot_token",
              qrRev: "",
            });
            continue qr;
          }
          setQrPng(userId, null);
          console.log(`[Claw:${userId.slice(0, 8)}] 扫码登录成功`);
          return;
        }
        if (status === "expired") {
          if (scannedAt && Date.now() - scannedAt < SCANNED_HOLD_MS) {
            updateClawSession(userId, {
              status: "scaned",
              message: "已扫码，请在手机上点击确认登录",
            });
            await Bun.sleep(1000);
            continue;
          }
          updateClawSession(userId, {
            status: "expired",
            message: "二维码已过期，正在刷新…",
          });
          continue qr;
        }
        await Bun.sleep(2000);
      } catch (err: any) {
        if (err.name === "TimeoutError" || err.name === "AbortError") continue;
        console.warn(`[Claw:${userId.slice(0, 8)}] 轮询异常:`, err.message);
        await Bun.sleep(2000);
      }
    }
  }
}

async function handleMessages(ownerUserId: string, msgs: ilink.WechatMessage[]): Promise<void> {
  const session = getClawSession(ownerUserId);
  const botToken = session?.botToken;
  if (!botToken) return;
  const ds = getDeepseek();

  for (const msg of msgs) {
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

    const msgId = msg.message_id || String(msg.seq || "");

    if (userText === null) {
      await ilink.sendMessage(
        botToken,
        fromUser,
        contextToken,
        "🤖 收到您的非文本消息，当前仅支持纯文本交互哦~",
      );
      continue;
    }

    const text = userText.trim();
    console.log(`[Claw:${ownerUserId.slice(0, 8)}] msg from ${fromUser.slice(0, 8)}: ${text}`);

    const maybeCode = extractBindCodeFromText(text);
    if (maybeCode) {
      const preview = findBindingByCode(maybeCode);
      if (preview && preview.userId !== ownerUserId) {
        await ilink.sendMessage(
          botToken,
          fromUser,
          contextToken,
          "❌ 此绑定码属于其他 WeBot 账号。请扫码登录对应控制台的 ClawBot，或使用本账号绑定码。",
        );
        continue;
      }
      const result = activateBindingByCode(maybeCode, fromUser);
      if (result.ok) {
        insertMessage({
          userId: result.binding.userId,
          wechatUserId: fromUser,
          role: "system",
          content: `WeChat bound via ${result.binding.bindCode}`,
          wechatMessageId: msgId || null,
        });
        await ilink.sendMessage(
          botToken,
          fromUser,
          contextToken,
          `✅ 绑定成功！之后发消息会记到你的 WeBot 控制台。发送 /reset 可清空对话记忆。`,
        );
      } else {
        await ilink.sendMessage(
          botToken,
          fromUser,
          contextToken,
          `❌ 绑定失败：${result.error}。请打开 WeBot 控制台核对绑定码，或发送 /bind 你的绑定码。`,
        );
      }
      continue;
    }

    let binding = findActiveBindingByWechatUserId(fromUser);
    if (!binding || binding.userId !== ownerUserId) {
      // Auto-bind on first message if this bot's owner is currently unbound
      const ownerBinding = ensureBindingForUser(ownerUserId);
      if (!ownerBinding.wechatUserId || ownerBinding.status !== "active") {
        const auto = activateBindingByCode(ownerBinding.bindCode, fromUser);
        if (auto.ok) {
          binding = auto.binding;
          insertMessage({
            userId: ownerUserId,
            wechatUserId: fromUser,
            role: "system",
            content: `WeChat auto-bound on first message`,
            wechatMessageId: msgId || null,
          });
        }
      }
    }

    if (!binding || binding.userId !== ownerUserId) {
      await ilink.sendMessage(
        botToken,
        fromUser,
        contextToken,
        "🔗 尚未绑定本控制台账号。请复制本控制台绑定码，在此发送（或 /bind 绑定码）。",
      );
      continue;
    }

    if (text === "/reset" || text === "/clear") {
      softDeleteMessagesForUser(binding.userId);
      ds.resetUser(fromUser);
      insertMessage({
        userId: binding.userId,
        wechatUserId: fromUser,
        role: "system",
        content: "session reset",
        wechatMessageId: msgId || null,
      });
      await ilink.sendMessage(botToken, fromUser, contextToken, "🧹 会话记忆已重置，我们可以重新开始！");
      continue;
    }

    // Rate limit check before calling AI
    const limit = rateLimiter.checkLimit(fromUser);
    if (!limit.allowed) {
      console.warn(
        `[Claw:${ownerUserId.slice(0, 8)}] 提问受限 (${limit.reason}) 用户 ${fromUser.slice(0, 8)}`,
      );
      insertMessage({
        userId: binding.userId,
        wechatUserId: fromUser,
        role: "user",
        content: text,
        wechatMessageId: msgId || null,
      });
      insertMessage({
        userId: binding.userId,
        wechatUserId: fromUser,
        role: "assistant",
        content: limit.message!,
      });
      await ilink.sendMessage(botToken, fromUser, contextToken, limit.message!);
      continue;
    }

    insertMessage({
      userId: binding.userId,
      wechatUserId: fromUser,
      role: "user",
      content: text,
      wechatMessageId: msgId || null,
    });
    const reply = await ds.chat(fromUser, text);
    insertMessage({
      userId: binding.userId,
      wechatUserId: fromUser,
      role: "assistant",
      content: reply,
    });
    await ilink.sendMessage(botToken, fromUser, contextToken, reply);
  }
}

async function pollLoop(userId: string, signal: AbortSignal): Promise<void> {
  const seenMsgIds = new Set<string>();
  updateClawSession(userId, { status: "ready", message: "已登录，服务监听中", qrRev: "" });
  setQrPng(userId, null);

  while (!signal.aborted) {
    const session = getClawSession(userId);
    if (!session?.botToken) {
      return; // back to login
    }

    const result = await ilink.getUpdates(session.botToken, session.updatesBuf || "");
    if (!result.ok) {
      if (result.clearSession) {
        console.warn(`[Claw:${userId.slice(0, 8)}] 凭证失效，需重新扫码`);
        clearClawCredentials(userId);
        return;
      }
      await Bun.sleep(500);
      continue;
    }

    if (result.updatesBuf !== session.updatesBuf) {
      updateClawSession(userId, { updatesBuf: result.updatesBuf });
    }

    const fresh: ilink.WechatMessage[] = [];
    for (const msg of result.msgs) {
      const msgId = msg.message_id || String(msg.seq || "");
      if (msgId) {
        if (seenMsgIds.has(msgId)) continue;
        seenMsgIds.add(msgId);
        if (seenMsgIds.size > 1000) {
          const firstKey = seenMsgIds.values().next().value;
          if (firstKey) seenMsgIds.delete(firstKey);
        }
      }
      fresh.push(msg);
    }
    if (fresh.length) await handleMessages(userId, fresh);
    await Bun.sleep(500);
  }
}

async function workerMain(userId: string, signal: AbortSignal): Promise<void> {
  while (!signal.aborted) {
    const session = ensureClawSession(userId);
    if (session.botToken) {
      const w = workers.get(userId);
      if (w) w.phase = "poll";
      await pollLoop(userId, signal);
      continue;
    }
    if (skipBot()) {
      // API-only / test: keep any injected QR/credentials; do not wipe session state.
      ensureClawSession(userId);
      await Bun.sleep(5000);
      continue;
    }
    const w = workers.get(userId);
    if (w) w.phase = "login";
    await loginWithQrForUser(userId, signal);
  }
}

/** Ensure a background worker exists for this SaaS user (QR + listen). */
export function ensureUserClawWorker(userId: string): void {
  ensureClawSession(userId);
  let w = workers.get(userId);
  if (w?.running) return;
  const abort = new AbortController();
  w = { userId, running: true, phase: "idle", abort };
  workers.set(userId, w);
  void workerMain(userId, abort.signal).finally(() => {
    const cur = workers.get(userId);
    if (cur?.abort === abort) {
      cur.running = false;
      workers.delete(userId);
    }
  });
}

/** Boot: resume workers for every stored bot_token. Non-blocking. */
export function startClawRuntime(): void {
  if (runtimeStarted) return;
  runtimeStarted = true;
  getDeepseek();
  startDailyArchiveScheduler();
  if (skipBot()) {
    console.log("[Claw] WEBOT_SKIP_BOT=1 — per-user workers idle until enabled");
    return;
  }
  const rows = listSessionsWithBotToken();
  console.log(`[Claw] starting ${rows.length} persisted user worker(s)`);
  for (const row of rows) {
    ensureUserClawWorker(row.userId);
  }
}

/** Authenticated status for console; kicks worker so QR starts on first visit. */
export function getStatusForUser(userId: string) {
  ensureUserClawWorker(userId);
  return publicBotView(userId);
}

export function getQrPngForUser(userId: string): Buffer | null {
  ensureUserClawWorker(userId);
  return getQrPng(userId);
}

/** Reset credentials and reboot worker so user gets a fresh login QR. */
export function resetUserClawWorker(userId: string): void {
  disconnectBinding(userId);
  clearClawCredentials(userId);
  const w = workers.get(userId);
  if (w) {
    w.abort.abort();
    workers.delete(userId);
  }
  ensureUserClawWorker(userId);
}

export { publicBotView, __testInjectQr } from "./store";
