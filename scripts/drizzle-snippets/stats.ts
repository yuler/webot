import { db, sqlite } from "@/db";
import { users, messages, sessions, wechatBindings } from "@/db/schema";
import { count, isNull } from "drizzle-orm";

async function main() {
  const [{ totalUsers }] = await db.select({ totalUsers: count() }).from(users);
  const [{ totalMessages }] = await db.select({ totalMessages: count() }).from(messages);
  const [{ activeMessages }] = await db
    .select({ activeMessages: count() })
    .from(messages)
    .where(isNull(messages.deletedAt));
  const [{ totalSessions }] = await db.select({ totalSessions: count() }).from(sessions);
  const [{ totalBindings }] = await db.select({ totalBindings: count() }).from(wechatBindings);

  console.log("\n📊 WeBot Database Statistics");
  console.log("-----------------------------------------");
  console.table([
    { Metric: "Users Count", Value: totalUsers },
    { Metric: "Active Messages", Value: activeMessages },
    { Metric: "Total Messages (incl. deleted)", Value: totalMessages },
    { Metric: "Active Sessions", Value: totalSessions },
    { Metric: "WeChat Bindings", Value: totalBindings },
  ]);

  // Quick SQLite file info
  const pragmaJournal = sqlite.prepare("PRAGMA journal_mode;").get() as Record<string, string>;
  const pragmaUserVersion = sqlite.prepare("PRAGMA user_version;").get() as Record<string, number>;
  console.log(`WAL Mode: ${Object.values(pragmaJournal)[0]} | User Version: ${Object.values(pragmaUserVersion)[0]}\n`);
}

main().catch((err) => {
  console.error("Error running stats snippet:", err);
  process.exit(1);
});
