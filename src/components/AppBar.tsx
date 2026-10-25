import { Link, getRouteApi } from "@tanstack/react-router";

const rootRouteApi = getRouteApi("__root__");

/** Top chrome: WEBOT → `/`; guest「登录」 / signed-in「控制台」. No scan, theme, or logout. */
export function AppBar() {
  const { me } = rootRouteApi.useRouteContext();
  const loggedIn = Boolean(me);

  return (
    <header className="app-bar">
      <nav className="app-bar-nav">
        <Link to="/" className="type-kicker text-ink app-bar-brand" aria-label="回到首页">
          WEBOT
        </Link>
      </nav>
      {loggedIn ? (
        <Link to="/console" className="app-bar-cta type-kicker">
          控制台
        </Link>
      ) : (
        <Link to="/login" className="app-bar-cta type-kicker">
          登录
        </Link>
      )}
    </header>
  );
}
