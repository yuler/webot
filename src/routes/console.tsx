import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  disconnectBinding,
  fetchMe,
  fetchMessages,
  logout,
  resetBindCode,
} from "@/lib/api";

export const Route = createFileRoute("/console")({
  beforeLoad: async () => {
    const me = await fetchMe();
    if (!me) throw redirect({ to: "/login" });
    return { me };
  },
  component: ConsolePage,
});

function ConsolePage() {
  const { me: initial } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const meQ = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const m = await fetchMe();
      if (!m) throw new Error("unauthorized");
      return m;
    },
    initialData: initial,
  });

  const msgQ = useQuery({
    queryKey: ["messages"],
    queryFn: () => fetchMessages(100),
    refetchInterval: 5000,
  });

  const resetM = useMutation({
    mutationFn: resetBindCode,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
  const disconnectM = useMutation({
    mutationFn: disconnectBinding,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });

  const binding = meQ.data?.binding;
  const messages = msgQ.data?.messages ?? [];

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <nav className="mb-4 flex flex-wrap gap-3 text-sm text-sky-300">
        <Link to="/console">控制台</Link>
        <Link to="/clawbot">ClawBot 扫码</Link>
        <button
          type="button"
          className="text-sky-300"
          onClick={async () => {
            await logout();
            navigate({ to: "/login" });
          }}
        >
          退出
        </button>
      </nav>
      <h1 className="text-xl font-semibold">控制台</h1>
      <p className="mt-1 text-sm text-zinc-400">已登录：{meQ.data?.user.email}</p>

      <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/80 p-5">
        <h2 className="text-base font-medium">微信 / ClawBot 绑定</h2>
        <p className="mt-2 text-sm text-zinc-400">
          在手机微信给已扫码登录的 ClawBot 发送绑定码（或 <code>/bind 绑定码</code>
          ），即可把微信私聊关联到本账号。
        </p>
        <div className="mt-4 rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 font-mono text-lg tracking-wider">
          {binding?.bindCode ?? "…"}
        </div>
        <p className="mt-3 text-sm">
          状态：{" "}
          <span
            className={
              binding?.status === "active"
                ? "text-emerald-300"
                : binding?.status === "disconnected"
                  ? "text-amber-300"
                  : "text-zinc-300"
            }
          >
            {binding?.status ?? "unknown"}
          </span>
          {binding?.wechatUserId ? (
            <span className="ml-2 text-zinc-500">
              wechat={binding.wechatUserId.slice(0, 10)}…
            </span>
          ) : null}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold"
            onClick={() => resetM.mutate()}
            disabled={resetM.isPending}
          >
            重置绑定码
          </button>
          <button
            type="button"
            className="rounded-lg bg-zinc-700 px-3 py-2 text-sm font-semibold"
            onClick={() => disconnectM.mutate()}
            disabled={disconnectM.isPending || binding?.status !== "active"}
          >
            断开绑定
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/80 p-5">
        <h2 className="text-base font-medium">消息记录</h2>
        <p className="mt-1 text-sm text-zinc-400">绑定后的微信对话会落在这里（新→旧）。</p>
        <ul className="mt-4 space-y-2">
          {messages.length === 0 ? (
            <li className="text-sm text-zinc-500">暂无消息</li>
          ) : (
            messages.map((m) => (
              <li
                key={m.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-sm"
              >
                <div className="flex justify-between gap-2 text-xs text-zinc-500">
                  <span>{m.role}</span>
                  <span>{new Date(m.createdAt).toLocaleString("zh-CN", { hour12: false })}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words">{m.content}</p>
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
