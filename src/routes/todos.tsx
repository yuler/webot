import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { TodosPanel } from "@/components/TodosPanel";
import { fetchMe, logout } from "@/lib/api";

export const Route = createFileRoute("/todos")({
  beforeLoad: async () => {
    const me = await fetchMe();
    if (!me) throw redirect({ to: "/login" });
    return { me };
  },
  component: TodosPage,
});

function TodosPage() {
  const { me: initial } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const meQ = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const m = await fetchMe();
      if (!m) throw new Error("unauthorized");
      return m;
    },
    initialData: initial,
  });

  const logoutM = useMutation({
    mutationFn: logout,
    onSettled: () => {
      qc.clear();
      navigate({ to: "/" });
    },
  });

  return (
    <AppShell size="lg">
      <div className="page-head">
        <div className="min-w-0">
          <h1 className="type-title">待办</h1>
          <p className="type-meta page-head-meta mt-1">已登录：{meQ.data?.user.email}</p>
          <p className="type-meta page-head-meta mt-0.5">
            <Link to="/console">去控制台</Link>
            <span aria-hidden="true"> · </span>
            扫码与绑定、消息记录
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

      <TodosPanel headingId="todos-page-heading" />
    </AppShell>
  );
}
