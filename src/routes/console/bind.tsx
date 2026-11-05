import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ClawQr } from "@/components/ClawQr";
import {
  disconnectBinding,
  fetchMe,
  resetBindCode,
} from "@/lib/api";

export const Route = createFileRoute("/console/bind")({
  component: ConsoleSetupPage,
});

const BINDING_STATUS: Record<string, string> = {
  active: "已绑定",
  pending: "待绑定",
  disconnected: "已断开",
};

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

export function ConsoleSetupPage() {
  const qc = useQueryClient();
  const meQ = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
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
  const bindCommand = binding?.bindCode ? `/bind ${binding.bindCode}` : "";
  const isBound = binding?.status === "active" && Boolean(binding.wechatUserId);

  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(null), 1800);
    return () => window.clearTimeout(t);
  }, [copied]);

  async function onCopy() {
    if (!bindCommand) return;
    setCopied((await copyText(bindCommand)) ? "ok" : "fail");
  }

  return (
    <div className="console-setup-grid">
      <section className="panel" id="scan" aria-labelledby="scan-heading">
        <h2 id="scan-heading" className="type-app-title">
          <span className="panel-step type-kicker" aria-hidden="true">01</span>扫码上线
        </h2>
        <p className="type-meta mt-2">
          微信 → 我 → 设置 → 插件 → ClawBot，扫描下方二维码并确认登录。
          ClawBot 已上线后，在微信中直接发消息即可自动关联对话；若需切换微信号，可随时点击下方重新扫码。
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
            : "扫码上线后，在微信中直接给 ClawBot 发送任意消息即可自动绑定并开始对话；也可发送下方命令手动绑定。"}
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
  );
}
