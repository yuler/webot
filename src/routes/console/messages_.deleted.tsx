import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchDeletedMessages, type Message } from "@/lib/api";

export const Route = createFileRoute("/console/messages_/deleted")({
  component: ConsoleDeletedMessagesPage,
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

function ConsoleDeletedMessagesPage() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const deletedQ = useQuery({
    queryKey: ["deleted-messages", page],
    queryFn: () => fetchDeletedMessages(page, limit),
  });

  const messages = deletedQ.data?.messages ?? [];
  const total = deletedQ.data?.total ?? 0;
  const totalPages = deletedQ.data?.totalPages ?? 1;

  return (
    <section className="panel" aria-labelledby="deleted-msg-heading">
      <div className="panel-head">
        <div className="min-w-0">
          <h2 id="deleted-msg-heading" className="type-app-title">
            已删除历史消息
          </h2>
          <p className="type-meta mt-1">
            软删除的消息历史归档（只读） · 共 {total} 条
          </p>
        </div>
        <Link to="/console/messages" className="btn-ghost">
          返回活动消息
        </Link>
      </div>

      {deletedQ.isError ? (
        <p className="notice notice--error mt-3" role="alert">
          <span className="notice-tag">出错</span>
          <span>已删除消息加载失败，请稍后重试</span>
        </p>
      ) : null}

      {deletedQ.isPending ? (
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
          <p className="type-meta">暂无已删除历史消息</p>
          <Link to="/console/messages" className="btn-ghost mt-3">
            返回活动消息
          </Link>
        </div>
      ) : (
        <>
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
                    发送于 {formatTime(m.createdAt)}
                  </time>
                </div>
                <p className="timeline-body">{m.content}</p>
              </li>
            ))}
          </ul>

          <div className="pagination" aria-label="已删除消息分页">
            <span className="type-meta tabular">
              第 {page} / {totalPages} 页（共 {total} 条）
            </span>
            <div className="pagination-pages">
              <button
                type="button"
                className="btn-ghost"
                disabled={page <= 1 || deletedQ.isPending}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={page >= totalPages || deletedQ.isPending}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                下一页
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
