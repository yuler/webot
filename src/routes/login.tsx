import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { AppBar } from "@/components/AppBar";
import { requestOtp, verifyOtp } from "@/lib/api";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("error") || "";
  });

  const send = useMutation({
    mutationFn: () => requestOtp(email),
    onSuccess: () => {
      setError("");
      setInfo("登录链接已发到这个邮箱，点开即可进入控制台");
    },
    onError: (e: Error) => {
      setInfo("");
      setError(e.message);
    },
  });

  const verify = useMutation({
    mutationFn: () => verifyOtp(email, code),
    onSuccess: () => navigate({ to: "/console" }),
    onError: (e: Error) => {
      setInfo("");
      setError(e.message);
    },
  });

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <AppBar />

      <h1 className="type-title">登录</h1>
      <p className="type-meta mt-2">
        输入邮箱，我们会发送<strong className="text-ink">魔法链接</strong>
        。点开链接即可登录并进入控制台。
      </p>

      <section className="panel mt-6">
        <label className="type-meta block">
          邮箱
          <input
            className="field mt-1"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
          />
        </label>
        <div className="mt-5">
          <button
            type="button"
            className="btn-solid"
            onClick={() => send.mutate()}
            disabled={send.isPending || !email}
          >
            发送登录链接
          </button>
        </div>
        {info ? <p className="type-meta mt-3 text-ink">{info}</p> : null}
        {error ? (
          <p className="type-meta mt-3" style={{ color: "#c44" }}>
            {error}
          </p>
        ) : null}
      </section>

      <section className="panel mt-2">
        <p className="type-meta">收不到链接时，可用邮件里的 6 位验证码（可选）：</p>
        <label className="type-meta mt-3 block">
          验证码
          <input
            className="field mt-1"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6 位数字"
            autoComplete="one-time-code"
          />
        </label>
        <div className="mt-4">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => verify.mutate()}
            disabled={verify.isPending || !email || code.length < 6}
          >
            用验证码登录
          </button>
        </div>
      </section>
    </main>
  );
}
