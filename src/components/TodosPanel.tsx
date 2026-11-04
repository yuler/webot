import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  completeTodoApi,
  createTodoApi,
  deleteTodoApi,
  fetchTodos,
  fetchTodosSettings,
  patchTodosSettings,
  type Todo,
} from "@/lib/api";
import { formatTodoWhen, groupTodosByDate, todoGroupKey } from "@/lib/todo-groups";

/** Shared open-todos panel: settings toggle, create form, date buckets. Writes respect todosEnabled. */
export function TodosPanel({ headingId = "todos-heading" }: { headingId?: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [remindLocal, setRemindLocal] = useState("");

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
  const createM = useMutation({
    mutationFn: () =>
      createTodoApi({
        title: title.trim(),
        remindAt: remindLocal ? new Date(remindLocal).toISOString() : null,
      }),
    onSuccess: () => {
      setTitle("");
      setRemindLocal("");
      qc.invalidateQueries({ queryKey: ["todos"] });
    },
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
  const titleFieldId = `${headingId}-title`;
  const remindFieldId = `${headingId}-remind`;

  return (
    <section className="panel" aria-labelledby={headingId}>
      <div className="panel-head">
        <div className="min-w-0">
          <h2 id={headingId} className="type-app-title">
            待办
          </h2>
          <p className="type-meta mt-1">按日期分组 · 极简单次提醒 · 与微信 ClawBot 对话也可创建</p>
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

      {tips ? (
        <p className="notice mt-3" role="note">
          <span className="notice-tag">Tips</span>
          <span>{tips}</span>
        </p>
      ) : null}

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim() || !enabled) return;
          createM.mutate();
        }}
      >
        <label className="type-meta" htmlFor={titleFieldId}>
          新待办
        </label>
        <input
          id={titleFieldId}
          className="field mt-1"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例如：交社保"
          disabled={!enabled || createM.isPending}
        />
        <label className="type-meta mt-3 block" htmlFor={remindFieldId}>
          提醒时间（可选，本地时区）
        </label>
        <input
          id={remindFieldId}
          className="field mt-1"
          type="datetime-local"
          value={remindLocal}
          onChange={(e) => setRemindLocal(e.target.value)}
          disabled={!enabled || createM.isPending}
        />
        <div className="actions mt-3">
          <button
            type="submit"
            className={`btn-solid${createM.isPending ? " is-loading" : ""}`}
            disabled={!enabled || !title.trim() || createM.isPending}
          >
            添加
          </button>
        </div>
        {createM.isError ? (
          <p className="notice notice--error mt-3" role="alert">
            <span className="notice-tag">出错</span>
            <span>创建失败</span>
          </p>
        ) : null}
      </form>

      {todosQ.isPending ? (
        <p className="type-meta mt-4">加载中…</p>
      ) : todos.length === 0 ? (
        <div className="timeline-empty mt-4">
          <p className="type-meta">暂无待办</p>
          <p className="type-meta mt-1">在微信说「明天 9 点提醒我…」或在上方添加</p>
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
                        <p className="todo-title">{t.title}</p>
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
                          if (!window.confirm(`删除待办「${t.title}」？`)) return;
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
