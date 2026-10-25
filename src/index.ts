/**
 * WeBot entry: multi-tenant email OTP console + single-worker ClawBot.
 */

import { ensureSchema, dbPath } from "./db";
import { loadHomeEnv, printBanner, runBotLoop } from "./bot";
import { startWebServer } from "./web";

loadHomeEnv();
ensureSchema();
console.log(`[DB] SQLite (Drizzle) at ${dbPath}`);

startWebServer();

process.on("SIGINT", () => {
  console.log("\n[System] 正在安全停止 WeBot 服务...");
  process.exit(0);
});
process.on("SIGTERM", () => {
  console.log("\n[System] 正在安全停止 WeBot 服务...");
  process.exit(0);
});

const skipBot = process.env.WEBOT_SKIP_BOT === "1";
if (skipBot) {
  printBanner("WeBot console only", "WEBOT_SKIP_BOT=1 — ClawBot loop not started");
  // Keep process alive for web server
  await new Promise(() => {});
} else {
  await runBotLoop();
}
