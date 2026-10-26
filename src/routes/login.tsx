import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { requestOtp, verifyOtp } from "@/lib/api";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const RESEND_COOLDOWN_SEC = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Server errors are English; show them in the UI language. */
function toChineseError(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("failed attempts")) return "尝试次数过多，请稍后再试";
  if (s.includes("too many") && s.includes("minute")) return "发送太频繁，请一分钟后再试";
  if (s.includes("too many")) return "发送次数过多，请稍后再试";
  if (s.includes("invalid email")) return "邮箱格式不正确";
  if (s.includes("expired link")) return "登录链接无效或已过期，请重新发送";
  if (s.includes("expired")) return "验证码无效或已过期，请重新发送";
  if (s.includes("invalid") || s.includes("code")) return "验证码不正确，请检查后重试";
  if (s.includes("failed to fetch") || s.includes("network")) return "网络异常，请检查连接后重试";
  return raw;
}

function Spinner() {
  return <span className="btn-spinner" aria-hidden="true" />;
}

function LoginPage() {
  const navigate = useNavigate();
  const codeRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("error");
    if (fromUrl) setError(toChineseError(fromUrl));
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const send = useMutation({
    mutationFn: (to: string) => requestOtp(to),
    onSuccess: (_data, to) => {
      setError("");
      setSentTo(to);
      setCooldown(RESEND_COOLDOWN_SEC);
    },
    onError: (e: Error) => setError(toChineseError(e.message)),
  });

  const verify = useMutation({
    mutationFn: (c: string) => verifyOtp(sentTo || email.trim(), c),
    onSuccess: () => navigate({ to: "/console" }),
    onError: (e: Error) => {
      setError(toChineseError(e.message));
      setCode("");
      codeRef.current?.focus();
    },
  });

  const busy = send.isPending || verify.isPending;
  const trimmed = email.trim();
  const emailValid = EMAIL_RE.test(trimmed);

  function onSend(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!emailValid) {
      setError("邮箱格式不正确");
      return;
    }
    send.mutate(trimmed);
  }

  function onVerify(e?: FormEvent) {
    e?.preventDefault();
    if (busy || code.length < 6) return;
    verify.mutate(code);
  }

  function onCodeChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (error) setError("");
    if (digits.length === 6 && !busy && (sentTo || emailValid)) verify.mutate(digits);
  }

  function changeEmail() {
    setSentTo("");
    setCode("");
    setError("");
    send.reset();
  }

  const errorNotice = error ? (
    <p className="notice notice--error" role="alert">
      <span className="notice-tag">出错</span>
      <span>{error}</span>
    </p>
  ) : null;

  return (
    <AppShell size="md">
      <div className="page-head">
        <div>
          <h1 className="type-title">登录</h1>
          <p className="type-meta mt-2">
            输入邮箱，我们会发送<strong className="text-strong">魔法链接</strong>
            。点开链接即可登录并进入控制台。
          </p>
        </div>
      </div>

      <section className="panel" aria-label="邮箱登录">
        {sentTo ? (
          <div className="auth-sent" aria-live="polite">
            <p className="notice" role="status">
              <span className="notice-tag">已发送</span>
              <span>
                登录链接已发到 <span className="text-strong">{sentTo}</span>，点开即可进入控制台
              </span>
            </p>
            <p className="type-meta">没收到？看看垃圾邮件箱，或稍后重新发送。</p>
            <div className="actions">
              <button
                type="button"
                className={`btn-ghost${send.isPending ? " is-loading" : ""}`}
                disabled={busy || cooldown > 0}
                aria-busy={send.isPending}
                onClick={() => send.mutate(sentTo)}
              >
                {send.isPending ? <Spinner /> : null}
                {cooldown > 0 ? (
                  <span className="tabular">重新发送（{cooldown}s）</span>
                ) : (
                  "重新发送"
                )}
              </button>
              <button type="button" className="btn-ghost" disabled={busy} onClick={changeEmail}>
                换个邮箱
              </button>
            </div>
            {errorNotice}
          </div>
        ) : (
          <form className="auth-form" onSubmit={onSend} noValidate>
            <label className="field-label type-meta">
              邮箱
              <input
                className="field mt-1"
                type="email"
                name="email"
                inputMode="email"
                enterKeyHint="send"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError("");
                }}
                placeholder="you@example.com"
                disabled={busy}
                aria-invalid={Boolean(error) || undefined}
              />
            </label>
            {errorNotice}
            <button
              type="submit"
              className={`btn-solid btn-block${send.isPending ? " is-loading" : ""}`}
              disabled={busy || !trimmed}
              aria-busy={send.isPending}
            >
              {send.isPending ? (
                <>
                  <Spinner />
                  发送中…
                </>
              ) : (
                "发送登录链接"
              )}
            </button>
          </form>
        )}
      </section>

      <section className="panel">
        <details className="disclosure" open={Boolean(sentTo)}>
          <summary>收不到链接？用 6 位验证码登录</summary>
          <form className="auth-form mt-3" onSubmit={onVerify}>
            <p className="type-meta">
              邮件里同时附有 6 位验证码。{sentTo ? "" : "请先在上方填写邮箱并发送。"}
            </p>
            <label className="field-label type-meta">
              验证码
              <input
                ref={codeRef}
                className="field field--code mt-1"
                name="code"
                inputMode="numeric"
                pattern="[0-9]*"
                enterKeyHint="go"
                maxLength={6}
                value={code}
                onChange={(e) => onCodeChange(e.target.value)}
                placeholder="000000"
                autoComplete="one-time-code"
                disabled={busy}
              />
            </label>
            <button
              type="submit"
              className={`btn-ghost btn-block${verify.isPending ? " is-loading" : ""}`}
              disabled={busy || !(sentTo || emailValid) || code.length < 6}
              aria-busy={verify.isPending}
            >
              {verify.isPending ? (
                <>
                  <Spinner />
                  登录中…
                </>
              ) : (
                "用验证码登录"
              )}
            </button>
          </form>
        </details>
      </section>
    </AppShell>
  );
}
