import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchBotStatus } from "@/lib/api";

/**
 * ClawBot login QR for the console.
 * Root cause of "never shown": when the worker already has a session,
 * `/status` returns botReady + empty rev and `/qrcode.png` 404s — so we
 * hide the <img> and show an explicit online state instead of a blank box.
 * While waiting for scan, rev + PNG are set and the image renders here.
 */
export function ClawQr() {
  const [rev, setRev] = useState("");
  const [imgFailed, setImgFailed] = useState(false);
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
    if (data.rev !== rev) {
      setRev(data.rev);
      setImgFailed(false);
    }
  }, [statusQ.data, rev]);

  const data = statusQ.data;
  const botReady = Boolean(data?.botReady);
  const hasQr = Boolean(data?.hasQr ?? (rev && data?.status !== "error"));
  const showQr =
    Boolean(rev) && hasQr && !botReady && data?.status !== "error" && !imgFailed;
  const src = `/qrcode.png?rev=${encodeURIComponent(rev)}`;

  let hint = data?.message || "加载中…";
  if (botReady) {
    hint = data?.message || "ClawBot 已上线，可直接用下方绑定码关联微信";
  } else if (statusQ.isError) {
    hint = "无法获取扫码状态，请稍后刷新";
  } else if (imgFailed) {
    hint = "二维码图片加载失败，请刷新重试";
  } else if (!showQr && data?.status === "starting") {
    hint = data.message || "正在申请登录二维码…";
  }

  return (
    <div className="mt-4 text-center">
      {showQr ? (
        <img
          className="qr-code"
          alt="ClawBot 登录二维码"
          src={src}
          onError={() => setImgFailed(true)}
        />
      ) : botReady ? (
        <div className="qr-ready type-meta text-ink" role="status">
          ClawBot 已上线
        </div>
      ) : null}
      <p className="type-meta mt-3 text-ink">{hint}</p>
    </div>
  );
}
