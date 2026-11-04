import fs from "node:fs";
import path from "node:path";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

function resolveDbPath(): string {
  const raw = process.env.DATABASE_URL?.trim();
  if (raw) {
    return raw.startsWith("file:") ? raw.slice("file:".length) : raw;
  }
  return process.env.SQLITE_PATH?.trim() || "./data/webot.sqlite";
}

const dbPath = resolveDbPath();
fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });

const sqlite = new Database(dbPath, { create: true });
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");

export const db = drizzle(sqlite, { schema });
export { schema, sqlite, dbPath };

export function ensureSchema(): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS otp_codes (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'otp',
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS otp_codes_email_idx ON otp_codes(email);
    CREATE INDEX IF NOT EXISTS otp_codes_code_hash_idx ON otp_codes(code_hash);
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_token_hash_idx ON sessions(token_hash);
    CREATE TABLE IF NOT EXISTS wechat_bindings (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
      bind_code TEXT NOT NULL UNIQUE,
      wechat_user_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      bound_at TEXT,
      disconnected_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS wechat_bindings_bind_code_idx ON wechat_bindings(bind_code);
    CREATE INDEX IF NOT EXISTS wechat_bindings_wechat_user_id_idx ON wechat_bindings(wechat_user_id);
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id),
      wechat_user_id TEXT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      wechat_message_id TEXT,
      created_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS messages_user_id_idx ON messages(user_id);
    CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at);
    CREATE TABLE IF NOT EXISTS claw_bot_sessions (
      user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id),
      bot_token TEXT,
      updates_buf TEXT NOT NULL DEFAULT '',
      bot_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'idle',
      message TEXT NOT NULL DEFAULT '',
      qr_rev TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );
  `);

  // Soft-delete column + index: never CREATE INDEX on deleted_at before the column exists.
  // Legacy DBs keep the old CREATE TABLE IF NOT EXISTS shape (no deleted_at); alter first.
  {
    const msgCols = sqlite.prepare(`PRAGMA table_info(messages)`).all() as Array<{ name: string }>;
    if (!msgCols.some((c) => c.name === "deleted_at")) {
      sqlite.exec(`ALTER TABLE messages ADD COLUMN deleted_at TEXT;`);
    }
    sqlite.exec(`CREATE INDEX IF NOT EXISTS messages_deleted_at_idx ON messages(deleted_at);`);
  }

  // Migrate older otp_codes without kind
  try {
    const cols = sqlite.prepare(`PRAGMA table_info(otp_codes)`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === "kind")) {
      sqlite.exec(`ALTER TABLE otp_codes ADD COLUMN kind TEXT NOT NULL DEFAULT 'otp';`);
    }
  } catch {
    // ignore
  }

  // --- Todos module (待办) ---
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user_module_settings (
      user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id),
      todos_enabled INTEGER NOT NULL DEFAULT 1,
      timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
      tips_acked_at TEXT,
      last_user_inbound_at TEXT,
      proactive_sent_in_window INTEGER NOT NULL DEFAULT 0,
      window_started_at TEXT,
      last_context_token TEXT,
      last_wechat_user_id TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      notes TEXT,
      due_at TEXT,
      remind_at TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      completed_at TEXT,
      source TEXT NOT NULL DEFAULT 'api',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS todos_user_id_idx ON todos(user_id);
    CREATE INDEX IF NOT EXISTS todos_status_idx ON todos(status);
    CREATE INDEX IF NOT EXISTS todos_remind_at_idx ON todos(remind_at);
    CREATE TABLE IF NOT EXISTS todo_reminders (
      id TEXT PRIMARY KEY NOT NULL,
      todo_id TEXT NOT NULL REFERENCES todos(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      scheduled_at TEXT NOT NULL,
      sent_at TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      skip_reason TEXT,
      attempt INTEGER NOT NULL DEFAULT 0,
      catchup_used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS todo_reminders_todo_id_idx ON todo_reminders(todo_id);
    CREATE INDEX IF NOT EXISTS todo_reminders_user_id_idx ON todo_reminders(user_id);
    CREATE INDEX IF NOT EXISTS todo_reminders_status_sched_idx ON todo_reminders(status, scheduled_at);
  `);

  try {
    sqlite.exec(`DROP TABLE IF EXISTS memberships;`);
    sqlite.exec(`DROP TABLE IF EXISTS tenants;`);
  } catch {
    // ignore
  }
}
