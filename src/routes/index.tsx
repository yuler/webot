import { createFileRoute, Link, getRouteApi } from "@tanstack/react-router";
import introCaptions from "@/assets/intro.vtt";
import introPoster from "@/assets/intro-poster.jpg";
import introVideo from "@/assets/intro.mp4";
import { AppShell } from "@/components/AppShell";

const rootRouteApi = getRouteApi("__root__");

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const POINTS = ["不用装 App，微信里直接聊", "邮箱魔法链接一键登录", "对话记录在控制台随时回看"] as const;

const STEPS = [
  {
    n: "01",
    title: "邮箱登录",
    body: "填写邮箱，点开邮件里的魔法链接或输入 6 位验证码进入控制台。",
  },
  {
    n: "02",
    title: "微信扫码",
    body: "在控制台扫描二维码，启动 ClawBot 机器人服务并获取专属绑定码。",
  },
  {
    n: "03",
    title: "指令绑定",
    body: "打开微信向 WeixinClawBot 发送 /bind 指令，秒级完成微信绑定。",
  },
  {
    n: "04",
    title: "开始对话",
    body: "绑定后微信消息由 AI 智能回复，对话记录在控制台随时回看。",
  },
] as const;

function LandingPage() {
  const { me } = rootRouteApi.useRouteContext();
  const loggedIn = Boolean(me);

  return (
    <AppShell size="lg">
      <section className="landing-hero" aria-labelledby="hero-heading">
        <div className="landing-hero-copy">
          <h1 id="hero-heading" className="type-title">
            微信里的 AI 助手
          </h1>
          <p className="type-meta max-w-xl">
            用邮箱魔法链接登录，在控制台扫码并复制绑定命令，即可在微信里和 AI 助手对话。
          </p>
          <ul className="landing-points type-meta">
            {POINTS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <div className="actions">
            {loggedIn ? (
              <Link to="/console" className="btn-solid">
                进入控制台
              </Link>
            ) : (
              <Link to="/login" className="btn-solid">
                用邮箱开始
              </Link>
            )}
            <a href="#how" className="btn-ghost">
              怎么用
            </a>
          </div>
        </div>

        <figure className="landing-video m-0">
          <video
            controls
            playsInline
            preload="metadata"
            poster={introPoster}
            aria-label="WeBot 使用简介"
          >
            <source src={introVideo} type="video/mp4" />
            <track kind="captions" src={introCaptions} srcLang="zh" label="中文字幕" default />
          </video>
          <figcaption className="type-meta">4 步上手演示（带中文字幕）</figcaption>
        </figure>
      </section>

      <section id="how" className="panel" aria-labelledby="how-heading">
        <h2 id="how-heading" className="type-app-title">
          怎么用
        </h2>
        <ol className="landing-steps">
          {STEPS.map((s) => (
            <li key={s.n} className="landing-step">
              <span className="type-kicker text-ink tabular">{s.n}</span>
              <div>
                <h3 className="text-strong" style={{ fontSize: 15 }}>
                  {s.title}
                </h3>
                <p className="type-meta mt-1">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="actions mt-6">
          {loggedIn ? (
            <Link to="/console" className="btn-solid btn-block">
              去控制台扫码 / 绑定
            </Link>
          ) : (
            <Link to="/login" className="btn-solid btn-block">
              先登录
            </Link>
          )}
        </div>
      </section>
    </AppShell>
  );
}
