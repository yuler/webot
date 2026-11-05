import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { ssrApiOrigin } from "@/lib/ssr-origin";

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
 * Absolute API URL for SSR (relative fetch("/api/…") fails under Nitro/Bun).
 * Uses APP_ORIGIN / loopback only — never PUBLIC_ORIGIN (public HTTPS is often
 * unreachable from inside the container after Dokploy TLS).
 * Browser keeps relative URLs.
 */
const resolveApiUrl = createIsomorphicFn()
  .client((path: string) => path)
  .server((path: string) => {
    const origin = ssrApiOrigin();
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

export type DeletedMessagesResponse = {
  messages: Message[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export async function fetchDeletedMessages(page = 1, limit = 20): Promise<DeletedMessagesResponse> {
  return parseJson<DeletedMessagesResponse>(
    await apiFetch(`/api/messages?deleted=true&page=${page}&limit=${limit}`, {
      credentials: "include",
      cache: "no-store",
    }),
  );
}

/** Soft-delete current user's visible messages (rows kept with deletedAt). */
export async function clearMessages() {
  return parseJson<{ ok: true; deleted: number }>(
    await apiFetch("/api/messages/clear", { method: "POST", credentials: "include" }),
  );
}

export async function fetchBotStatus() {
  return parseJson<{
    status: string;
    message: string;
    rev: string;
    botReady?: boolean;
    hasQr?: boolean;
  }>(await apiFetch("/api/bot/status", { credentials: "include", cache: "no-store" }));
}

export async function resetBotSession() {
  return parseJson<{
    status: string;
    message: string;
    rev: string;
    botReady?: boolean;
    hasQr?: boolean;
  }>(await apiFetch("/api/bot/reset", { method: "POST", credentials: "include" }));
}

export type Todo = {
  id: string;
  userId: string;
  title: string;
  notes: string | null;
  dueAt: string | null;
  remindAt: string | null;
  status: string;
  completedAt: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type TodosSettings = {
  userId: string;
  todosEnabled: boolean;
  timezone: string;
  tipsAckedAt: string | null;
  lastUserInboundAt: string | null;
  proactiveSentInWindow: number;
  windowStartedAt: string | null;
  lastContextToken: string | null;
  lastWechatUserId: string | null;
  updatedAt: string;
};

export async function fetchTodos(status: "open" | "done" | "all" = "open") {
  return parseJson<{ todos: Todo[]; tips: string }>(
    await apiFetch(`/api/todos?status=${status}`, { credentials: "include", cache: "no-store" }),
  );
}

export async function createTodoApi(input: {
  title: string;
  notes?: string | null;
  dueAt?: string | null;
  remindAt?: string | null;
}) {
  return parseJson<{ todo: Todo; tips: string }>(
    await apiFetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      credentials: "include",
    }),
  );
}

export async function completeTodoApi(id: string) {
  return parseJson<{ todo: Todo }>(
    await apiFetch(`/api/todos/${encodeURIComponent(id)}/complete`, {
      method: "POST",
      credentials: "include",
    }),
  );
}

export async function updateTodoApi(
  id: string,
  patch: {
    title?: string;
    notes?: string | null;
    dueAt?: string | null;
    remindAt?: string | null;
    status?: "open" | "done" | "cancelled";
  },
) {
  return parseJson<{ todo: Todo }>(
    await apiFetch(`/api/todos/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
      credentials: "include",
    }),
  );
}

export async function deleteTodoApi(id: string) {
  return parseJson<{ ok: true; todo: Todo }>(
    await apiFetch(`/api/todos/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    }),
  );
}

export async function fetchTodosSettings() {
  return parseJson<{ settings: TodosSettings; tips: string }>(
    await apiFetch("/api/settings/todos", { credentials: "include", cache: "no-store" }),
  );
}

export async function patchTodosSettings(input: {
  todosEnabled?: boolean;
  timezone?: string;
  ackTips?: boolean;
}) {
  return parseJson<{ settings: TodosSettings; tips: string }>(
    await apiFetch("/api/settings/todos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      credentials: "include",
    }),
  );
}
