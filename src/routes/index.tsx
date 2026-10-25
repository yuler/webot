import { createFileRoute, Link, getRouteApi } from "@tanstack/react-router";
import { AppBar } from "@/components/AppBar";

const rootRouteApi = getRouteApi("__root__");

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const STEPS = [
  {
    n: "01",
    title: "邮箱登录",
    body: "填写邮箱，点开邮件里的魔法链接进入控制台。",
  },
  {
    n: "02",
    title: "扫码或绑定",
    body: "在控制台扫码让 ClawBot 上线，并复制 /bind 命令发到微信。",
  },
  {
    n: "03",
    title: "开始聊天",
    body: "绑定后微信消息由 DeepSeek 回复，历史可在控制台回看。",
  },
] as const;

function LandingPage() {
  const { me } = rootRouteApi.useRouteContext();
  const loggedIn = Boolean(me);

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <AppBar />

      <section className="landing-hero">
        <p className="type-kicker text-ink">WEBOT</p>
        <h1 className="type-title mt-3">微信里的 AI 助手</h1>
        <p className="type-meta mt-3 max-w-xl">
          用邮箱魔法链接登录，在控制台扫码并复制绑定命令，即可在微信里和 DeepSeek
          对话。
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {loggedIn ? (
            <Link to="/console" className="btn-solid">
              控制台
            </Link>
          ) : (
            <Link to="/login" className="btn-solid">
              登录
            </Link>
          )}
        </div>
      </section>

      <section className="panel mt-8" aria-labelledby="how-heading">
        <h2 id="how-heading" className="type-app-title">
          怎么用
        </h2>
        <ol className="landing-list mt-4">
          {STEPS.map((s) => (
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
        <div className="mt-5 flex flex-wrap gap-2">
          {loggedIn ? (
            <Link to="/console" className="btn-solid">
              去控制台扫码 / 绑定
            </Link>
          ) : (
            <Link to="/login" className="btn-solid">
              先登录
            </Link>
          )}
        </div>
      </section>

      <footer className="panel type-meta">
        登录只要邮箱魔法链接；扫码与绑定都在控制台。生产站{" "}
        <a href="https://webot.yuler.cc/" className="text-ink">
          webot.yuler.cc
        </a>
        。
      </footer>
    </main>
  );
}
