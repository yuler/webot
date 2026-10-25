import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: text("created_at").notNull(),
});

export const otpCodes = sqliteTable(
  "otp_codes",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    emailIdx: index("otp_codes_email_idx").on(t.email),
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

/** One row per user: bind code + ClawBot/WeChat link state. */
export const wechatBindings = sqliteTable(
  "wechat_bindings",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id),
    bindCode: text("bind_code").notNull().unique(),
    /** iLink from_user_id once the user binds by messaging the code to ClawBot */
    wechatUserId: text("wechat_user_id"),
    /** pending | active | disconnected */
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
    role: text("role").notNull(), // user | assistant | system
    content: text("content").notNull(),
    wechatMessageId: text("wechat_message_id"),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    userIdx: index("messages_user_id_idx").on(t.userId),
    createdIdx: index("messages_created_at_idx").on(t.createdAt),
  }),
);
