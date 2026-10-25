import { describe, expect, test } from "bun:test";
import { ssrApiOrigin } from "../src/lib/ssr-origin";

describe("ssrApiOrigin", () => {
  test("ignores PUBLIC_ORIGIN; prefers APP_ORIGIN then loopback", () => {
    const prev = {
      PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN,
      APP_ORIGIN: process.env.APP_ORIGIN,
      PORT: process.env.PORT,
    };
    try {
      process.env.PUBLIC_ORIGIN = "https://webot.example.com";
      delete process.env.APP_ORIGIN;
      process.env.PORT = "3456";
      expect(ssrApiOrigin()).toBe("http://127.0.0.1:3456");

      process.env.APP_ORIGIN = "http://127.0.0.1:3456/";
      expect(ssrApiOrigin()).toBe("http://127.0.0.1:3456");

      process.env.PUBLIC_ORIGIN = "http://203.0.113.1:9";
      process.env.APP_ORIGIN = "http://127.0.0.1:9999";
      expect(ssrApiOrigin()).toBe("http://127.0.0.1:9999");
    } finally {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});
