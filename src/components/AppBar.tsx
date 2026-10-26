import { Link, getRouteApi, useRouterState } from "@tanstack/react-router";
import { LogoMark } from "@/components/LogoMark";
import { ThemeSwitch } from "@/components/ThemeSwitch";

const rootRouteApi = getRouteApi("__root__");

/** Left: animated WeBot mark + label; right: 登录|控制台 + ThemeSwitch. */
export function AppBar() {
  const { me } = rootRouteApi.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const loggedIn = Boolean(me);
  const onConsole = pathname === "/console" || pathname.startsWith("/console/");
  const onLogin = pathname === "/login" || pathname.startsWith("/login/");
  const onHome = pathname === "/";

  const brand = (
    <>
      <span className="app-bar-logo-frame">
        <LogoMark className="app-bar-logo-mark" />
      </span>
      <span className="type-kicker text-ink app-bar-brand">WeBot</span>
    </>
  );

  return (
    <header className="app-bar">
      <div className="app-bar-inner container">
        {onHome ? (
          <span className="app-bar-home" aria-label="WeBot 首页">
            {brand}
          </span>
        ) : (
          <Link to="/" className="app-bar-home" aria-label="回到首页">
            {brand}
          </Link>
        )}
        <nav className="app-bar-end" aria-label="主导航">
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
        </nav>
      </div>
    </header>
  );
}
