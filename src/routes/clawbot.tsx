import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
    if (!data) return;
    const hold =
      data.status === "scaned" || data.status === "confirmed" || data.status === "ready";
    if (!hold && data.rev && data.rev !== rev) setRev(data.rev);
  }, [statusQ.data, rev]);

  const src = rev ? `/qrcode.png?rev=${encodeURIComponent(rev)}` : "/qrcode.png";

  return (
    <main className="mx-auto max-w-md px-5 py-10 text-center">
      <nav className="mb-4 flex justify-center gap-3 text-sm text-sky-300">
        <Link to="/login">邮箱登录</Link>
        <Link to="/console">控制台</Link>
      </nav>
      <h1 className="text-xl font-semibold">微信 ClawBot 扫码</h1>
      <p className="mt-2 text-sm text-zinc-400">
        微信 → 我 → 设置 → 插件 → ClawBot，扫描并确认。这是进程级 Bot 登录，不是账号 OAuth。
      </p>
      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/80 p-5">
        <img
          className="mx-auto w-full max-w-[280px] rounded-xl bg-white"
          alt="登录二维码"
          src={src}
        />
        <p className="mt-3 text-sm">{statusQ.data?.message || "加载中…"}</p>
      </div>
    </main>
  );
}
