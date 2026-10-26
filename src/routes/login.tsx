import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { OtpField } from "@/components/OtpField";
import { requestOtp, verifyOtp } from "@/lib/api";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const RESEND_COOLDOWN_SEC = 60;
const CODE_LENGTH = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Server errors are English; show them in the UI language. */
function toChineseError(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("failed attempts")) return "尝试次数过多，请稍后再试";
  if (s.includes("too many") && s.includes("minute")) return "发送太频繁，请一分钟后再试";
  if (s.includes("too many")) return "发送次数过多，请稍后再试";
  if (s.includes("invalid email")) return "邮箱格式不正确";
  if (s.includes("expired link")) return "登录链接无效或已过期，请重新发送";
  if (s.includes("expired")) return "验证码不对或已过期，请核对邮件里最新的验证码";
  if (s.includes("invalid") || s.includes("code")) return "验证码不正确，请检查后重试";
  if (s.includes("failed to fetch") || s.includes("network")) return "网络异常，请检查连接后重试";
  return raw;
}

function Spinner() {
  return <span className="btn-spinner" aria-hidden="true" />;
}

function ErrorNotice({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className="notice notice--error" role="alert">
      <span className="notice-tag">出错</span>
      <span>{message}</span>
    </p>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const codeRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const [codeInvalid, setCodeInvalid] = useState(false);

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
      setCode("");
      setCodeInvalid(false);
      setSentTo(to);
      setCooldown(RESEND_COOLDOWN_SEC);
    },
    onError: (e: Error) => setError(toChineseError(e.message)),
  });

  const verify = useMutation({
    mutationFn: (c: string) => verifyOtp(sentTo, c),
    onSuccess: () => navigate({ to: "/console" }),
    onError: (e: Error) => {
      setError(toChineseError(e.message));
      setCodeInvalid(true);
      setCode("");
      window.setTimeout(() => codeRef.current?.focus(), 0);
    },
  });

  const busy = send.isPending || verify.isPending;
  const trimmed = email.trim();

  function onSend(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!EMAIL_RE.test(trimmed)) {
      setError("邮箱格式不正确");
      return;
    }
    send.mutate(trimmed);
  }

  function onVerify(e: FormEvent) {
    e.preventDefault();
    if (busy || code.length < CODE_LENGTH) return;
    verify.mutate(code);
  }

  function onCodeChange(digits: string) {
    setCode(digits);
    if (error) setError("");
    if (codeInvalid) setCodeInvalid(false);
    if (digits.length === CODE_LENGTH && !busy) verify.mutate(digits);
  }

  function changeEmail() {
    setSentTo("");
    setCode("");
    setError("");
    setCodeInvalid(false);
    send.reset();
  }

  return (
    <AppShell size="md">
      <div className="page-head">
        <div>
          <h1 className="type-title">{sentTo ? "查收邮件" : "登录"}</h1>
          <p className="type-meta mt-2">
            {sentTo ? (
              <>
                已发到 <span className="text-strong">{sentTo}</span>。输入邮件里的 6
                位验证码，或直接点开邮件里的魔法链接。
              </>
            ) : (
              <>
                输入邮箱，我们会发一封邮件，里面有<strong className="text-strong">魔法链接</strong>
                和 <strong className="text-strong">6 位验证码</strong>，任选其一即可登录。
              </>
            )}
          </p>
        </div>
      </div>

      {sentTo ? (
        <section className="panel auth-form" aria-label="输入验证码">
          <form className="auth-form" onSubmit={onVerify}>
            <OtpField
              ref={codeRef}
              value={code}
              onChange={onCodeChange}
              length={CODE_LENGTH}
              disabled={verify.isPending}
              invalid={codeInvalid}
              autoFocus
            />
            <ErrorNotice message={error} />
            <button
              type="submit"
              className={`btn-solid btn-block${verify.isPending ? " is-loading" : ""}`}
              disabled={busy || code.length < CODE_LENGTH}
              aria-busy={verify.isPending}
            >
              {verify.isPending ? (
                <>
                  <Spinner />
                  登录中…
                </>
              ) : (
                "登录"
              )}
            </button>
          </form>

          <div className="actions">
            <button
              type="button"
              className={`btn-ghost${send.isPending ? " is-loading" : ""}`}
              disabled={busy || cooldown > 0}
              aria-busy={send.isPending}
              onClick={() => send.mutate(sentTo)}
            >
              {send.isPending ? <Spinner /> : null}
              {cooldown > 0 ? <span className="tabular">重新发送（{cooldown}s）</span> : "重新发送"}
            </button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={changeEmail}>
              换个邮箱
            </button>
          </div>
          <p className="type-meta">没收到？看看垃圾邮件箱。链接和验证码 10 分钟内有效，用掉一个后其余的都会失效。</p>

          <LoginTips />
        </section>
      ) : (
        <section className="panel" aria-label="邮箱登录">
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
            <ErrorNotice message={error} />
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
        </section>
      )}
    </AppShell>
  );
}

function LoginTips() {
  return (
    <dl className="tips type-meta" aria-label="魔法链接和验证码的区别">
      <div>
        <dt>魔法链接</dt>
        <dd>点一下就登录。但链接在哪个浏览器打开，就登录哪个浏览器，适合邮件和登录在同一台设备上。</dd>
      </div>
      <div>
        <dt>6 位验证码</dt>
        <dd>在这个页面输入。适合邮件在手机上看、却要在电脑上登录，或邮箱 App 用内置浏览器打开了链接。</dd>
      </div>
    </dl>
  );
}
