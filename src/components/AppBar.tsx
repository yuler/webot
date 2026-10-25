import { Link, getRouteApi, useRouterState } from "@tanstack/react-router";
import { ThemeSwitch } from "@/components/ThemeSwitch";

const rootRouteApi = getRouteApi("__root__");

/** Left: logo + Webot; right: 登录|控制台 (active highlight) + ThemeSwitch. */
export function AppBar() {
  const { me } = rootRouteApi.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const loggedIn = Boolean(me);
  const onConsole = pathname === "/console" || pathname.startsWith("/console/");
  const onLogin = pathname === "/login" || pathname.startsWith("/login/");

  return (
    <header className="app-bar">
      <nav className="app-bar-nav" aria-label="主导航">
        <Link to="/" className="app-bar-bot" aria-label="回到首页">
          BOT
        </Link>
        <Link to="/" className="type-kicker text-ink app-bar-brand">
          Webot
        </Link>
      </nav>
      <div className="app-bar-end">
        {loggedIn ? (
          <Link
            to="/console"
            className={`app-bar-cta type-kicker${onConsole ? " is-active" : ""}`}
            aria-current={onConsole ? "page" : undefined}
          >
            控制台
          </Link>
        ) : (
          <Link
            to="/login"
            className={`app-bar-cta type-kicker${onLogin ? " is-active" : ""}`}
            aria-current={onLogin ? "page" : undefined}
          >
            登录
          </Link>
        )}
        <ThemeSwitch />
      </div>
    </header>
  );
}
