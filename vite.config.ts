import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const apiTarget = process.env.WEBOT_API_PROXY || "http://127.0.0.1:3000";

export default defineConfig({
  server: {
    port: Number(process.env.WEB_PORT) || 5173,
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
      "/qrcode.png": { target: apiTarget, changeOrigin: true },
      "/status": { target: apiTarget, changeOrigin: true },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      srcDirectory: "src",
    }),
    viteReact(),
    nitro({
      compressPublicAssets: true,
    }),
  ],
});
