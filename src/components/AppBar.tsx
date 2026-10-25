import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { logout } from "@/lib/api";

const rootRouteApi = getRouteApi("__root__");

/** Shared top chrome: BOT mark + WEBOT → `/`, auth CTAs, ThemeSwitch right. */
export function AppBar() {
  const { me } = rootRouteApi.useRouteContext();
  const navigate = useNavigate();
  const loggedIn = Boolean(me);

  return (
    <header className="app-bar">
      <nav className="app-bar-nav">
        <Link to="/" className="app-bar-bot" aria-label="回到首页">
          BOT
        </Link>
        <Link to="/" className="type-kicker text-ink app-bar-brand">
          WEBOT
        </Link>
        {loggedIn ? (
          <>
            <Link to="/console">控制台</Link>
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate({ to: "/" });
              }}
            >
              退出
            </button>
          </>
        ) : (
          <Link to="/login">邮箱登录</Link>
        )}
      </nav>
      <ThemeSwitch />
    </header>
  );
}
