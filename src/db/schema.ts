import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: text("created_at").notNull(),
});

/** Login challenges: kind = otp (6-digit) | magic (email link token). */
export const otpCodes = sqliteTable(
  "otp_codes",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    /** sha256 hash of OTP digits or magic token */
    codeHash: text("code_hash").notNull(),
    /** otp | magic */
    kind: text("kind").notNull().default("otp"),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    emailIdx: index("otp_codes_email_idx").on(t.email),
    hashIdx: index("otp_codes_code_hash_idx").on(t.codeHash),
  }),
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    tokenIdx: index("sessions_token_hash_idx").on(t.tokenHash),
  }),
);

export const wechatBindings = sqliteTable(
  "wechat_bindings",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id),
    bindCode: text("bind_code").notNull().unique(),
    wechatUserId: text("wechat_user_id"),
    status: text("status").notNull().default("pending"),
    boundAt: text("bound_at"),
    disconnectedAt: text("disconnected_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    codeIdx: index("wechat_bindings_bind_code_idx").on(t.bindCode),
    wechatIdx: index("wechat_bindings_wechat_user_id_idx").on(t.wechatUserId),
  }),
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    wechatUserId: text("wechat_user_id"),
    role: text("role").notNull(),
    content: text("content").notNull(),
    wechatMessageId: text("wechat_message_id"),
    createdAt: text("created_at").notNull(),
    /** Soft-delete tombstone; null = visible to console + WeChat context. */
    deletedAt: text("deleted_at"),
  },
  (t) => ({
    userIdx: index("messages_user_id_idx").on(t.userId),
    createdIdx: index("messages_created_at_idx").on(t.createdAt),
    deletedIdx: index("messages_deleted_at_idx").on(t.deletedAt),
  }),
);

/** Per SaaS-user ClawBot iLink credentials (no shared session file). */
export const clawBotSessions = sqliteTable("claw_bot_sessions", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  botToken: text("bot_token"),
  updatesBuf: text("updates_buf").notNull().default(""),
  botId: text("bot_id").notNull().default(""),
  status: text("status").notNull().default("idle"),
  message: text("message").notNull().default(""),
  qrRev: text("qr_rev").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
});

/** Per-user module flags + heuristic ClawBot proactive window state (待办). */
export const userModuleSettings = sqliteTable("user_module_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  /** Module id `todos`; UI copy 「待办」. Default ON. */
  todosEnabled: integer("todos_enabled", { mode: "boolean" }).notNull().default(true),
  timezone: text("timezone").notNull().default("Asia/Shanghai"),
  tipsAckedAt: text("tips_acked_at"),
  /** Heuristic: last inbound WeChat message time (refreshes ~24h window). */
  lastUserInboundAt: text("last_user_inbound_at"),
  /** Heuristic proactive sends in current window (~10). Reset on inbound. */
  proactiveSentInWindow: integer("proactive_sent_in_window").notNull().default(0),
  windowStartedAt: text("window_started_at"),
  /** Last iLink context_token — required for proactive sendmessage. */
  lastContextToken: text("last_context_token"),
  lastWechatUserId: text("last_wechat_user_id"),
  updatedAt: text("updated_at").notNull(),
});

/** Google Tasks–style single-shot 待办; multi-tenant by user_id. No recurrence in v1. */
export const todos = sqliteTable(
  "todos",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    notes: text("notes"),
    dueAt: text("due_at"),
    remindAt: text("remind_at"),
    /** open | done | cancelled */
    status: text("status").notNull().default("open"),
    completedAt: text("completed_at"),
    /** wechat | console | api */
    source: text("source").notNull().default("api"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => ({
    userIdx: index("todos_user_id_idx").on(t.userId),
    statusIdx: index("todos_status_idx").on(t.status),
    remindIdx: index("todos_remind_at_idx").on(t.remindAt),
  }),
);

export const todoReminders = sqliteTable(
  "todo_reminders",
  {
    id: text("id").primaryKey(),
    todoId: text("todo_id")
      .notNull()
      .references(() => todos.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    scheduledAt: text("scheduled_at").notNull(),
    sentAt: text("sent_at"),
    /** pending | sent | skipped_window | skipped_quota | failed */
    status: text("status").notNull().default("pending"),
    skipReason: text("skip_reason"),
    attempt: integer("attempt").notNull().default(0),
    /** Max 1 catch-up per todo after skip. */
    catchupUsed: integer("catchup_used", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    todoIdx: index("todo_reminders_todo_id_idx").on(t.todoId),
    userIdx: index("todo_reminders_user_id_idx").on(t.userId),
    statusSchedIdx: index("todo_reminders_status_sched_idx").on(t.status, t.scheduledAt),
  }),
);
