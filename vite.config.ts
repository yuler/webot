import { execSync } from "node:child_process";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const apiTarget = process.env.WEBOT_API_PROXY || "http://127.0.0.1:3000";

function resolveGitSha(): string {
  const fromEnv = process.env.GIT_SHA?.trim();
  if (fromEnv) return fromEnv.length > 7 ? fromEnv.slice(0, 7) : fromEnv;
  try {
    return execSync("git rev-parse --short HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function resolveBuildTime(): string {
  const fromEnv = process.env.BUILD_TIME?.trim();
  if (fromEnv) return fromEnv;
  return new Date().toISOString();
}

const gitSha = resolveGitSha();
const buildTime = resolveBuildTime();

export default defineConfig({
  define: {
    __WEBOT_GIT_SHA__: JSON.stringify(gitSha),
    __WEBOT_BUILD_TIME__: JSON.stringify(buildTime),
  },
  server: {
    port: Number(process.env.WEB_PORT) || 5173,
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      srcDirectory: "src",
    }),
    viteReact(),
    nitro({
      // `standard` exports `{ fetch }` without binding a port — Bun API embeds it in prod.
      preset: "standard",
      compressPublicAssets: true,
    }),
  ],
});
