import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { Database } from "bun:sqlite";

/**
 * Regression: ensureSchema must ALTER legacy messages (no deleted_at) before
 * creating messages_deleted_at_idx — indexing a missing column aborts startup.
 */
test("ensureSchema migrates legacy messages table missing deleted_at", () => {
  const legacyPath = path.join(import.meta.dir, "..", "data", "test-legacy-messages.sqlite");
  fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
  for (const s of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(legacyPath + s);
    } catch {}
  }

  const seed = new Database(legacyPath, { create: true });
  seed.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );
    CREATE TABLE messages (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id),
      wechat_user_id TEXT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      wechat_message_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX messages_user_id_idx ON messages(user_id);
    INSERT INTO users (id, email, created_at) VALUES ('u1', 'legacy@example.com', '2020-01-01T00:00:00.000Z');
    INSERT INTO messages (id, user_id, wechat_user_id, role, content, wechat_message_id, created_at)
    VALUES ('m1', 'u1', 'wx1', 'user', 'hello legacy', null, '2020-01-01T00:00:00.000Z');
  `);
  const before = seed.prepare(`PRAGMA table_info(messages)`).all() as Array<{ name: string }>;
  expect(before.some((c) => c.name === "deleted_at")).toBe(false);
  seed.close();

  const repoRoot = path.join(import.meta.dir, "..");
  const script = `
process.env.SQLITE_PATH = ${JSON.stringify(legacyPath)};
const { ensureSchema, sqlite } = await import("../src/db/index.ts");
ensureSchema();
const cols = sqlite.prepare("PRAGMA table_info(messages)").all();
if (!cols.some((c) => c.name === "deleted_at")) {
  throw new Error("deleted_at column missing after ensureSchema");
}
const idx = sqlite.prepare(
  "SELECT name FROM sqlite_master WHERE type='index' AND name='messages_deleted_at_idx'",
).get();
if (!idx) throw new Error("messages_deleted_at_idx missing after ensureSchema");
const row = sqlite.prepare("SELECT id, deleted_at, content FROM messages WHERE id = 'm1'").get();
if (!row || row.content !== "hello legacy") throw new Error("legacy row lost");
if (row.deleted_at != null) throw new Error("unexpected deleted_at on legacy row");
console.log("OK");
`;
  const scriptPath = path.join(import.meta.dir, "_ensure_schema_legacy_tmp.ts");
  fs.writeFileSync(scriptPath, script);
  const r = Bun.spawnSync({
    cmd: ["bun", "run", scriptPath],
    cwd: repoRoot,
    env: { ...process.env, SQLITE_PATH: legacyPath },
  });
  try {
    fs.unlinkSync(scriptPath);
  } catch {}
  expect(r.exitCode).toBe(0);
  expect(r.stdout.toString()).toContain("OK");
  const err = r.stderr.toString();
  expect(err).not.toMatch(/no such column:\s*deleted_at/i);
});
