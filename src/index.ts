/**
 * WeBot entry: email OTP console API + single-worker ClawBot.
 * UI is TanStack Start (Vite); Bun serves /api and (in prod) the built client.
 */

import { ensureSchema, dbPath } from "./db";
import { loadHomeEnv, printBanner, runBotLoop } from "./bot";
import { startApiServer } from "./api";
import { mailTransport } from "./mail";

loadHomeEnv();
ensureSchema();
console.log(`[DB] SQLite (Drizzle) at ${dbPath}`);
console.log(
  `[mail] transport=${mailTransport()}${
    mailTransport() === "smtp" ? ` from=${process.env.SMTP_USERNAME}` : ""
  }`,
);

startApiServer();

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
  printBanner("WeBot API + console", "WEBOT_SKIP_BOT=1 — ClawBot loop not started");
  await new Promise(() => {});
} else {
  await runBotLoop();
}
