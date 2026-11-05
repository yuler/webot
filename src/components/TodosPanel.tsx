import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  completeTodoApi,
  deleteTodoApi,
  fetchTodos,
  fetchTodosSettings,
  patchTodosSettings,
  updateTodoApi,
  type Todo,
} from "@/lib/api";
import { formatTodoWhen, groupTodosByDate, todoGroupKey } from "@/lib/todo-groups";

/** Shared open-todos panel: settings toggle, AI native prompt, date buckets, inline editable title. */
export function TodosPanel({ headingId = "todos-heading" }: { headingId?: string }) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const settingsQ = useQuery({
    queryKey: ["todos-settings"],
    queryFn: fetchTodosSettings,
  });
  const todosQ = useQuery({
    queryKey: ["todos", "open"],
    queryFn: () => fetchTodos("open"),
    refetchInterval: 8000,
  });

  const toggleM = useMutation({
    mutationFn: (todosEnabled: boolean) => patchTodosSettings({ todosEnabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos-settings"] }),
  });
  const updateM = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      updateTodoApi(id, { title }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });
  const completeM = useMutation({
    mutationFn: (id: string) => completeTodoApi(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => deleteTodoApi(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });

  const enabled = settingsQ.data?.settings.todosEnabled ?? true;
  const tips = settingsQ.data?.tips ?? todosQ.data?.tips ?? "";
  const todos = todosQ.data?.todos ?? [];
  const timeZone = settingsQ.data?.settings.timezone || "Asia/Shanghai";
  const buckets = groupTodosByDate(todos, { timeZone });

  function commitEdit(todoId: string, originalTitle: string) {
    const trimmed = editingTitle.trim();
    if (trimmed && trimmed !== originalTitle) {
      updateM.mutate({ id: todoId, title: trimmed });
    }
    setEditingId(null);
  }

  return (
    <section className="panel" aria-labelledby={headingId}>
      <div className="panel-head">
        <div className="min-w-0">
          <h2 id={headingId} className="type-app-title">
            Todos
          </h2>
          <p className="type-meta mt-1">按日期分组 · 极简单次提醒 · 通过微信与 AI 对话自动创建</p>
        </div>
        <button
          type="button"
          className={`btn-ghost${toggleM.isPending ? " is-loading" : ""}`}
          aria-pressed={enabled}
          disabled={toggleM.isPending || settingsQ.isPending}
          onClick={() => toggleM.mutate(!enabled)}
        >
          {enabled ? "已开启" : "已关闭"}
        </button>
      </div>

      <div className="notice mt-3" role="note">
        <span className="notice-tag">AI Native</span>
        <span>
          Todos 由 AI 自动解析管理：在微信中与 ClawBot 对话（如「明天 9 点提醒我交社保」）即可自动创建；点击待办标题可直接行内修改。
        </span>
      </div>

      {tips ? (
        <p className="notice mt-3" role="note">
          <span className="notice-tag">Tips</span>
          <span>{tips}</span>
        </p>
      ) : null}

      {updateM.isError ? (
        <p className="notice notice--error mt-3" role="alert">
          <span className="notice-tag">出错</span>
          <span>修改标题失败，请稍后重试</span>
        </p>
      ) : null}

      {todosQ.isPending ? (
        <p className="type-meta mt-4">加载中…</p>
      ) : todos.length === 0 ? (
        <div className="timeline-empty mt-4">
          <p className="type-meta">暂无 Todos</p>
          <p className="type-meta mt-1">在微信对 ClawBot 说「明天 9 点提醒我…」，AI 会自动创建并准时提醒</p>
        </div>
      ) : (
        <div className="todo-groups mt-4">
          {buckets.map((bucket) => (
            <section key={bucket.id} className="todo-group" aria-labelledby={`${headingId}-bucket-${bucket.id}`}>
              <h3 id={`${headingId}-bucket-${bucket.id}`} className="todo-group-title">
                {bucket.label}
                <span className="todo-group-count tabular">{bucket.items.length}</span>
              </h3>
              <ul className="todo-list">
                {bucket.items.map((t: Todo) => {
                  const key = todoGroupKey(t);
                  const groupedOnDue = Boolean(t.dueAt);
                  const showRemindHint =
                    groupedOnDue && t.remindAt && t.remindAt !== t.dueAt;
                  const isEditing = editingId === t.id;

                  return (
                    <li key={t.id} className="todo-row">
                      <button
                        type="button"
                        className="todo-check"
                        aria-label={`完成「${t.title}」`}
                        disabled={completeM.isPending || !enabled}
                        onClick={() => completeM.mutate(t.id)}
                      />
                      <div className="todo-main">
                        {isEditing ? (
                          <input
                            type="text"
                            className="todo-title-input"
                            value={editingTitle}
                            autoFocus
                            disabled={updateM.isPending}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitEdit(t.id, t.title);
                              } else if (e.key === "Escape") {
                                setEditingId(null);
                              }
                            }}
                            onBlur={() => commitEdit(t.id, t.title)}
                          />
                        ) : (
                          <p
                            className="todo-title todo-title-editable"
                            title="点击直接修改标题"
                            onClick={() => {
                              if (!enabled || updateM.isPending) return;
                              setEditingId(t.id);
                              setEditingTitle(t.title);
                            }}
                          >
                            {t.title}
                          </p>
                        )}
                        <div className="todo-meta type-meta">
                          {key ? (
                            <time dateTime={key}>{formatTodoWhen(key, timeZone)}</time>
                          ) : (
                            <span>无日期</span>
                          )}
                          {showRemindHint ? (
                            <span className="todo-meta-extra">
                              提醒 {formatTodoWhen(t.remindAt!, timeZone)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-ghost todo-delete"
                        disabled={deleteM.isPending}
                        onClick={() => {
                          if (!window.confirm(`删除 Todo「${t.title}」？`)) return;
                          deleteM.mutate(t.id);
                        }}
                      >
                        删除
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
