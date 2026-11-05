import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { useBotStatus } from "@/components/ClawQr";
import { fetchMe, fetchMessages, logout } from "@/lib/api";
import { BUILD_GIT_SHA, BUILD_TIME_ISO, formatBuildTimeShanghai } from "@/lib/build-info";

export const Route = createFileRoute("/console")({
  beforeLoad: async () => {
    const me = await fetchMe();
    if (!me) throw redirect({ to: "/login" });
    return { me };
  },
  component: ConsoleLayout,
});

function ConsoleLayout() {
  const { me: initial } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const meQ = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const m = await fetchMe();
      if (!m) throw new Error("unauthorized");
      return m;
    },
    initialData: initial,
  });
  const botQ = useBotStatus();

  const msgQ = useQuery({
    queryKey: ["messages"],
    queryFn: () => fetchMessages(100),
    refetchInterval: 5000,
  });

  const logoutM = useMutation({
    mutationFn: logout,
    onSettled: () => {
      qc.clear();
      navigate({ to: "/" });
    },
  });

  const binding = meQ.data?.binding;
  const isBound = binding?.status === "active" && Boolean(binding.wechatUserId);
  const botReady = Boolean(botQ.data?.botReady);
  const messagesCount = msgQ.data?.messages?.length ?? 0;

  const isSetup = pathname === "/console" || pathname === "/console/";
  const isMessages = pathname.startsWith("/console/messages");
  const isTodos = pathname.startsWith("/console/todos");

  return (
    <AppShell size="lg">
      <div className="page-head">
        <div className="min-w-0">
          <h1 className="type-title">控制台</h1>
          <p className="type-meta page-head-meta mt-1">已登录：{meQ.data?.user.email}</p>
          <p className="type-meta page-head-meta mt-0.5" title={BUILD_TIME_ISO || undefined}>
            构建 {formatBuildTimeShanghai(BUILD_TIME_ISO) || "未知"} · {BUILD_GIT_SHA}
          </p>
        </div>
        <button
          type="button"
          className={`btn-ghost${logoutM.isPending ? " is-loading" : ""}`}
          disabled={logoutM.isPending}
          onClick={() => logoutM.mutate()}
        >
          退出
        </button>
      </div>

      <div className="status-line mb-5" aria-label="当前状态">
        <span className={`status-dot${botReady ? " is-on" : " is-pending"}`}>
          ClawBot {botReady ? "在线" : "未上线"}
        </span>
        <span className={`status-dot${isBound ? " is-on" : ""}`}>
          微信{isBound ? "已绑定" : "未绑定"}
        </span>
      </div>

      <nav className="segmented" role="navigation" aria-label="控制台功能切换">
        <Link
          to="/console"
          className={`btn-ghost${isSetup ? " is-active" : ""}`}
          aria-current={isSetup ? "page" : undefined}
        >
          微信绑定
        </Link>
        <Link
          to="/console/messages"
          className={`btn-ghost${isMessages ? " is-active" : ""}`}
          aria-current={isMessages ? "page" : undefined}
        >
          历史消息{messagesCount > 0 ? <span className="tabular">（{messagesCount}）</span> : null}
        </Link>
        <Link
          to="/console/todos"
          className={`btn-ghost${isTodos ? " is-active" : ""}`}
          aria-current={isTodos ? "page" : undefined}
        >
          Todos
        </Link>
      </nav>

      <div className="console-content mt-6">
        <Outlet />
      </div>
    </AppShell>
  );
}
