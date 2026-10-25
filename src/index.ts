/**
 * WeBot entry: email OTP console API + per-user ClawBot workers.
 * UI is TanStack Start (Vite); Bun serves /api and (in prod) the built client.
 */

import { ensureSchema, dbPath } from "./db";
import { loadHomeEnv, printBanner } from "./bot";
import { startClawRuntime } from "./claw/runtime";
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
  printBanner("WeBot API + console", "WEBOT_SKIP_BOT=1 — per-user ClawBot workers not started");
} else {
  const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";
  printBanner(
    "WeChat ClawBot + DeepSeek (per-user)",
    `模型: ${model} | 每用户独立扫码/凭据 | 控制台: /console`,
  );
  startClawRuntime();
}

await new Promise(() => {});
