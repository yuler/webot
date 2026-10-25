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

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  }
  return data as T;
}

export async function requestOtp(email: string) {
  return parseJson<{ ok: true }>(
    await fetch("/api/auth/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      credentials: "include",
    }),
  );
}

export async function verifyOtp(email: string, code: string) {
  return parseJson<{ ok: true; email: string; binding: Binding }>(
    await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
      credentials: "include",
    }),
  );
}

export async function fetchMe(): Promise<MeResponse | null> {
  const res = await fetch("/api/me", { credentials: "include", cache: "no-store" });
  if (res.status === 401) return null;
  return parseJson<MeResponse>(res);
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}

export async function resetBindCode() {
  return parseJson<{ binding: Binding }>(
    await fetch("/api/binding/reset", { method: "POST", credentials: "include" }),
  );
}

export async function disconnectBinding() {
  return parseJson<{ binding: Binding }>(
    await fetch("/api/binding/disconnect", { method: "POST", credentials: "include" }),
  );
}

export async function fetchMessages(limit = 100) {
  return parseJson<{ messages: Message[] }>(
    await fetch(`/api/messages?limit=${limit}`, { credentials: "include", cache: "no-store" }),
  );
}

export async function fetchBotStatus() {
  return parseJson<{ status: string; message: string; rev: string; botReady?: boolean }>(
    await fetch("/status", { cache: "no-store" }),
  );
}
