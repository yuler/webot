import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

export type Binding = {
  id: string;
  userId: string;
  bindCode: string;
  wechatUserId: string | null;
  status: string;
  boundAt: string | null;
  disconnectedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MeResponse = {
  user: { id: string; email: string };
  binding: Binding;
};

export type Message = {
  id: string;
  userId: string;
  wechatUserId: string | null;
  role: string;
  content: string;
  wechatMessageId: string | null;
  createdAt: string;
};

/**
 * Absolute API origin for SSR (relative fetch("/api/…") fails under Nitro/Bun).
 * Browser keeps relative URLs.
 */
const resolveApiUrl = createIsomorphicFn()
  .client((path: string) => path)
  .server((path: string) => {
    const origin = (
      process.env.PUBLIC_ORIGIN?.trim() ||
      process.env.APP_ORIGIN?.trim() ||
      `http://127.0.0.1:${process.env.PORT || 3000}`
    ).replace(/\/+$/, "");
    return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
  });

/** Forward inbound Cookie on SSR so /console after magic-link stays authenticated. */
const ssrCookieHeader = createIsomorphicFn()
  .client(() => undefined as string | undefined)
  .server(() => getRequestHeader("cookie") ?? undefined);

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = resolveApiUrl(path);
  const headers = new Headers(init.headers);
  const cookie = ssrCookieHeader();
  if (cookie && !headers.has("cookie")) headers.set("cookie", cookie);
  return fetch(url, { ...init, headers });
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  }
  return data as T;
}

export async function requestOtp(email: string) {
  return parseJson<{ ok: true }>(
    await apiFetch("/api/auth/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      credentials: "include",
    }),
  );
}

export async function verifyOtp(email: string, code: string) {
  return parseJson<{ ok: true; email: string; binding: Binding }>(
    await apiFetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
      credentials: "include",
    }),
  );
}

export async function fetchMe(): Promise<MeResponse | null> {
  const res = await apiFetch("/api/me", { credentials: "include", cache: "no-store" });
  if (res.status === 401) return null;
  return parseJson<MeResponse>(res);
}

export async function logout() {
  await apiFetch("/api/auth/logout", { method: "POST", credentials: "include" });
}

export async function resetBindCode() {
  return parseJson<{ binding: Binding }>(
    await apiFetch("/api/binding/reset", { method: "POST", credentials: "include" }),
  );
}

export async function disconnectBinding() {
  return parseJson<{ binding: Binding }>(
    await apiFetch("/api/binding/disconnect", { method: "POST", credentials: "include" }),
  );
}

export async function fetchMessages(limit = 100) {
  return parseJson<{ messages: Message[] }>(
    await apiFetch(`/api/messages?limit=${limit}`, { credentials: "include", cache: "no-store" }),
  );
}

export async function fetchBotStatus() {
  return parseJson<{ status: string; message: string; rev: string; botReady?: boolean }>(
    await apiFetch("/status", { cache: "no-store" }),
  );
}
