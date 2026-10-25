/**
 * Env bootstrap + banners. Per-user ClawBot workers live in src/claw/.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function printBanner(title: string, subtitle?: string): void {
  try {
    const text = subtitle ? `${title}\n${subtitle}` : title;
    const proc = Bun.spawnSync([
      "gum",
      "style",
      "--border",
      "normal",
      "--margin",
      "1",
      "--padding",
      "1 2",
      "--border-foreground",
      "212",
      text,
    ]);
    if (proc.exitCode === 0) {
      console.log(proc.stdout.toString().trim());
      return;
    }
  } catch {
    // fall through
  }

  console.log("\n" + "=".repeat(60));
  console.log(`  ${title}`);
  if (subtitle) console.log(`  ${subtitle}`);
  console.log("=".repeat(60) + "\n");
}

function applyEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf-8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

/** Fill unset vars from the project `.env`, then `~/.env.local`. */
export function loadHomeEnv(): void {
  applyEnvFile(path.resolve(".env"));
  applyEnvFile(path.join(os.homedir(), ".env.local"));
}

/** @deprecated use startClawRuntime from src/claw/runtime.ts */
export async function runBotLoop(): Promise<void> {
  const { startClawRuntime } = await import("./claw/runtime");
  startClawRuntime();
  await new Promise(() => {});
}
