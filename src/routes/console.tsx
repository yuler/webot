import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ClawQr, useBotStatus } from "@/components/ClawQr";
import {
  clearMessages,
  disconnectBinding,
  fetchMe,
  fetchMessages,
  logout,
  resetBindCode,
  type Message,
} from "@/lib/api";

export const Route = createFileRoute("/console")({
  beforeLoad: async () => {
    const me = await fetchMe();
    if (!me) throw redirect({ to: "/login" });
    return { me };
  },
  component: ConsolePage,
});

type Tab = "setup" | "messages";

const BINDING_STATUS: Record<string, string> = {
  active: "已绑定",
  pending: "待绑定",
  disconnected: "已断开",
};

const ROLE_LABEL: Record<string, string> = {
  user: "微信",
  assistant: "WeBot",
  system: "系统",
};

/** navigator.clipboard needs a secure context; LAN http:// falls back to execCommand. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const hm = d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (d.toDateString() === now.toDateString()) return hm;
  const md = `${d.getMonth() + 1}月${d.getDate()}日`;
  return d.getFullYear() === now.getFullYear() ? `${md} ${hm}` : `${d.getFullYear()}年${md} ${hm}`;
}

function ConsolePage() {
  const { me: initial } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const gridRef = useRef<HTMLDivElement>(null);

  const meQ = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const m = await fetchMe();
      if (!m) throw new Error("unauthorized");
      return m;
    },
    initialData: initial,
  });
  const botQ = useBotStatus();

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
  const clearM = useMutation({
    mutationFn: clearMessages,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages"] }),
  });
  const logoutM = useMutation({
    mutationFn: logout,
    onSettled: () => {
      qc.clear();
      navigate({ to: "/" });
    },
  });

  const binding = meQ.data?.binding;
  const messages = msgQ.data?.messages ?? [];
  const bindCommand = binding?.bindCode ? `/bind ${binding.bindCode}` : "";
  const isBound = binding?.status === "active" && Boolean(binding.wechatUserId);
  const botReady = Boolean(botQ.data?.botReady);

  const [tab, setTab] = useState<Tab>(isBound ? "messages" : "setup");
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const [justBound, setJustBound] = useState(false);
  const wasBound = useRef(isBound);

  useEffect(() => {
    if (isBound && !wasBound.current) {
      setJustBound(true);
      setTab("messages");
    }
    wasBound.current = isBound;
  }, [isBound]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(null), 1800);
    return () => window.clearTimeout(t);
  }, [copied]);

  function switchTab(next: Tab) {
    setTab(next);
    const grid = gridRef.current;
    if (grid && grid.getBoundingClientRect().top < 0) grid.scrollIntoView({ block: "start" });
  }

  async function onCopy() {
    if (!bindCommand) return;
    setCopied((await copyText(bindCommand)) ? "ok" : "fail");
  }

  return (
    <AppShell size="lg">
      <div className="page-head">
        <div className="min-w-0">
          <h1 className="type-title">控制台</h1>
          <p className="type-meta page-head-meta mt-1">已登录：{meQ.data?.user.email}</p>
        </div>
        <button
          type="button"
          className={`btn-ghost${logoutM.isPending ? " is-loading" : ""}`}
          disabled={logoutM.isPending}
          onClick={() => logoutM.mutate()}
        >
          退出
        </button>
      </div>

      <div className="status-line mb-5" aria-label="当前状态">
        <span className={`status-dot${botReady ? " is-on" : " is-pending"}`}>
          ClawBot {botReady ? "在线" : "未上线"}
        </span>
        <span className={`status-dot${isBound ? " is-on" : ""}`}>
          微信{isBound ? "已绑定" : "未绑定"}
        </span>
      </div>

      <div className="segmented" role="group" aria-label="切换视图">
        <button
          type="button"
          className="btn-ghost"
          aria-pressed={tab === "setup"}
          onClick={() => switchTab("setup")}
        >
          扫码与绑定
        </button>
        <button
          type="button"
          className="btn-ghost"
          aria-pressed={tab === "messages"}
          onClick={() => switchTab("messages")}
        >
          消息{messages.length ? <span className="tabular">（{messages.length}）</span> : null}
        </button>
      </div>

      <div
        ref={gridRef}
        className="console-grid"
        data-tab={tab}
        style={{ scrollMarginTop: 64 }}
      >
        <div className="console-pane console-pane--setup">
          <section className="panel" id="scan" aria-labelledby="scan-heading">
            <h2 id="scan-heading" className="type-app-title">
              <span className="panel-step type-kicker" aria-hidden="true">01</span>扫码上线
            </h2>
            <p className="type-meta mt-2">
              首次使用须先扫码：微信 → 我 → 设置 → 插件 → ClawBot，扫描下方二维码并确认。
              ClawBot 已上线后，可跳过扫码，直接用绑定码重新关联微信。
            </p>
            <ClawQr />
          </section>

          <section className="panel" aria-labelledby="bind-heading">
            <h2 id="bind-heading" className="type-app-title">
              <span className="panel-step type-kicker" aria-hidden="true">02</span>绑定微信
            </h2>
            <p className="type-meta mt-2">
              {isBound
                ? "已绑定。若要换微信号或重新关联，复制下方命令发到微信 ClawBot 即可重绑。"
                : "扫码上线后，把下面命令复制到微信发给 ClawBot，即可把私聊关联到本账号（首次绑定必经扫码上线）。"}
            </p>
            <div className="bind-cmd">
              <button
                type="button"
                className="bind-cmd-value"
                onClick={onCopy}
                disabled={!bindCommand}
                aria-label={bindCommand ? `绑定命令 ${bindCommand}，点击复制` : "绑定命令加载中"}
              >
                {bindCommand || binding?.bindCode || "…"}
              </button>
              <button
                type="button"
                className="btn-solid"
                disabled={!bindCommand}
                onClick={onCopy}
              >
                {copied === "ok" ? "已复制" : "复制绑定命令"}
              </button>
            </div>
            <p className="type-meta mt-2" role="status" aria-live="polite">
              {copied === "fail" ? "复制失败，请长按命令手动复制" : copied === "ok" ? "已复制，去微信粘贴发给 ClawBot" : ""}
            </p>
            <dl className="def-list type-meta">
              <dt>状态</dt>
              <dd>{BINDING_STATUS[binding?.status ?? ""] ?? binding?.status ?? "未知"}</dd>
              {binding?.wechatUserId ? (
                <>
                  <dt>微信</dt>
                  <dd className="tabular">{binding.wechatUserId.slice(0, 10)}…</dd>
                </>
              ) : null}
              {binding?.boundAt && isBound ? (
                <>
                  <dt>绑定于</dt>
                  <dd className="tabular">{formatTime(binding.boundAt)}</dd>
                </>
              ) : null}
            </dl>
            <div className="actions mt-4">
              <button
                type="button"
                className={`btn-ghost${resetM.isPending ? " is-loading" : ""}`}
                onClick={() => resetM.mutate()}
                disabled={resetM.isPending}
              >
                {resetM.isPending ? <span className="btn-spinner" aria-hidden="true" /> : null}
                重置绑定码
              </button>
              <button
                type="button"
                className={`btn-ghost${disconnectM.isPending ? " is-loading" : ""}`}
                onClick={() => {
                  if (!window.confirm("确认断开与当前微信的绑定？之后微信消息不再关联到本账号。")) return;
                  disconnectM.mutate();
                }}
                disabled={disconnectM.isPending || binding?.status !== "active"}
              >
                {disconnectM.isPending ? <span className="btn-spinner" aria-hidden="true" /> : null}
                断开绑定
              </button>
            </div>
            {resetM.isError || disconnectM.isError ? (
              <p className="notice notice--error mt-3" role="alert">
                <span className="notice-tag">出错</span>
                <span>操作失败，请稍后重试</span>
              </p>
            ) : null}
          </section>
        </div>

        <div className="console-pane console-pane--messages">
          <MessagesPanel
            messages={messages}
            loading={msgQ.isPending}
            failed={msgQ.isError}
            refreshing={msgQ.isFetching && !msgQ.isPending}
            justBound={justBound}
            clearing={clearM.isPending}
            cleared={clearM.isSuccess ? clearM.data.deleted : null}
            onClear={() => {
              if (
                !window.confirm(
                  "确认清空本账号的聊天记录？记录会从控制台隐藏（软删除），不会影响其他用户。",
                )
              ) {
                return;
              }
              clearM.mutate();
            }}
            onGoSetup={() => switchTab("setup")}
            isBound={isBound}
          />
        </div>
      </div>
    </AppShell>
  );
}

function MessagesPanel({
  messages,
  loading,
  failed,
  refreshing,
  justBound,
  clearing,
  cleared,
  onClear,
  onGoSetup,
  isBound,
}: {
  messages: Message[];
  loading: boolean;
  failed: boolean;
  refreshing: boolean;
  justBound: boolean;
  clearing: boolean;
  cleared: number | null;
  onClear: () => void;
  onGoSetup: () => void;
  isBound: boolean;
}) {
  return (
    <section className="panel" aria-labelledby="msg-heading">
      <div className="panel-head">
        <div className="min-w-0">
          <h2 id="msg-heading" className="type-app-title">
            消息记录
          </h2>
          <p className="type-meta mt-1">
            绑定后的微信对话会落在这里（新→旧）
            {refreshing ? " · 同步中…" : ""}
          </p>
        </div>
        <button
          type="button"
          className={`btn-ghost${clearing ? " is-loading" : ""}`}
          disabled={clearing || messages.length === 0}
          onClick={onClear}
        >
          {clearing ? (
            <>
              <span className="btn-spinner" aria-hidden="true" />
              清空中…
            </>
          ) : (
            "清空聊天记录"
          )}
        </button>
      </div>

      {justBound ? (
        <p className="notice mt-3" role="status">
          <span className="notice-tag">已绑定</span>
          <span>现在去微信给 ClawBot 发条消息试试</span>
        </p>
      ) : null}
      {cleared !== null ? (
        <p className="notice mt-3" role="status">
          <span className="notice-tag">已清空</span>
          <span>软删除 {cleared} 条，历史数据保留</span>
        </p>
      ) : null}
      {failed ? (
        <p className="notice notice--error mt-3" role="alert">
          <span className="notice-tag">出错</span>
          <span>消息加载失败，稍后会自动重试</span>
        </p>
      ) : null}

      {loading ? (
        <ul className="timeline" aria-busy="true" aria-label="消息加载中">
          {[0, 1, 2].map((i) => (
            <li key={i} className="timeline-row">
              <span className="skeleton" style={{ width: "30%" }} />
              <span className="skeleton mt-2" style={{ width: `${80 - i * 15}%` }} />
            </li>
          ))}
        </ul>
      ) : messages.length === 0 ? (
        <div className="timeline-empty mt-4">
          <p className="type-meta">暂无消息</p>
          {!isBound ? (
            <button type="button" className="btn-ghost mt-3 lg:hidden" onClick={onGoSetup}>
              去扫码与绑定
            </button>
          ) : (
            <p className="type-meta mt-1">在微信里给 ClawBot 发消息，对话会出现在这里</p>
          )}
        </div>
      ) : (
        <ul className="timeline">
          {messages.map((m) => (
            <li key={m.id} className={`timeline-row timeline-row--${m.role}`}>
              <div className="timeline-meta">
                <span className={`timeline-role${m.role === "assistant" ? " is-self" : ""}`}>
                  {ROLE_LABEL[m.role] ?? m.role}
                </span>
                <time
                  className="tabular"
                  dateTime={m.createdAt}
                  title={new Date(m.createdAt).toLocaleString("zh-CN", { hour12: false })}
                >
                  {formatTime(m.createdAt)}
                </time>
              </div>
              <p className="timeline-body">{m.content}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
