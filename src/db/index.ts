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
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS messages_user_id_idx ON messages(user_id);
    CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at);
  `);

  // Migrate older otp_codes without kind
  try {
    const cols = sqlite.prepare(`PRAGMA table_info(otp_codes)`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === "kind")) {
      sqlite.exec(`ALTER TABLE otp_codes ADD COLUMN kind TEXT NOT NULL DEFAULT 'otp';`);
    }
  } catch {
    // ignore
  }

  try {
    sqlite.exec(`DROP TABLE IF EXISTS memberships;`);
    sqlite.exec(`DROP TABLE IF EXISTS tenants;`);
  } catch {
    // ignore
  }
}
