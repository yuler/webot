import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { fetchBotStatus } from "@/lib/api";

export const Route = createFileRoute("/clawbot")({
  component: ClawBotPage,
});

function ClawBotPage() {
  const [rev, setRev] = useState("");
  const statusQ = useQuery({
    queryKey: ["bot-status"],
    queryFn: fetchBotStatus,
    refetchInterval: 2000,
  });

  useEffect(() => {
    const data = statusQ.data;
    if (!data?.rev) return;
    const hold =
      data.status === "scaned" || data.status === "confirmed" || data.status === "ready";
    if (hold && rev) return;
    if (data.rev !== rev) setRev(data.rev);
  }, [statusQ.data, rev]);

  const data = statusQ.data;
  const showQr = Boolean(rev) && !data?.botReady && data?.status !== "error";
  const src = `/qrcode.png?rev=${encodeURIComponent(rev)}`;

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <header className="app-bar">
        <nav className="app-bar-nav">
          <span className="type-kicker text-ink">WEBOT</span>
          <Link to="/login">邮箱登录</Link>
          <Link to="/console">控制台</Link>
        </nav>
        <ThemeSwitch />
      </header>

      <h1 className="type-title text-center">微信 ClawBot 扫码</h1>
      <p className="type-meta mt-2 text-center">
        微信 → 我 → 设置 → 插件 → ClawBot，扫描并确认。这是进程级 Bot
        登录，不是账号 OAuth。
      </p>

      <section className="panel mt-6 text-center">
        {showQr ? <img className="qr-code" alt="登录二维码" src={src} /> : null}
        <p className="type-meta mt-3 text-ink">{data?.message || "加载中…"}</p>
      </section>
    </main>
  );
}
