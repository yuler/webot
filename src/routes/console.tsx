import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ClawQr } from "@/components/ClawQr";
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
  const qc = useQueryClient();
  const navigate = useNavigate();

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
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const bindCommand = binding?.bindCode ? `/bind ${binding.bindCode}` : "";
  const clawUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/clawbot`
      : "/clawbot";

  return (
    <AppShell size="lg">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="type-title">控制台</h1>
          <p className="type-meta mt-1">已登录：{meQ.data?.user.email}</p>
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={async () => {
            await logout();
            navigate({ to: "/" });
          }}
        >
          退出
        </button>
      </div>

      <section className="panel mt-6" id="scan">
        <h2 className="type-app-title">扫码上线</h2>
        <p className="type-meta mt-2">
          微信 → 我 → 设置 → 插件 → ClawBot，扫描下方二维码并确认。也可打开或复制扫码页：
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="type-meta text-ink break-all">{clawUrl}</code>
          <button
            type="button"
            className="btn-ghost"
            onClick={async () => {
              await navigator.clipboard.writeText(
                typeof window !== "undefined"
                  ? `${window.location.origin}/clawbot`
                  : clawUrl,
              );
              setCopiedUrl(true);
              window.setTimeout(() => setCopiedUrl(false), 1500);
            }}
          >
            {copiedUrl ? "已复制" : "复制扫码地址"}
          </button>
          <a href="/clawbot" className="btn-ghost">
            打开扫码页
          </a>
        </div>
        <ClawQr />
      </section>

      <section className="panel mt-2">
        <h2 className="type-app-title">绑定微信</h2>
        <p className="type-meta mt-2">
          扫码上线后，把下面命令复制到微信发给 ClawBot，即可把私聊关联到本账号。
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-b border-line py-3">
          <span className="font-mono text-lg tracking-wider">
            {bindCommand || binding?.bindCode || "…"}
          </span>
          <button
            type="button"
            className="btn-solid"
            disabled={!bindCommand}
            onClick={async () => {
              if (!bindCommand) return;
              await navigator.clipboard.writeText(bindCommand);
              setCopiedCmd(true);
              window.setTimeout(() => setCopiedCmd(false), 1500);
            }}
          >
            {copiedCmd ? "已复制" : "复制绑定命令"}
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
            className="btn-ghost"
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
    </AppShell>
  );
}
