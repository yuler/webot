import { Link, useRouterState } from "@tanstack/react-router";
import { LogoMark } from "@/components/LogoMark";
import { ThemeSwitch } from "@/components/ThemeSwitch";

/** Left: animated WeBot mark + label; right: 控制台 (highlighted & disabled inside /console/*) + ThemeSwitch. */
export function AppBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onConsole = pathname === "/console" || pathname.startsWith("/console/");
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
          {onConsole ? (
            <span
              className="app-bar-cta type-kicker is-active is-disabled"
              aria-current="page"
              aria-disabled="true"
            >
              控制台
            </span>
          ) : (
            <Link
              to="/console"
              className="app-bar-cta type-kicker"
            >
              控制台
            </Link>
          )}
          <ThemeSwitch />
        </nav>
      </div>
    </header>
  );
}
