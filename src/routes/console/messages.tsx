import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clearMessages, fetchMe, fetchMessages, type Message } from "@/lib/api";

export const Route = createFileRoute("/console/messages")({
  component: ConsoleMessagesPage,
});

const ROLE_LABEL: Record<string, string> = {
  user: "微信",
  assistant: "WeBot",
  system: "系统",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const hm = d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (d.toDateString() === now.toDateString()) return hm;
  const md = `${d.getMonth() + 1}月${d.getDate()}日`;
  return d.getFullYear() === now.getFullYear() ? `${md} ${hm}` : `${d.getFullYear()}年${md} ${hm}`;
}

function ConsoleMessagesPage() {
  const qc = useQueryClient();

  const meQ = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
  });

  const msgQ = useQuery({
    queryKey: ["messages"],
    queryFn: () => fetchMessages(100),
    refetchInterval: 5000,
  });

  const clearM = useMutation({
    mutationFn: clearMessages,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      qc.invalidateQueries({ queryKey: ["deleted-messages"] });
    },
  });

  const binding = meQ.data?.binding;
  const isBound = binding?.status === "active" && Boolean(binding.wechatUserId);
  const messages = msgQ.data?.messages ?? [];

  return (
    <section className="panel" aria-labelledby="msg-heading">
      <div className="panel-head">
        <div className="min-w-0">
          <h2 id="msg-heading" className="type-app-title">
            消息记录
          </h2>
          <p className="type-meta mt-1">
            绑定后的微信对话会落在这里（新→旧）
            {msgQ.isFetching && !msgQ.isPending ? " · 同步中…" : ""}
          </p>
        </div>
        <div className="actions">
          <Link to="/console/messages/deleted" className="btn-ghost">
            查看已删除消息
          </Link>
          <button
            type="button"
            className={`btn-ghost${clearM.isPending ? " is-loading" : ""}`}
            disabled={clearM.isPending || messages.length === 0}
            onClick={() => {
              if (
                !window.confirm(
                  "确认清空本账号的聊天记录？记录会从控制台隐藏（软删除），不会影响其他用户。",
                )
              ) {
                return;
              }
              clearM.mutate();
            }}
          >
            {clearM.isPending ? (
              <>
                <span className="btn-spinner" aria-hidden="true" />
                清空中…
              </>
            ) : (
              "清空聊天记录"
            )}
          </button>
        </div>
      </div>

      {clearM.isSuccess ? (
        <p className="notice mt-3" role="status">
          <span className="notice-tag">已清空</span>
          <span>软删除 {clearM.data.deleted} 条，历史数据保留（可在“查看已删除消息”中查看）</span>
        </p>
      ) : null}

      {msgQ.isError ? (
        <p className="notice notice--error mt-3" role="alert">
          <span className="notice-tag">出错</span>
          <span>消息加载失败，稍后会自动重试</span>
        </p>
      ) : null}

      {msgQ.isPending ? (
        <ul className="timeline mt-4" aria-busy="true" aria-label="消息加载中">
          {[0, 1, 2].map((i) => (
            <li key={i} className="timeline-row">
              <span className="skeleton" style={{ width: "30%" }} />
              <span className="skeleton mt-2" style={{ width: `${80 - i * 15}%` }} />
            </li>
          ))}
        </ul>
      ) : messages.length === 0 ? (
        <div className="timeline-empty mt-4">
          <p className="type-meta">暂无活动消息</p>
          {!isBound ? (
            <Link to="/console" className="btn-ghost mt-3">
              去扫码与绑定
            </Link>
          ) : (
            <p className="type-meta mt-1">在微信里给 ClawBot 发消息，对话会出现在这里</p>
          )}
        </div>
      ) : (
        <ul className="timeline mt-4">
          {messages.map((m: Message) => (
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
