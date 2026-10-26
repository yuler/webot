import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchBotStatus } from "@/lib/api";

export const BOT_STATUS_KEY = ["bot-status"] as const;

export function useBotStatus() {
  return useQuery({
    queryKey: BOT_STATUS_KEY,
    queryFn: fetchBotStatus,
    refetchInterval: 2000,
  });
}

/**
 * Per-user ClawBot QR on /console.
 * Status + PNG come from authenticated /api/bot/* (isolated by SaaS userId).
 */
export function ClawQr() {
  const [rev, setRev] = useState("");
  const [imgFailed, setImgFailed] = useState(false);
  const statusQ = useBotStatus();

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
  const src = `/api/bot/qrcode.png?rev=${encodeURIComponent(rev)}`;
  const failed = statusQ.isError || imgFailed || data?.status === "error";

  let hint = data?.message || "加载中…";
  if (botReady) {
    hint = data?.message || "ClawBot 已上线，可直接用下方绑定码关联微信";
  } else if (statusQ.isError) {
    hint = "无法获取扫码状态，请稍后刷新";
  } else if (imgFailed) {
    hint = "二维码图片加载失败，请刷新重试";
  } else if (data?.status === "scaned") {
    hint = "已扫码，请在手机微信上点「确认」";
  } else if (!showQr && (data?.status === "starting" || data?.status === "idle")) {
    hint = data.message || "正在申请登录二维码…";
  }

  return (
    <div className="qr-box">
      {botReady ? (
        <div className="qr-ready">
          <span className="status-dot is-on">ClawBot 已上线</span>
        </div>
      ) : showQr ? (
        <>
          <img
            className="qr-code"
            alt="ClawBot 登录二维码"
            src={src}
            width={260}
            height={260}
            onError={() => setImgFailed(true)}
          />
          <div className="only-touch type-meta">
            <p>手机上无法扫描本机屏幕：长按二维码保存到相册，再在扫码界面选择相册里的这张图；或在电脑上打开本页扫码。</p>
            <a className="btn-ghost mt-3" href={src} download="webot-clawbot-qr.png">
              保存二维码
            </a>
          </div>
        </>
      ) : (
        <div className="qr-placeholder" aria-hidden="true">
          {failed ? "二维码不可用" : <span className="btn-spinner" />}
        </div>
      )}
      <p className="type-meta text-ink" role="status" aria-live="polite">
        {hint}
      </p>
      {failed ? (
        <button type="button" className="btn-ghost" onClick={() => window.location.reload()}>
          刷新页面
        </button>
      ) : null}
    </div>
  );
}
