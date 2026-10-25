import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { AppBar } from "@/components/AppBar";
import { requestOtp, verifyOtp } from "@/lib/api";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const INTRO_STEPS = [
  {
    n: "01",
    title: "邮箱登录",
    body: "填写邮箱，同一封邮件里会收到魔法链接和 6 位验证码，任选其一即可进入控制台。",
  },
  {
    n: "02",
    title: "扫码 ClawBot",
    body: "打开 /clawbot，用微信「我 → 设置 → 插件 → ClawBot」扫码，让机器人上线。",
  },
  {
    n: "03",
    title: "发送绑定码",
    body: "在控制台复制绑定码，微信发给已扫码的 ClawBot（也可发 /bind CODE）。每人同时只有一个有效绑定。",
  },
  {
    n: "04",
    title: "对话与回看",
    body: "绑定后微信消息由 DeepSeek 回复并落库；随时在控制台查看历史。",
  },
] as const;

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
      setInfo("魔法链接和 6 位验证码已发到这个邮箱，任选其一登录。");
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
    <main className="mx-auto max-w-2xl px-5 py-10">
      <AppBar />

      <section className="landing-hero">
        <p className="type-kicker text-ink">CLAWBOT + DEEPSEEK</p>
        <h1 className="type-title mt-3">魔法链接 / 验证码登录</h1>
        <p className="type-meta mt-3 max-w-xl">
          WeBot 把 ClawBot（微信 iLink）、DeepSeek 回复和邮箱登录控制台串在一起：邮箱登录 →
          发绑定码给 ClawBot → 自动回复 → 在控制台回看消息。登录只用邮箱魔法链接或 6
          位验证码。
        </p>
        <p className="type-meta mt-2 max-w-xl">
          流程概览：邮箱登录 → 微信发绑定码给 ClawBot → DeepSeek 回复 → 控制台看消息。也可先回{" "}
          <Link to="/" className="text-ink">
            首页
          </Link>{" "}
          了解更多。
        </p>
      </section>

      <section className="panel mt-6" aria-labelledby="login-form-heading">
        <h2 id="login-form-heading" className="type-app-title">
          登录
        </h2>
        <p className="type-meta mt-2">
          输入邮箱后会收到<strong className="text-ink">魔法链接</strong>和 6
          位验证码，点击链接或填写验证码即可登录。
        </p>

        <label className="type-meta mt-5 block">
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
        <label className="type-meta mt-4 block">
          验证码
          <input
            className="field mt-1"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6 位数字"
          />
        </label>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-solid"
            onClick={() => send.mutate()}
            disabled={send.isPending || !email}
          >
            发送登录邮件
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => verify.mutate()}
            disabled={verify.isPending || !email || code.length < 6}
          >
            用验证码登录
          </button>
        </div>
        {info ? <p className="type-meta mt-3 text-ink">{info}</p> : null}
        {error ? (
          <p className="type-meta mt-3" style={{ color: "#c44" }}>
            {error}
          </p>
        ) : null}
      </section>

      <section className="panel" aria-labelledby="login-how-heading">
        <h2 id="login-how-heading" className="type-app-title">
          登录之后怎么用
        </h2>
        <ol className="landing-list mt-4">
          {INTRO_STEPS.map((s) => (
            <li key={s.n} className="landing-list-item">
              <span className="type-kicker text-ink">{s.n}</span>
              <div>
                <h3 className="type-meta text-ink" style={{ fontWeight: 500 }}>
                  {s.title}
                </h3>
                <p className="type-meta mt-1">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-5">
          <Link to="/clawbot" className="btn-ghost">
            打开 ClawBot 扫码页
          </Link>
        </div>
      </section>
    </main>
  );
}
