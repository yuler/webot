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
    body: "打开 /login，填写邮箱。同一封邮件里有魔法链接和 6 位验证码，点链接或填验证码进入控制台。",
  },
  {
    n: "02",
    title: "扫码 ClawBot",
    body: "打开 /clawbot，用微信「我 → 设置 → 插件 → ClawBot」扫码，让机器人上线。",
  },
  {
    n: "03",
    title: "发送绑定码",
    body: "登录后在控制台复制绑定码，在微信里发给已扫码的 ClawBot（也可发 /bind CODE）。每人同时只有一个有效绑定。",
  },
  {
    n: "04",
    title: "对话与回看",
    body: "绑定后微信消息由 DeepSeek 回复，并写入消息表；在控制台可随时查看历史。",
  },
] as const;

const FEATURES = [
  {
    title: "魔法链接 + 邮箱验证码",
    body: "无短信、无微信 OAuth、无账号密码。同一封邮件里带一键链接和 6 位验证码，10 分钟有效。",
  },
  {
    title: "公开首页 + 控制台",
    body: "任何人都能看首页介绍；游客点「邮箱登录」，登录后顶栏与首页可进「控制台」。",
  },
  {
    title: "绑定码",
    body: "控制台生成绑定码；可重置码或断开绑定，不改邮箱账号。",
  },
  {
    title: "ClawBot（iLink）",
    body: "微信插件长轮询收消息；/clawbot 扫码页负责会话上线。",
  },
  {
    title: "DeepSeek 回复",
    body: "绑定用户发来的消息由 DeepSeek 生成回复，再经 ClawBot 发回微信。",
  },
  {
    title: "消息历史与主题",
    body: "对话落库后在控制台时间线查看；顶栏图标可切换浅色 / 深色主题。",
  },
] as const;

const FAQS = [
  {
    q: "登录需要密码吗？",
    a: "不需要。登录只用邮箱：邮件里的魔法链接，或同一封邮件中的 6 位验证码。",
  },
  {
    q: "收不到登录邮件怎么办？",
    a: "看收件箱和垃圾邮件。邮件里同时有魔法链接和 6 位验证码，10 分钟内有效；也可在登录页重新发送。",
  },
  {
    q: "绑定码发错或过期了？",
    a: "在控制台点「重置绑定码」生成新码，旧码立即失效。再向 ClawBot 发送新码即可。",
  },
  {
    q: "一个人能绑多个微信吗？",
    a: "不能。MVP 每人同时只有一个有效绑定；要换微信先断开，再用新绑定码绑定。",
  },
  {
    q: "需要微信开放平台或短信吗？",
    a: "不需要。登录只用邮箱魔法链接 / 验证码；微信侧走 ClawBot 插件扫码 + 绑定码，没有微信 OAuth / 短信 / WebAuthn。",
  },
  {
    q: "ClawBot 扫码后为什么还不回复？",
    a: "先确认扫码页显示已登录，再确认控制台绑定状态为 active。未绑定用户发消息时，机器人会提示发送绑定码。",
  },
  {
    q: "生产站点在哪？",
    a: "https://webot.yuler.cc/ 。界面规范见仓库根目录 DESIGN.md。",
  },
] as const;

function LandingPage() {
  const { me } = rootRouteApi.useRouteContext();
  const loggedIn = Boolean(me);

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <AppBar />

      <section className="landing-hero">
        <p className="type-kicker text-ink">CLAWBOT + DEEPSEEK</p>
        <h1 className="type-title mt-3">微信里的 AI 助手控制台</h1>
        <p className="type-meta mt-3 max-w-xl">
          WeBot 把 ClawBot（微信 iLink）、DeepSeek 回复和邮箱登录控制台串在一起。首页公开可浏览；游客用魔法链接或验证码登录，登录后进入控制台管理绑定与消息。
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {loggedIn ? (
            <Link to="/console" className="btn-solid">
              控制台
            </Link>
          ) : (
            <Link to="/login" className="btn-solid">
              邮箱登录
            </Link>
          )}
          <Link to="/clawbot" className="btn-ghost">
            打开扫码页
          </Link>
        </div>
      </section>

      <section className="panel mt-8" aria-labelledby="flow-heading">
        <h2 id="flow-heading" className="type-app-title">
          一图看懂
        </h2>
        <p className="type-meta mt-2">
          邮箱登录（魔法链接 / 验证码）→ 微信发绑定码给 ClawBot → DeepSeek 回复 → 控制台看消息
        </p>
        <div className="landing-diagram mt-5">
          <img
            src="/how-it-works.svg"
            alt="WeBot 工作流程：邮箱登录、绑定码、DeepSeek、控制台"
            width={720}
            height={140}
          />
        </div>
      </section>

      <section className="panel" aria-labelledby="how-heading">
        <h2 id="how-heading" className="type-app-title">
          怎么工作
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
      </section>

      <section className="panel" aria-labelledby="feat-heading">
        <h2 id="feat-heading" className="type-app-title">
          核心功能
        </h2>
        <ul className="landing-faq mt-4">
          {FEATURES.map((f) => (
            <li key={f.title} className="landing-faq-item">
              <h3 className="type-meta text-ink" style={{ fontWeight: 500 }}>
                {f.title}
              </h3>
              <p className="type-meta mt-1">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel" aria-labelledby="use-heading">
        <h2 id="use-heading" className="type-app-title">
          怎么用
        </h2>
        <ol className="landing-steps mt-4 type-meta">
          <li>
            打开{" "}
            <Link to="/login" className="text-ink">
              /login
            </Link>
            ，发送登录邮件后点魔法链接，或填写 6 位验证码进入控制台。
          </li>
          <li>
            另开{" "}
            <Link to="/clawbot" className="text-ink">
              /clawbot
            </Link>
            ，用手机微信扫码让 ClawBot 上线。
          </li>
          <li>在控制台复制绑定码，微信发给该 ClawBot。</li>
          <li>开始聊天；回复会出现在微信，历史可在控制台查看。</li>
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          {loggedIn ? (
            <Link to="/console" className="btn-solid">
              进入控制台
            </Link>
          ) : (
            <Link to="/login" className="btn-solid">
              开始登录
            </Link>
          )}
          <Link to="/clawbot" className="btn-ghost">
            ClawBot 扫码
          </Link>
        </div>
      </section>

      <section className="panel" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="type-app-title">
          常见 QA
        </h2>
        <dl className="landing-faq mt-4">
          {FAQS.map((item) => (
            <div key={item.q} className="landing-faq-item">
              <dt className="type-meta text-ink" style={{ fontWeight: 500 }}>
                {item.q}
              </dt>
              <dd className="type-meta mt-1">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="panel type-meta">
        MVP：无多租户 / 短信 / 微信 OAuth / 账号密码。规范见{" "}
        <a
          href="https://github.com/yuler/webot/blob/main/DESIGN.md"
          className="text-ink"
        >
          DESIGN.md
        </a>
        。
      </footer>
    </main>
  );
}
