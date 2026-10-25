import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppBar } from "@/components/AppBar";
import { ClawQr } from "@/components/ClawQr";
import {
  disconnectBinding,
  fetchMe,
  fetchMessages,
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
  const [copied, setCopied] = useState(false);
  const bindCommand = binding?.bindCode ? `/bind ${binding.bindCode}` : "";

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <AppBar />

      <h1 className="type-title">控制台</h1>
      <p className="type-meta mt-1">已登录：{meQ.data?.user.email}</p>

      <section className="panel mt-6">
        <h2 className="type-app-title">微信 / ClawBot 绑定</h2>
        <p className="type-meta mt-2">
          在手机微信给已扫码登录的 ClawBot 发送绑定码（或{" "}
          <code className="text-ink">/bind 绑定码</code>
          ），即可把微信私聊关联到本账号。
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-b border-line py-3">
          <span className="font-mono text-lg tracking-wider">{binding?.bindCode ?? "…"}</span>
          <button
            type="button"
            className="btn-ghost"
            disabled={!bindCommand}
            onClick={async () => {
              if (!bindCommand) return;
              await navigator.clipboard.writeText(bindCommand);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "已复制" : "快捷复制"}
          </button>
        </div>
        <p className="type-meta mt-3">
          状态：{" "}
          <span className="text-ink">{binding?.status ?? "unknown"}</span>
          {binding?.wechatUserId ? (
            <span className="ml-2">
              wechat={binding.wechatUserId.slice(0, 10)}…
            </span>
          ) : null}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-solid"
            onClick={() => resetM.mutate()}
            disabled={resetM.isPending}
          >
            重置绑定码
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => disconnectM.mutate()}
            disabled={disconnectM.isPending || binding?.status !== "active"}
          >
            断开绑定
          </button>
        </div>
      </section>

      <section className="panel mt-2">
        <h2 className="type-app-title">消息记录</h2>
        <p className="type-meta mt-1">绑定后的微信对话会落在这里（新→旧）。</p>
        <ul className="mt-4 list-none p-0">
          {messages.length === 0 ? (
            <li className="type-meta">暂无消息</li>
          ) : (
            messages.map((m) => (
              <li key={m.id} className="timeline-row text-sm">
                <div className="flex justify-between gap-2 type-meta text-xs">
                  <span>{m.role}</span>
                  <span>
                    {new Date(m.createdAt).toLocaleString("zh-CN", {
                      hour12: false,
                    })}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words">{m.content}</p>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="panel mt-2">
        <h2 className="type-app-title">微信扫码</h2>
        <p className="type-meta mt-2">
          微信 → 我 → 设置 → 插件 → ClawBot，扫描并确认。
        </p>
        <ClawQr />
      </section>
    </main>
  );
}
