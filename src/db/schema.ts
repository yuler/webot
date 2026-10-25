import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

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
