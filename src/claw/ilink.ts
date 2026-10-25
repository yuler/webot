/** Low-level iLink ClawBot HTTP helpers (per-call, no global session). */

export const ILINK_BASE_URL = "https://ilinkai.weixin.qq.com";

export function makeHeaders(botToken?: string): Record<string, string> {
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

export type WechatMessageItem = {
  type: number;
  text_item?: { text: string };
};

export type WechatMessage = {
  message_id?: string;
  seq?: number;
  from_user_id: string;
  to_user_id: string;
  context_token: string;
  item_list?: WechatMessageItem[];
};

export async function fetchBotQrCode(): Promise<
  { ok: true; qrcodeKey: string; qrContent: string } | { ok: false; error: string }
> {
  const resp = await fetch(`${ILINK_BASE_URL}/ilink/bot/get_bot_qrcode?bot_type=3`, {
    method: "GET",
    headers: makeHeaders(),
  });
  if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}` };
  const qrData = (await resp.json()) as {
    ret: number;
    qrcode: string;
    qrcode_img_content: string;
  };
  if (qrData.ret !== 0) return { ok: false, error: JSON.stringify(qrData) };
  return { ok: true, qrcodeKey: qrData.qrcode, qrContent: qrData.qrcode_img_content };
}

export async function fetchQrcodeStatus(qrcodeKey: string): Promise<{
  ret: number;
  status: string;
  bot_token?: string;
  ilink_bot_id?: string;
} | null> {
  const statusResp = await fetch(
    `${ILINK_BASE_URL}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcodeKey)}`,
    {
      method: "GET",
      headers: makeHeaders(),
      signal: AbortSignal.timeout(45000),
    },
  );
  if (!statusResp.ok) return null;
  return (await statusResp.json()) as {
    ret: number;
    status: string;
    bot_token?: string;
    ilink_bot_id?: string;
  };
}

export async function getUpdates(
  botToken: string,
  updatesBuf: string,
): Promise<
  | { ok: true; msgs: WechatMessage[]; updatesBuf: string }
  | { ok: false; clearSession?: boolean }
> {
  try {
    const resp = await fetch(`${ILINK_BASE_URL}/ilink/bot/getupdates`, {
      method: "POST",
      headers: makeHeaders(botToken),
      body: JSON.stringify({ get_updates_buf: updatesBuf }),
      signal: AbortSignal.timeout(45000),
    });
    if (resp.status === 401 || resp.status === 403) {
      return { ok: false, clearSession: true };
    }
    const data = (await resp.json()) as {
      ret: number;
      errmsg?: string;
      get_updates_buf?: string;
      msgs?: WechatMessage[];
    };
    if (typeof data.ret === "number" && data.ret !== 0) {
      if ([-14, -2, -1].includes(data.ret)) return { ok: false, clearSession: true };
      return { ok: false };
    }
    return {
      ok: true,
      msgs: data.msgs || [],
      updatesBuf: data.get_updates_buf ?? updatesBuf,
    };
  } catch (err: any) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      return { ok: true, msgs: [], updatesBuf };
    }
    await Bun.sleep(2000);
    return { ok: true, msgs: [], updatesBuf };
  }
}

export async function sendMessage(
  botToken: string,
  toUserId: string,
  contextToken: string,
  text: string,
): Promise<boolean> {
  const payload = {
    msg: {
      from_user_id: "",
      to_user_id: toUserId,
      client_id: crypto.randomUUID(),
      message_type: 2,
      message_state: 2,
      context_token: contextToken,
      item_list: [{ type: 1, text_item: { text } }],
    },
    base_info: { channel: 0 },
  };
  try {
    const resp = await fetch(`${ILINK_BASE_URL}/ilink/bot/sendmessage`, {
      method: "POST",
      headers: makeHeaders(botToken),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    const res = (await resp.json()) as {
      ret?: number;
      errmsg?: string;
      message_id?: string | number;
    };
    return res.ret === 0 || res.message_id != null;
  } catch {
    return false;
  }
}
