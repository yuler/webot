import { Link, getRouteApi, useRouterState } from "@tanstack/react-router";
import { LogoMark } from "@/components/LogoMark";
import { ThemeSwitch } from "@/components/ThemeSwitch";

const rootRouteApi = getRouteApi("__root__");

/** Left: animated WeBot mark + label; right: 登录 | 待办+控制台 + ThemeSwitch. */
export function AppBar() {
  const { me } = rootRouteApi.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const loggedIn = Boolean(me);
  const onConsole = pathname === "/console" || pathname.startsWith("/console/");
  const onTodos = pathname === "/todos" || pathname.startsWith("/todos/");
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
      <nav className="app-bar-nav" aria-label="主导航">
        {onHome ? (
          <span className="app-bar-home" aria-label="WeBot 首页">
            {brand}
          </span>
        ) : (
          <Link to="/" className="app-bar-home" aria-label="回到首页">
            {brand}
          </Link>
        )}
      </nav>
      <div className="app-bar-end">
        {loggedIn ? (
          <>
            <Link
              to="/todos"
              className={`app-bar-cta type-kicker${onTodos ? " is-active" : ""}`}
              aria-current={onTodos ? "page" : undefined}
            >
              待办
            </Link>
            <Link
              to="/console"
              className={`app-bar-cta type-kicker${onConsole ? " is-active" : ""}`}
              aria-current={onConsole ? "page" : undefined}
            >
              控制台
            </Link>
          </>
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
