import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { requestOtp, verifyOtp } from "@/lib/api";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  const send = useMutation({
    mutationFn: () => requestOtp(email),
    onSuccess: () => {
      setError("");
      setInfo("验证码已发送（开发环境请看 API 终端日志 / data/otp-dev.log）");
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
      <nav className="mb-4 flex gap-3 text-sm text-sky-300">
        <Link to="/clawbot">ClawBot 扫码</Link>
      </nav>
      <h1 className="text-xl font-semibold">邮箱验证码登录</h1>
      <p className="mt-2 text-sm text-zinc-400">
        输入邮箱收取 6 位验证码。未配置 Resend 时验证码打印在服务端日志。
      </p>
      <div className="mt-6 space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-5">
        <label className="block text-sm text-zinc-300">
          邮箱
          <input
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
          />
        </label>
        <label className="block text-sm text-zinc-300">
          验证码
          <input
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6 位数字"
          />
        </label>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold"
            onClick={() => send.mutate()}
            disabled={send.isPending || !email}
          >
            发送验证码
          </button>
          <button
            type="button"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold"
            onClick={() => verify.mutate()}
            disabled={verify.isPending || !email || code.length < 6}
          >
            登录
          </button>
        </div>
        {info ? <p className="text-sm text-emerald-300">{info}</p> : null}
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>
    </main>
  );
}
