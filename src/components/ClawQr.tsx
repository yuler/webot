import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchBotStatus } from "@/lib/api";

export function ClawQr() {
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
    <div className="mt-4 text-center">
      {showQr ? <img className="qr-code" alt="登录二维码" src={src} /> : null}
      <p className="type-meta mt-3 text-ink">{data?.message || "加载中…"}</p>
    </div>
  );
}
